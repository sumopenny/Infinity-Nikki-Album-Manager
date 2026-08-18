import { parsePhotoDate, type PhotoItem, type RecentlyDeletedPhoto } from './dateGrouping'
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
const TRASH_DIRECTORY_NAME = 'trash'
const TRASH_FILE_PREFIX = 'inam-v1__'
const SCAN_CONCURRENCY = 6
const pendingPhotoLoads = new WeakMap<PhotoItem, Promise<string>>()
const releasedPhotos = new WeakSet<PhotoItem>()

export interface AlbumDirectoryResult {
  directoryName: string
  directoryHandle: FileSystemDirectoryHandle
  photos: PhotoItem[]
}

export interface X6GameDirectoryOptions {
  beforePickX6GameDirectory?: () => boolean | Promise<boolean>
  beforeRequestX6GamePermission?: () => boolean | Promise<boolean>
  allowUnrelatedAlbum?: boolean
}

interface RelatedPhotoCleanupTarget {
  directoryName: string
  directoryHandle: FileSystemDirectoryHandle
  photoNames: string[]
}

/** 专项清理项标识：低画质图片和截图、崩溃快照、运行日志、网页缓存。 */
export type SpecialCleanupItem = 'lowQuality' | 'crashes' | 'logs' | 'webcache'

/** 目录类清理目标：保留目录本身，只删除目录内的顶层条目。 */
export interface SpecialCleanupDirectoryTarget {
  directoryName: string
  directoryHandle: FileSystemDirectoryHandle
  entries: Array<{ name: string; bytes: number; fileCount: number; sizeKnown: boolean }>
}

export interface SpecialCleanupPlan {
  item: SpecialCleanupItem
  fileCount: number
  totalBytes: number
  totalBytesKnown: boolean
  photoTargets: RelatedPhotoCleanupTarget[]
  directoryTargets: SpecialCleanupDirectoryTarget[]
  missingDirectories: string[]
}

/** 清理失败原因代码，展示层按语言翻译。 */
export type RelatedCleanupFailureReason = 'unreadable-size' | 'remove-failed'

export interface RelatedPhotoCleanupResult {
  deletedCount: number
  deletedBytes: number
  failures: Array<{ path: string; reason: RelatedCleanupFailureReason }>
  missingDirectories: string[]
}

type FileSystemMessages = LocaleMessages['fileSystem']

function isMobileDevice(): boolean {
  return /android|iphone|ipod|ipad/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
}

function getSupportedDirectoryPicker(messages: FileSystemMessages): NonNullable<typeof window.showDirectoryPicker> {
  if (isMobileDevice()) throw new Error(messages.mobileBrowserUnsupported)
  if (!window.showDirectoryPicker) throw new Error(messages.unsupportedBrowser)
  return window.showDirectoryPicker
}

function isCleanupTargetDirectory(directoryName: string): boolean {
  return directoryName === LOW_QUALITY_DIRECTORY_NAME || directoryName === SCREENSHOT_DIRECTORY_NAME
}

async function mapWithConcurrency<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index])
    }
  }

  const workerCount = Math.min(SCAN_CONCURRENCY, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}

export interface RefreshAlbumResult extends AlbumDirectoryResult {
  addedCount: number
  removedCount: number
  removedPhotos: PhotoItem[]
  replacedPhotos: PhotoItem[]
  recentlyDeleted: RecentlyDeletedPhoto[]
}

export interface TrashOperationResult<T> {
  succeeded: T[]
  failedNames: string[]
}

export interface RestoreTrashResult extends TrashOperationResult<RecentlyDeletedPhoto> {
  restoredPhotos: PhotoItem[]
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

  try {
    const photos = await scanAlbumPhotos(directoryHandle)
    return {
      directoryName: directoryHandle.name,
      directoryHandle,
      photos
    }
  } catch (error) {
    throw normalizeDirectoryError(error, options.messages)
  }
}

/**
 * 读取最近删除目录并计算每张图片大小。
 * 参数：albumDirectoryHandle 为当前相册根目录。
 * 返回：按删除时间倒序排列的最近删除照片；目录不存在时返回空数组。
 */
