import { parsePhotoDate, type PhotoItem } from './dateGrouping'
import type { LocaleMessages } from '../i18n'

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'])
const DB_NAME = 'infinity-nikki-album-manager'
const DB_VERSION = 1
const STORE_NAME = 'album-handles'
const SAVED_DIRECTORY_KEY = 'current-album-directory'
const SAVED_X6GAME_DIRECTORY_KEY = 'current-x6game-directory'
const HIGH_QUALITY_DIRECTORY_NAME = 'NikkiPhotos_HighQuality'
const LOW_QUALITY_DIRECTORY_NAME = 'NikkiPhotos_LowQuality'
const SCREENSHOT_DIRECTORY_NAME = 'ScreenShot'
const pendingPhotoLoads = new WeakMap<PhotoItem, Promise<string>>()
const releasedPhotos = new WeakSet<PhotoItem>()

export interface AlbumDirectoryResult {
  directoryName: string
  directoryHandle: FileSystemDirectoryHandle
  photos: PhotoItem[]
}

interface RelatedPhotoCleanupTarget {
  directoryName: string
  directoryHandle: FileSystemDirectoryHandle
  photoNames: string[]
}

export interface RelatedPhotoCleanupPlan {
  totalCount: number
  missingDirectories: string[]
  targets: RelatedPhotoCleanupTarget[]
}

export interface RelatedPhotoCleanupResult {
  deletedCount: number
  failedNames: string[]
  missingDirectories: string[]
}

type FileSystemMessages = LocaleMessages['fileSystem']

interface RelatedPhotoCleanupOptions {
  beforePickX6GameDirectory?: () => boolean | Promise<boolean>
  beforeRequestX6GamePermission?: () => boolean | Promise<boolean>
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

  if (!requestPermission && directoryHandle.requestPermission) return false
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

export async function getSavedX6GameDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await runStoreTransaction<FileSystemDirectoryHandle | null>('readonly', (store) =>
      store.get(SAVED_X6GAME_DIRECTORY_KEY)
    )
  } catch {
    return null
  }
}

export async function clearSavedX6GameDirectoryHandle(): Promise<void> {
  await runStoreTransaction('readwrite', (store) => store.delete(SAVED_X6GAME_DIRECTORY_KEY))
}

