import { parsePhotoDate, type PhotoItem } from './dateGrouping'
import type { LocaleMessages } from '../i18n'

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

type FileSystemMessages = LocaleMessages['fileSystem']

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

function normalizeDirectoryError(error: unknown, messages: FileSystemMessages): Error {
  if (!(error instanceof Error)) return new Error(messages.readFailed)

  const rawMessage = error.message || ''
  const errorName = error.name || ''
  const message = `${errorName} ${rawMessage}`.toLowerCase()

  if (message.includes('system') || rawMessage.includes('系统文件') || errorName === 'SecurityError') {
    return new Error(messages.systemDirectory)
  }

  if (errorName === 'AbortError') {
    return new Error(messages.abortSelection)
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
  options: { requestPermission?: boolean; messages: FileSystemMessages }
): Promise<AlbumDirectoryResult> {
  const hasPermission = await ensureReadWritePermission(directoryHandle, options.requestPermission ?? true)
  if (!hasPermission) {
    throw new Error(options.messages.permissionRequired)
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
    throw normalizeDirectoryError(error, options.messages)
  }

  photos.sort((a, b) => b.timestamp - a.timestamp)

  return {
    directoryName: directoryHandle.name,
    directoryHandle,
    photos
  }
}

export async function pickAlbumDirectory(messages: FileSystemMessages): Promise<AlbumDirectoryResult> {
  if (!window.showDirectoryPicker) {
    throw new Error(messages.unsupportedBrowser)
  }

  try {
    const directoryHandle = await window.showDirectoryPicker({
      id: 'infinity-nikki-album',
      mode: 'readwrite',
      startIn: 'pictures'
    })

    const result = await readAlbumDirectory(directoryHandle, { requestPermission: true, messages })
    await saveAlbumDirectoryHandle(directoryHandle)
    return result
  } catch (error) {
    throw normalizeDirectoryError(error, messages)
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