export async function listRecentlyDeleted(
  albumDirectoryHandle: FileSystemDirectoryHandle
): Promise<RecentlyDeletedPhoto[]> {
  let trashDirectoryHandle: FileSystemDirectoryHandle
  try {
    trashDirectoryHandle = await albumDirectoryHandle.getDirectoryHandle(TRASH_DIRECTORY_NAME)
  } catch (error) {
    if (isMissingDirectoryError(error)) return []
    throw error
  }

  const deletedPhotos: RecentlyDeletedPhoto[] = []
  for await (const [trashName, handle] of trashDirectoryHandle.entries()) {
    if (handle.kind !== 'file' || !isImageFile(trashName)) continue
    const metadata = parseTrashFileName(trashName)
    if (!metadata) continue
    const parsed = parsePhotoDate(metadata.originalName)
    if (!parsed) continue

    const fileHandle = handle as FileSystemFileHandle
    let size: number | null = null
    try {
      size = (await fileHandle.getFile()).size
    } catch {
      // 单个文件大小读取失败不影响其余回收照片展示。
    }

    deletedPhotos.push({
      id: `trash:${trashName}`,
      name: metadata.originalName,
      originalName: metadata.originalName,
      trashName,
      deletedAt: metadata.deletedAt,
      wasFavorite: metadata.wasFavorite,
      size,
      url: null,
      fileSizeText: size === null ? '--' : formatFileSize(size),
      fileHandle,
      directoryHandle: trashDirectoryHandle,
      ...parsed
    })
  }

  return deletedPhotos.sort((a, b) => b.deletedAt - a.deletedAt)
}

/**
 * 增量刷新相册并复用未变化照片的对象地址。
 * 参数：directoryHandle 为当前相册目录，currentPhotos 为页面已有照片，options 为权限和文案。
 * 返回：合并后的照片、变化数量和最近删除列表。
 */
export async function refreshAlbumDirectory(
  directoryHandle: FileSystemDirectoryHandle,
  currentPhotos: PhotoItem[],
  options: { requestPermission?: boolean; messages: FileSystemMessages }
): Promise<RefreshAlbumResult> {
  const hasPermission = await ensureReadWritePermission(directoryHandle, options.requestPermission ?? false)
  if (!hasPermission) throw new Error(options.messages.permissionRequired)

  try {
    const scannedPhotos = await scanAlbumPhotos(directoryHandle)
    const currentByName = new Map(currentPhotos.map((photo) => [photo.name, photo]))
    const scannedNames = new Set(scannedPhotos.map((photo) => photo.name))
    let addedCount = 0
    const replacedPhotos: PhotoItem[] = []
    const photos = scannedPhotos.map((photo) => {
      const existing = currentByName.get(photo.name)
      if (
        existing &&
        existing.fileSize !== undefined &&
        existing.lastModified !== undefined &&
        existing.fileSize === photo.fileSize &&
        existing.lastModified === photo.lastModified
      ) return existing
      if (existing) {
        replacedPhotos.push(existing)
        return photo
      }
      addedCount += 1
      return photo
    })
    const removedPhotos = currentPhotos.filter((photo) => !scannedNames.has(photo.name))

    return {
      directoryName: directoryHandle.name,
      directoryHandle,
      photos,
      addedCount,
      removedCount: removedPhotos.length,
      removedPhotos,
      replacedPhotos,
      recentlyDeleted: await listRecentlyDeleted(directoryHandle)
    }
  } catch (error) {
    throw normalizeDirectoryError(error, options.messages)
  }
}

/**
 * 将相册照片移动到当前相册的 trash 子目录。
 * 参数：photos 为目标照片，favoriteIds 为删除前的收藏集合。
 * 返回：成功移动的照片和失败文件名。
 */
export async function movePhotosToRecentlyDeleted(
  photos: PhotoItem[],
  favoriteIds: Set<string>
): Promise<TrashOperationResult<PhotoItem>> {
  const succeeded: PhotoItem[] = []
  const failedNames: string[] = []
  if (!photos.length) return { succeeded, failedNames }

  const albumDirectoryHandle = photos[0].directoryHandle
  const trashDirectoryHandle = await albumDirectoryHandle.getDirectoryHandle(TRASH_DIRECTORY_NAME, { create: true })

  for (const photo of photos) {
    const trashName = createTrashFileName(photo, favoriteIds.has(photo.id), Date.now())
    try {
      const sourceFile = await photo.fileHandle.getFile()
      const targetHandle = await trashDirectoryHandle.getFileHandle(trashName, { create: true })
      try {
        await copyFileToHandle(sourceFile, targetHandle)
        await photo.directoryHandle.removeEntry(photo.name)
      } catch (error) {
        await rollbackFile(trashDirectoryHandle, trashName)
        throw error
      }
      releasePhotoUrl(photo)
      succeeded.push(photo)
    } catch {
      failedNames.push(photo.name)
    }
  }

  return { succeeded, failedNames }
}