/**
 * 扫描相册目录并整理照片元数据，不在扫描阶段读取原图内容。
 * 参数：directoryHandle 为相册目录句柄，options 为权限策略和错误提示文案。
 * 返回：相册名称、目录句柄和按拍摄时间排序的照片列表。
 */
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

      photos.push({
        id: `${parsed.dateKey}-${parsed.timeText}-${name}`,
        name,
        url: null,
        fileSizeText: '--',
        fileHandle: handle as FileSystemFileHandle,
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

/**
 * 删除照片原文件并释放对应的对象地址。
 * 参数：photo 为需要永久删除的照片。
 */
export async function deletePhotoFile(photo: PhotoItem): Promise<void> {
  await photo.directoryHandle.removeEntry(photo.name)
  releasePhotoUrl(photo)
}

/**
 * 按需读取照片文件并创建可复用的对象地址。
 * 参数：photo 为待加载照片，signal 用于在调用方失效时停止接收结果。
 * 返回：照片对应的对象地址；同一照片的并发调用会共享读取任务。
 */
export async function ensurePhotoUrl(photo: PhotoItem, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted || releasedPhotos.has(photo)) throw new DOMException('Photo load cancelled', 'AbortError')
  if (photo.url) return photo.url

  let pendingLoad = pendingPhotoLoads.get(photo)
  if (!pendingLoad) {
    pendingLoad = (async () => {
      const file = await photo.fileHandle.getFile()
      if (releasedPhotos.has(photo)) throw new DOMException('Photo load cancelled', 'AbortError')

      const url = URL.createObjectURL(file)
      if (releasedPhotos.has(photo)) {
        URL.revokeObjectURL(url)
        throw new DOMException('Photo load cancelled', 'AbortError')
      }

      photo.fileSizeText = formatFileSize(file.size)
      photo.url = url
      return url
    })().finally(() => {
      pendingPhotoLoads.delete(photo)
    })
    pendingPhotoLoads.set(photo, pendingLoad)
  }

  const url = await pendingLoad
  if (signal?.aborted || releasedPhotos.has(photo)) throw new DOMException('Photo load cancelled', 'AbortError')
  return url
}

/**
 * 清除一次失败加载产生的对象地址，允许后续重新读取。
 * 参数：photo 为需要重试的照片。
 */
export function resetPhotoUrl(photo: PhotoItem): void {
  if (photo.url) URL.revokeObjectURL(photo.url)
  photo.url = null
  photo.fileSizeText = '--'
}

/**
 * 永久释放当前照片的对象地址，并阻止尚未完成的读取任务写回结果。
 * 参数：photo 为不再使用的照片。
 */
export function releasePhotoUrl(photo: PhotoItem): void {
  releasedPhotos.add(photo)
  if (photo.url) URL.revokeObjectURL(photo.url)
  photo.url = null
}

function isMissingDirectoryError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

async function getNestedDirectory(
  rootHandle: FileSystemDirectoryHandle,
  segments: string[]
): Promise<FileSystemDirectoryHandle> {
  let currentHandle = rootHandle

  for (const segment of segments) {
    currentHandle = await currentHandle.getDirectoryHandle(segment)
  }

  return currentHandle
}

async function resolveAccountDirectory(
  x6GameHandle: FileSystemDirectoryHandle,
  albumDirectoryHandle: FileSystemDirectoryHandle,
  messages: FileSystemMessages
): Promise<string> {
  if (albumDirectoryHandle.name !== HIGH_QUALITY_DIRECTORY_NAME || x6GameHandle.name !== 'X6Game') {
    throw new Error(messages.invalidX6GameDirectory)
  }

  const relativePath = await x6GameHandle.resolve(albumDirectoryHandle)
  const accountDirectoryName = relativePath?.[2] ?? ''
  const hasExpectedPath =
    relativePath?.length === 4 &&
    relativePath[0] === 'Saved' &&
    relativePath[1] === 'GamePlayPhotos' &&
    relativePath[3] === HIGH_QUALITY_DIRECTORY_NAME
  const hasValidAccountDirectory =
    Boolean(accountDirectoryName) && accountDirectoryName !== '.' && accountDirectoryName !== '..' && !/[\\/]/.test(accountDirectoryName)

  if (!hasExpectedPath || !hasValidAccountDirectory) {
    throw new Error(messages.invalidX6GameDirectory)
  }

  return accountDirectoryName
}

/**
 * 提示用户选择并授权当前相册对应的 X6Game 文件夹。
 * 参数：albumDirectoryHandle 为当前高画质相册句柄，messages 为文件系统提示文案。
 * 返回：验证通过的 X6Game 目录句柄和当前账号目录名。
 */
async function pickValidatedX6GameDirectory(
  albumDirectoryHandle: FileSystemDirectoryHandle,
  messages: FileSystemMessages,
  options: RelatedPhotoCleanupOptions = {}
): Promise<{ directoryHandle: FileSystemDirectoryHandle; accountDirectoryName: string }> {
  if (!window.showDirectoryPicker) {
    throw new Error(messages.unsupportedBrowser)
  }

  if (options.beforePickX6GameDirectory && !(await options.beforePickX6GameDirectory())) {
    throw new Error(messages.abortSelection)
  }

  const directoryHandle = await window.showDirectoryPicker({
    id: 'infinity-nikki-x6game',
    mode: 'readwrite',
    startIn: albumDirectoryHandle
  })
  const hasPermission = await ensureReadWritePermission(directoryHandle, true)

  if (!hasPermission) {
    throw new Error(messages.permissionRequired)
  }

  const accountDirectoryName = await resolveAccountDirectory(directoryHandle, albumDirectoryHandle, messages)
  await runStoreTransaction('readwrite', (store) => store.put(directoryHandle, SAVED_X6GAME_DIRECTORY_KEY))
  return { directoryHandle, accountDirectoryName }
}

async function getValidatedX6GameDirectory(
  albumDirectoryHandle: FileSystemDirectoryHandle,
  messages: FileSystemMessages,
  options: RelatedPhotoCleanupOptions = {}
): Promise<{ directoryHandle: FileSystemDirectoryHandle; accountDirectoryName: string }> {
  if (albumDirectoryHandle.name !== HIGH_QUALITY_DIRECTORY_NAME) {
    throw new Error(messages.invalidAlbumDirectory)
  }

  const savedHandle = await getSavedX6GameDirectoryHandle()

  if (savedHandle) {
    let hasPermission = await ensureReadWritePermission(savedHandle, false)

    if (!hasPermission) {
      if (options.beforeRequestX6GamePermission && !(await options.beforeRequestX6GamePermission())) {
        throw new Error(messages.abortSelection)
      }
      hasPermission = await ensureReadWritePermission(savedHandle, true)
    }

    if (hasPermission) {
      try {
        const accountDirectoryName = await resolveAccountDirectory(savedHandle, albumDirectoryHandle, messages)
        return { directoryHandle: savedHandle, accountDirectoryName }
      } catch {
        await clearSavedX6GameDirectoryHandle()
      }
    }
  }

  try {
    return await pickValidatedX6GameDirectory(albumDirectoryHandle, messages, options)
  } catch (error) {
    throw normalizeDirectoryError(error, messages)
  }
}

async function collectCleanupTarget(
  directoryName: string,
  getDirectoryHandle: () => Promise<FileSystemDirectoryHandle>,
  targets: RelatedPhotoCleanupTarget[],
  missingDirectories: string[]
): Promise<void> {
  try {
    const directoryHandle = await getDirectoryHandle()
    const photoNames: string[] = []

    for await (const [name, handle] of directoryHandle.entries()) {
      if (handle.kind === 'file' && isImageFile(name)) photoNames.push(name)
    }

    targets.push({ directoryName, directoryHandle, photoNames })
  } catch (error) {
    if (!isMissingDirectoryError(error)) throw error
    missingDirectories.push(directoryName)
  }
}

export async function prepareRelatedPhotoCleanup(
  albumDirectoryHandle: FileSystemDirectoryHandle,
  messages: FileSystemMessages,
  options: RelatedPhotoCleanupOptions = {}
): Promise<RelatedPhotoCleanupPlan> {
  const { directoryHandle: x6GameHandle, accountDirectoryName } = await getValidatedX6GameDirectory(
    albumDirectoryHandle,
    messages,
    options
  )
  const targets: RelatedPhotoCleanupTarget[] = []
  const missingDirectories: string[] = []

  await collectCleanupTarget(
    LOW_QUALITY_DIRECTORY_NAME,
    () => getNestedDirectory(x6GameHandle, ['Saved', 'GamePlayPhotos', accountDirectoryName, LOW_QUALITY_DIRECTORY_NAME]),
    targets,
    missingDirectories
  )
  await collectCleanupTarget(
    SCREENSHOT_DIRECTORY_NAME,
    () => x6GameHandle.getDirectoryHandle(SCREENSHOT_DIRECTORY_NAME),
    targets,
    missingDirectories
  )

  return {
    totalCount: targets.reduce((count, target) => count + target.photoNames.length, 0),
    missingDirectories,
    targets
  }
}

export async function executeRelatedPhotoCleanup(plan: RelatedPhotoCleanupPlan): Promise<RelatedPhotoCleanupResult> {
  let deletedCount = 0
  const failedNames: string[] = []

  for (const target of plan.targets) {
    for (const photoName of target.photoNames) {
      try {
        await target.directoryHandle.removeEntry(photoName)
        deletedCount += 1
      } catch {
        failedNames.push(`${target.directoryName}\\${photoName}`)
      }
    }
  }

  return {
    deletedCount,
    failedNames,
    missingDirectories: plan.missingDirectories
  }
}

/**
 * 批量释放不再使用的照片对象地址，并阻止旧任务写回。
 * 参数：photos 为即将离开当前相册状态的照片列表。
 */
export function releasePhotoUrls(photos: PhotoItem[]): void {
  for (const photo of photos) {
    releasePhotoUrl(photo)
  }
}
