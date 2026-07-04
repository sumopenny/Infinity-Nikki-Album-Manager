import { parsePhotoDate, type PhotoItem } from './dateGrouping'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'])
const DB_NAME = 'infinity-nikki-album-manager'
const DB_VERSION = 1
const STORE_NAME = 'album-handles'
const SAVED_DIRECTORY_KEY = 'current-album-directory'

export interface AlbumDirectoryResult {
  directoryName: string
  directoryHandle: FileSystemDirectoryHandle
  photos: PhotoItem[]
}

function isImageFile(fileName: string): boolean {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  return IMAGE_EXTENSIONS.has(extension)
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

function normalizeDirectoryError(error: unknown): Error {
  if (!(error instanceof Error)) return new Error('读取相册失败，请重试。')

  const rawMessage = error.message || ''
  const errorName = error.name || ''
  const message = `${errorName} ${rawMessage}`.toLowerCase()

  if (message.includes('system') || rawMessage.includes('系统文件') || errorName === 'SecurityError') {
    return new Error('无法打开此文件夹：浏览器不允许网页访问包含系统文件或受保护的目录。请直接选择 NikkiPhotos_HighQuality 图片文件夹，不要选择游戏安装根目录、C 盘根目录、Windows、Program Files 等上级目录。')
  }

  if (errorName === 'AbortError') {
    return new Error('已取消选择相册文件夹。')
  }

  return error
}

async function ensureReadWritePermission(
  directoryHandle: FileSystemDirectoryHandle,
  requestPermission: boolean
): Promise<boolean> {
  const options = { mode: 'readwrite' as const }
  if (directoryHandle.queryPermission) {
    const current = await directoryHandle.queryPermission(options)
    if (current === 'granted') return true
    if (!requestPermission) return false
  }

  if (!directoryHandle.requestPermission) return true
  return (await directoryHandle.requestPermission(options)) === 'granted'
}

function openAlbumDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function runStoreTransaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openAlbumDb()

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode)
    const request = action(transaction.objectStore(STORE_NAME))

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => db.close()
    transaction.onerror = () => {
      db.close()
      reject(transaction.error)
    }
  })
}

export async function saveAlbumDirectoryHandle(directoryHandle: FileSystemDirectoryHandle): Promise<void> {
  await runStoreTransaction('readwrite', (store) => store.put(directoryHandle, SAVED_DIRECTORY_KEY))
}

export async function getSavedAlbumDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await runStoreTransaction<FileSystemDirectoryHandle | null>('readonly', (store) =>
      store.get(SAVED_DIRECTORY_KEY)
    )
  } catch {
    return null
  }
}

export async function clearSavedAlbumDirectoryHandle(): Promise<void> {
  await runStoreTransaction('readwrite', (store) => store.delete(SAVED_DIRECTORY_KEY))
}

export async function readAlbumDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  options: { requestPermission?: boolean } = {}
): Promise<AlbumDirectoryResult> {
  const hasPermission = await ensureReadWritePermission(directoryHandle, options.requestPermission ?? true)
  if (!hasPermission) {
    throw new Error('已记住上次相册路径，但浏览器需要重新授权。请点击“选择/恢复相册路径”完成授权。')
  }

  const photos: PhotoItem[] = []

  try {
    for await (const [name, handle] of directoryHandle.entries()) {
      if (handle.kind !== 'file' || !isImageFile(name)) continue

      const parsed = parsePhotoDate(name)
      if (!parsed) continue

      const fileHandle = handle as FileSystemFileHandle
      const file = await fileHandle.getFile()
      const url = URL.createObjectURL(file)

      photos.push({
        id: `${parsed.dateKey}-${parsed.timeText}-${name}`,
        name,
        url,
        file,
        fileSizeText: formatFileSize(file.size),
        fileHandle,
        directoryHandle,
        ...parsed
      })
    }
  } catch (error) {
    throw normalizeDirectoryError(error)
  }

  photos.sort((a, b) => b.timestamp - a.timestamp)

  return {
    directoryName: directoryHandle.name,
    directoryHandle,
    photos
  }
}

export async function pickAlbumDirectory(): Promise<AlbumDirectoryResult> {
  if (!window.showDirectoryPicker) {
    throw new Error('当前浏览器不支持选择文件夹。请使用最新版 Chrome 或 Edge，并在 localhost/HTTPS 环境运行。')
  }

  try {
    const directoryHandle = await window.showDirectoryPicker({
      id: 'infinity-nikki-album',
      mode: 'readwrite',
      startIn: 'pictures'
    })

    const result = await readAlbumDirectory(directoryHandle, { requestPermission: true })
    await saveAlbumDirectoryHandle(directoryHandle)
    return result
  } catch (error) {
    throw normalizeDirectoryError(error)
  }
}

export async function deletePhotoFile(photo: PhotoItem): Promise<void> {
  await photo.directoryHandle.removeEntry(photo.name)
  URL.revokeObjectURL(photo.url)
}

export function releasePhotoUrls(photos: PhotoItem[]): void {
  for (const photo of photos) {
    URL.revokeObjectURL(photo.url)
  }
}