/**
 * 查找不会覆盖现有照片的恢复文件名。
 * 参数：directoryHandle 为相册目录，originalName 为原文件名。
 * 返回：原名可用时返回原名，否则返回带递增 restored 后缀的名称。
 */
async function findAvailableRestoreName(
  directoryHandle: FileSystemDirectoryHandle,
  originalName: string
): Promise<string> {
  const dotIndex = originalName.lastIndexOf('.')
  const baseName = dotIndex > 0 ? originalName.slice(0, dotIndex) : originalName
  const extension = dotIndex > 0 ? originalName.slice(dotIndex) : ''

  for (let index = 0; ; index += 1) {
    const candidate = index === 0 ? originalName : `${baseName}_restored_${index}${extension}`
    try {
      await directoryHandle.getFileHandle(candidate)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return candidate
      throw error
    }
  }
}

/**
 * 将最近删除照片恢复到当前相册。
 * 参数：photos 为待恢复照片，albumDirectoryHandle 为当前相册目录。
 * 返回：成功恢复的回收项、新照片状态和失败文件名。
 */
export async function restoreRecentlyDeletedPhotos(
  photos: RecentlyDeletedPhoto[],
  albumDirectoryHandle: FileSystemDirectoryHandle
): Promise<RestoreTrashResult> {
  const succeeded: RecentlyDeletedPhoto[] = []
  const restoredPhotos: PhotoItem[] = []
  const failedNames: string[] = []

  for (const photo of photos) {
    let restoreName = ''
    try {
      restoreName = await findAvailableRestoreName(albumDirectoryHandle, photo.originalName)
      const sourceFile = await photo.fileHandle.getFile()
      const targetHandle = await albumDirectoryHandle.getFileHandle(restoreName, { create: true })
      try {
        await copyFileToHandle(sourceFile, targetHandle)
        await photo.directoryHandle.removeEntry(photo.trashName)
      } catch (error) {
        await rollbackFile(albumDirectoryHandle, restoreName)
        throw error
      }

      const restoredPhoto = await createPhotoItem(restoreName, targetHandle, albumDirectoryHandle)
      if (!restoredPhoto) throw new Error(`Invalid restored photo name: ${restoreName}`)
      restoredPhoto.fileSizeText = formatFileSize(sourceFile.size)
      releasePhotoUrl(photo)
      succeeded.push(photo)
      restoredPhotos.push(restoredPhoto)
    } catch {
      failedNames.push(photo.originalName)
    }
  }

  return { succeeded, restoredPhotos, failedNames }
}

/**
 * 从电脑中永久删除最近删除照片。
 * 参数：photos 为待永久删除的回收照片。
 * 返回：成功删除的回收项和失败文件名。
 */
export async function permanentlyDeleteRecentlyDeleted(
  photos: RecentlyDeletedPhoto[]
): Promise<TrashOperationResult<RecentlyDeletedPhoto>> {
  const succeeded: RecentlyDeletedPhoto[] = []
  const failedNames: string[] = []

  for (const photo of photos) {
    try {
      await photo.directoryHandle.removeEntry(photo.trashName)
      releasePhotoUrl(photo)
      succeeded.push(photo)
    } catch {
      failedNames.push(photo.originalName)
    }
  }

  return { succeeded, failedNames }
}

export async function pickAlbumDirectory(messages: FileSystemMessages): Promise<AlbumDirectoryResult> {
  const showDirectoryPicker = getSupportedDirectoryPicker(messages)

  try {
    const directoryHandle = await showDirectoryPicker({
      id: 'infinity-nikki-album',
      mode: 'readwrite',
      startIn: 'pictures'
    })

    return await readAlbumDirectory(directoryHandle, { requestPermission: true, messages })
  } catch (error) {
    throw normalizeDirectoryError(error, messages)
  }
}

export { formatFileSize }

/**
 * 生成可持久解析的回收文件名。
 * 参数：photo 为原照片，wasFavorite 表示删除前是否收藏，deletedAt 为删除时间。
 * 返回：包含版本、删除时间、收藏状态和原文件名的回收文件名。
 */
function createTrashFileName(photo: PhotoItem, wasFavorite: boolean, deletedAt: number): string {
  const randomId = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `${TRASH_FILE_PREFIX}${deletedAt}__${wasFavorite ? '1' : '0'}__${randomId}__${photo.name}`
}

/**
 * 解析应用创建的回收文件名。
 * 参数：trashName 为 trash 目录中的真实文件名。
 * 返回：可恢复元数据；非应用文件返回 null。
 */
function parseTrashFileName(trashName: string): { originalName: string; deletedAt: number; wasFavorite: boolean } | null {
  const match = trashName.match(/^inam-v1__(\d+)__([01])__(?:[^_]|_(?!_))+__(.+)$/)
  if (!match) return null

  const deletedAt = Number(match[1])
  if (!Number.isFinite(deletedAt) || !match[3] || /[\\/]/.test(match[3])) return null
  return { originalName: match[3], deletedAt, wasFavorite: match[2] === '1' }
}

/**
 * 将文件完整写入目标句柄，写入失败时中止流。
 * 参数：sourceFile 为源文件，targetHandle 为目标文件句柄。
 */
async function copyFileToHandle(sourceFile: File, targetHandle: FileSystemFileHandle): Promise<void> {
  const writable = await targetHandle.createWritable()
  try {
    await writable.write(sourceFile)
    await writable.close()
  } catch (error) {
    try {
      await writable.abort(error)
    } catch {
      // 浏览器可能已经自动关闭失败的写入流。
    }
    throw error
  }
}

/**
 * 尝试移除一次失败操作留下的目标文件。
 * 参数：directoryHandle 为目标目录，fileName 为待回滚文件名。
 */
async function rollbackFile(directoryHandle: FileSystemDirectoryHandle, fileName: string): Promise<void> {
  try {
    await directoryHandle.removeEntry(fileName)
  } catch {
    // 回滚失败不覆盖触发回滚的原始错误。
  }
}

/**
 * 根据文件名和句柄创建相册照片状态。
 * 参数：name 为文件名，fileHandle 为文件句柄，directoryHandle 为所属目录。
 * 返回：符合游戏命名格式的照片；无法解析日期时返回 null。
 */
async function createPhotoItem(
  name: string,
  fileHandle: FileSystemFileHandle,
  directoryHandle: FileSystemDirectoryHandle
): Promise<PhotoItem | null> {
  const parsed = parsePhotoDate(name)
  if (!parsed) return null

  let fileSize: number | undefined
  let lastModified: number | undefined
  try {
    const file = await fileHandle.getFile()
    fileSize = file.size
    lastModified = file.lastModified
  } catch {
    // Keep unreadable files visible; loading the image will report the read failure later.
  }

  return {
    id: `${parsed.dateKey}-${parsed.timeText}-${name}`,
    name,
    url: null,
    fileSizeText: fileSize === undefined ? '--' : formatFileSize(fileSize),
    fileSize,
    lastModified,
    fileHandle,
    directoryHandle,
    ...parsed
  }
}

/**
 * 扫描相册根目录中的有效图片，不进入任何子目录。
 * 参数：directoryHandle 为当前相册目录。
 * 返回：按拍摄时间倒序排列的照片列表。
 */
async function scanAlbumPhotos(directoryHandle: FileSystemDirectoryHandle): Promise<PhotoItem[]> {
  const imageHandles: Array<{ name: string; handle: FileSystemFileHandle }> = []
  for await (const [name, handle] of directoryHandle.entries()) {
    if (handle.kind !== 'file' || !isImageFile(name)) continue
    imageHandles.push({ name, handle: handle as FileSystemFileHandle })
  }

  const scannedPhotos = await mapWithConcurrency(
    imageHandles,
    ({ name, handle }) => createPhotoItem(name, handle, directoryHandle)
  )
  const photos = scannedPhotos.filter((photo): photo is PhotoItem => Boolean(photo))
  return photos.sort((a, b) => b.timestamp - a.timestamp)
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
      photo.fileSize = file.size
      photo.lastModified = file.lastModified
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

async function getRequiredNestedDirectory(
  rootHandle: FileSystemDirectoryHandle,
  segments: string[]
): Promise<FileSystemDirectoryHandle> {
  let currentHandle = rootHandle

  for (const segment of segments) {
    currentHandle = await currentHandle.getDirectoryHandle(segment)
  }

  return currentHandle
}

export async function resolveX6GameAccountDirectory(
  x6GameHandle: FileSystemDirectoryHandle,
  albumDirectoryHandle: FileSystemDirectoryHandle,
  messages: FileSystemMessages,
  allowUnrelatedAlbum = false
): Promise<string> {
  if (x6GameHandle.name !== 'X6Game') {
    throw new Error(messages.invalidX6GameDirectory)
  }

  if (isCleanupTargetDirectory(albumDirectoryHandle.name)) {
    throw new Error(messages.invalidX6GameDirectory)
  }
  if (albumDirectoryHandle.name !== HIGH_QUALITY_DIRECTORY_NAME && allowUnrelatedAlbum) return ''

  const relativePath = await x6GameHandle.resolve(albumDirectoryHandle)
  const accountDirectoryName = relativePath?.[2] ?? ''
  const hasExpectedPath =
    relativePath?.length === 4 &&
    relativePath[0] === 'Saved' &&
    relativePath[1] === 'GamePlayPhotos' &&
    relativePath[3] === albumDirectoryHandle.name
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
  options: X6GameDirectoryOptions = {}
): Promise<{ directoryHandle: FileSystemDirectoryHandle; accountDirectoryName: string }> {
  const showDirectoryPicker = getSupportedDirectoryPicker(messages)

  if (options.beforePickX6GameDirectory && !(await options.beforePickX6GameDirectory())) {
    throw new Error(messages.abortSelection)
  }

  const directoryHandle = await showDirectoryPicker({
    id: 'infinity-nikki-x6game',
    mode: 'readwrite',
    startIn: albumDirectoryHandle
  })
  const hasPermission = await ensureReadWritePermission(directoryHandle, true)

  if (!hasPermission) {
    throw new Error(messages.permissionRequired)
  }

  const accountDirectoryName = await resolveX6GameAccountDirectory(
    directoryHandle,
    albumDirectoryHandle,
    messages,
    options.allowUnrelatedAlbum
  )
  await runStoreTransaction('readwrite', (store) => store.put(directoryHandle, SAVED_X6GAME_DIRECTORY_KEY))
  return { directoryHandle, accountDirectoryName }
}

async function getValidatedX6GameDirectory(
  albumDirectoryHandle: FileSystemDirectoryHandle,
  messages: FileSystemMessages,
  options: X6GameDirectoryOptions = {}
): Promise<{ directoryHandle: FileSystemDirectoryHandle; accountDirectoryName: string }> {
  if (isCleanupTargetDirectory(albumDirectoryHandle.name) && !options.allowUnrelatedAlbum) {
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
        const accountDirectoryName = await resolveX6GameAccountDirectory(
          savedHandle,
          albumDirectoryHandle,
          messages,
          options.allowUnrelatedAlbum
        )
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

/** 获取当前相册对应的 X6Game 目录授权。参数：albumDirectoryHandle 为当前相册，messages 为文案，options 为授权确认回调。 */
export async function getX6GameDirectoryForAlbum(
  albumDirectoryHandle: FileSystemDirectoryHandle,
  messages: FileSystemMessages,
  options: X6GameDirectoryOptions = {}
): Promise<{ directoryHandle: FileSystemDirectoryHandle; accountDirectoryName: string }> {
  return getValidatedX6GameDirectory(albumDirectoryHandle, messages, options)
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
    // 多账号场景下同目录名只记录一次，避免重复提示。
    if (!missingDirectories.includes(directoryName)) missingDirectories.push(directoryName)
  }
}

/**
 * 独立于相册授权 X6Game 文件夹，供专项清理使用。
 * 参数：messages 为文件系统提示文案，options 为授权确认回调。
 * 返回：验证通过的 X6Game 目录句柄；句柄会与搭配码授权共用同一份持久化记录。
 */
export async function pickStandaloneX6GameDirectory(
  messages: FileSystemMessages,
  options: X6GameDirectoryOptions = {}
): Promise<FileSystemDirectoryHandle> {
  const savedHandle = await getSavedX6GameDirectoryHandle()

  if (savedHandle && savedHandle.name === 'X6Game') {
    let hasPermission = await ensureReadWritePermission(savedHandle, false)

    if (!hasPermission) {
      if (options.beforeRequestX6GamePermission && !(await options.beforeRequestX6GamePermission())) {
        throw new Error(messages.abortSelection)
      }
      hasPermission = await ensureReadWritePermission(savedHandle, true)
    }

    if (hasPermission) return savedHandle
    await clearSavedX6GameDirectoryHandle()
  }

  const showDirectoryPicker = getSupportedDirectoryPicker(messages)

  try {
    if (options.beforePickX6GameDirectory && !(await options.beforePickX6GameDirectory())) {
      throw new Error(messages.abortSelection)
    }

    const directoryHandle = await showDirectoryPicker({
      id: 'infinity-nikki-x6game',
      mode: 'readwrite'
    })
    if (directoryHandle.name !== 'X6Game') {
      throw new Error(messages.invalidX6GameDirectory)
    }
    const hasPermission = await ensureReadWritePermission(directoryHandle, true)
    if (!hasPermission) {
      throw new Error(messages.permissionRequired)
    }

    await runStoreTransaction('readwrite', (store) => store.put(directoryHandle, SAVED_X6GAME_DIRECTORY_KEY))
    return directoryHandle
  } catch (error) {
    throw normalizeDirectoryError(error, messages)
  }
}

/**
 * 列出游戏拍照目录下的全部账号文件夹名。
 * 参数：x6GameHandle 为已授权的 X6Game 目录句柄。
 * 返回：Saved\GamePlayPhotos 下的子目录名列表；目录不存在时返回空数组。
 */
export async function listGamePlayPhotoAccounts(x6GameHandle: FileSystemDirectoryHandle): Promise<string[]> {
  let gamePlayPhotosHandle: FileSystemDirectoryHandle
  try {
    gamePlayPhotosHandle = await getRequiredNestedDirectory(x6GameHandle, ['Saved', 'GamePlayPhotos'])
  } catch (error) {
    if (isMissingDirectoryError(error)) return []
    throw error
  }

  const accounts: string[] = []
  for await (const [name, handle] of gamePlayPhotosHandle.entries()) {
    if (handle.kind === 'directory') accounts.push(name)
  }
  return accounts.sort()
}

/** 递归统计单个文件或目录条目的字节数和文件数；大小读取失败的文件仍计入文件数。 */
async function sumEntrySize(handle: FileSystemFileHandle | FileSystemDirectoryHandle): Promise<{ bytes: number; fileCount: number; sizeKnown: boolean }> {
  if (handle.kind === 'file') {
    try {
      const file = await (handle as FileSystemFileHandle).getFile()
      return { bytes: file.size, fileCount: 1, sizeKnown: true }
    } catch {
      // Deletion is still allowed by product design; only the size estimate is unknown.
      return { bytes: 0, fileCount: 1, sizeKnown: false }
    }
  }

  let bytes = 0
  let fileCount = 0
  let sizeKnown = true
  const children: Array<FileSystemFileHandle | FileSystemDirectoryHandle> = []
  for await (const [, childHandle] of (handle as FileSystemDirectoryHandle).entries()) {
    children.push(childHandle as FileSystemFileHandle | FileSystemDirectoryHandle)
  }
  const childSums = await mapWithConcurrency(children, sumEntrySize)
  for (const childSum of childSums) {
    bytes += childSum.bytes
    fileCount += childSum.fileCount
    sizeKnown = sizeKnown && childSum.sizeKnown
  }
  return { bytes, fileCount, sizeKnown }
}

/** 收集目录类清理目标：枚举目录内全部顶层条目并统计容量；目录不存在时记入缺失列表。 */
async function collectDirectoryCleanupTarget(
  directoryName: string,
  getDirectoryHandle: () => Promise<FileSystemDirectoryHandle>,
  targets: SpecialCleanupDirectoryTarget[],
  missingDirectories: string[]
): Promise<void> {
  try {
    const directoryHandle = await getDirectoryHandle()
    const entries: SpecialCleanupDirectoryTarget['entries'] = []

    for await (const [name, handle] of directoryHandle.entries()) {
      const { bytes, fileCount, sizeKnown } = await sumEntrySize(handle as FileSystemFileHandle | FileSystemDirectoryHandle)
      entries.push({ name, bytes, fileCount, sizeKnown })
    }

    targets.push({ directoryName, directoryHandle, entries })
  } catch (error) {
    if (!isMissingDirectoryError(error)) throw error
    if (!missingDirectories.includes(directoryName)) missingDirectories.push(directoryName)
  }
}

/** 目录类专项清理项对应的目录名与相对 X6Game 的路径。 */
const SPECIAL_CLEANUP_DIRECTORY_PATHS: Record<Exclude<SpecialCleanupItem, 'lowQuality'>, { name: string; segments: string[] }> = {
  crashes: { name: 'Crashes', segments: ['Saved', 'Crashes'] },
  logs: { name: 'Logs', segments: ['Saved', 'Logs'] },
  webcache: { name: 'webcache_4430', segments: ['Saved', 'webcache_4430'] }
}

/**
 * 构建专项清理计划。
 * 参数：x6GameHandle 为已授权的 X6Game 目录，item 为清理项，accountIds 为低画质项的目标账号 id 列表。
 * 返回：清理目标、文件数、预估释放字节数和缺失目录。
 */
export async function prepareSpecialCleanup(
  x6GameHandle: FileSystemDirectoryHandle,
  item: SpecialCleanupItem,
  accountIds: string[] = []
): Promise<SpecialCleanupPlan> {
  const photoTargets: RelatedPhotoCleanupTarget[] = []
  const directoryTargets: SpecialCleanupDirectoryTarget[] = []
  const missingDirectories: string[] = []

  if (item === 'lowQuality') {
    for (const accountId of accountIds) {
      await collectCleanupTarget(
        LOW_QUALITY_DIRECTORY_NAME,
        () => getRequiredNestedDirectory(x6GameHandle, ['Saved', 'GamePlayPhotos', accountId, LOW_QUALITY_DIRECTORY_NAME]),
        photoTargets,
        missingDirectories
      )
    }
    await collectCleanupTarget(
      SCREENSHOT_DIRECTORY_NAME,
      () => x6GameHandle.getDirectoryHandle(SCREENSHOT_DIRECTORY_NAME),
      photoTargets,
      missingDirectories
    )
  } else {
    const target = SPECIAL_CLEANUP_DIRECTORY_PATHS[item]
    await collectDirectoryCleanupTarget(
      target.name,
      () => getRequiredNestedDirectory(x6GameHandle, target.segments),
      directoryTargets,
      missingDirectories
    )
  }

  const fileCount = item === 'lowQuality'
    ? photoTargets.reduce((count, target) => count + target.photoNames.length, 0)
    : directoryTargets.reduce((count, target) => count + target.entries.reduce((sum, entry) => sum + entry.fileCount, 0), 0)
  const totalBytes = directoryTargets.reduce(
    (sum, target) => sum + target.entries.reduce((entrySum, entry) => entrySum + entry.bytes, 0),
    0
  )
  const totalBytesKnown = directoryTargets.every((target) => target.entries.every((entry) => entry.sizeKnown))

  return { item, fileCount, totalBytes, totalBytesKnown, photoTargets, directoryTargets, missingDirectories }
}

/**
 * 执行专项清理，并只累计实际成功删除的文件容量。
 * 参数：plan 为已确认的清理计划；目录类清理会保留目录本身，只删除目录内的条目。
 * 返回：成功数量、释放字节数、结构化失败原因和缺失目录。
 */
export async function executeSpecialCleanup(plan: SpecialCleanupPlan): Promise<RelatedPhotoCleanupResult> {
  let deletedCount = 0
  let deletedBytes = 0
  const failures: Array<{ path: string; reason: RelatedCleanupFailureReason }> = []

  // 低画质图片和截图：逐文件删除，文件大小读取失败时保留原文件
  for (const target of plan.photoTargets) {
    for (const photoName of target.photoNames) {
      const path = `${target.directoryName}\\${photoName}`
      let fileSize: number

      try {
        const fileHandle = await target.directoryHandle.getFileHandle(photoName)
        fileSize = (await fileHandle.getFile()).size
      } catch {
        failures.push({ path, reason: 'unreadable-size' })
        continue
      }

      try {
        await target.directoryHandle.removeEntry(photoName)
        deletedCount += 1
        deletedBytes += fileSize
      } catch {
        failures.push({ path, reason: 'remove-failed' })
      }
    }
  }

  // 目录类清理：删除目录内全部顶层条目，保留目录本身
  for (const target of plan.directoryTargets) {
    for (const entry of target.entries) {
      try {
        await target.directoryHandle.removeEntry(entry.name, { recursive: true })
        deletedCount += entry.fileCount
        deletedBytes += entry.bytes
      } catch {
        failures.push({ path: `${target.directoryName}\\${entry.name}`, reason: 'remove-failed' })
      }
    }
  }

  return {
    deletedCount,
    deletedBytes,
    failures,
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
