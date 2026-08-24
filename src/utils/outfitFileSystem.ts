import { AsyncUnzipInflate, strFromU8, strToU8, Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough } from 'fflate'
import type { PhotoItem } from './dateGrouping'

export const DEFAULT_OUTFIT_TAGS = ['甜美', '性感', '帅气', '典雅', '清新', '古典']
export const MAX_OUTFIT_TAGS = 40
export const MAX_OUTFIT_TAG_LENGTH = 5
export const MAX_OUTFIT_CODE_LENGTH = 30
export const MAX_OUTFIT_NOTE_LENGTH = 15

const CLOTHE_DIRECTORY_NAME = 'clothe'
const TAGS_FILE_NAME = 'tags.json'
const IGNORED_SHARE_CODES_FILE_NAME = 'ignored-sharecodes.json'
const BACKUP_FORMAT = 'infinity-nikki-outfit-backup'
const BACKUP_VERSION = 1
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'])
const MAX_BACKUP_BYTES = 512 * 1024 * 1024
const MAX_IMAGE_BYTES = 64 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000
const MAX_BACKUP_ENTRIES = 2_000
const SCAN_CONCURRENCY = 6
const IMPORT_CONCURRENCY = 3

export interface OutfitItem extends PhotoItem {
  image: string
  code: string
  tags: string[]
  createdAt: string
  metadataName: string
  note?: string
}

export interface OutfitLibraryResult {
  outfits: OutfitItem[]
  tags: string[]
  importedExternalCount: number
  importedSharedCount: number
  failedCount: number
}

export interface SharedOutfitSource {
  x6GameDirectory: FileSystemDirectoryHandle
}

export interface SharedOutfitImportResult {
  importedCount: number
  duplicateCount: number
  failedCount: number
}

export interface SaveOutfitInput {
  outfit?: OutfitItem
  imageFile?: File
  code: string
  tag: string | null
  note?: string
}

export interface OutfitImportResult {
  addedCount: number
  duplicateCount: number
  failedCount: number
  rejectedTagCount: number
  library: OutfitLibraryResult
}

interface OutfitMetadata {
  id: string
  image: string
  code: string
  tags: string[]
  createdAt: string
  note?: string
}

interface BackupManifest {
  format: string
  version: number
  exportedAt: string
  tags: string[]
  outfits: OutfitMetadata[]
}

interface ScanResult {
  outfits: OutfitItem[]
  failedCount: number
  pairedImageNames: Set<string>
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length)
  let nextIndex = 0

  const runWorker = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      results[index] = await worker(items[index])
    }
  }

  const workerCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()))
  return results
}

function isMissingEntryError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

function imageExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

function isSupportedImage(fileName: string): boolean {
  return SUPPORTED_IMAGE_EXTENSIONS.has(imageExtension(fileName))
}

export function normalizeOutfitCode(value: unknown): string {
  return (typeof value === 'string' ? value : '').replace(/\s/g, '').slice(0, MAX_OUTFIT_CODE_LENGTH)
}

export function normalizeOutfitTag(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 校验用户标签长度。参数：待校验的标签；返回是否为 1 至 5 个字符。 */
export function isValidOutfitTag(value: string): boolean {
  return value.length > 0 && [...value].length <= MAX_OUTFIT_TAG_LENGTH
}

export function isReservedOutfitTag(value: string): boolean {
  return new Set(['全部', '待填写', '未分类', 'all', 'pending', 'uncategorized']).has(value.toLowerCase())
}

function normalizeTags(value: unknown, allowedTags?: Set<string>): string[] {
  if (!Array.isArray(value)) return []
  const tag = normalizeOutfitTag(value[0])
  if (!isValidOutfitTag(tag) || (allowedTags && !allowedTags.has(tag))) return []
  return [tag]
}

function createOutfitId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `outfit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isSafeOutfitId(value: string): boolean {
  return value.length > 0 && value.length <= 128 && value !== '.' && value !== '..' && !/[\\/\0]/.test(value)
}

async function createAvailableOutfitId(directory: FileSystemDirectoryHandle, preferred?: string, reservedIds?: Set<string>): Promise<string> {
  let candidate = preferred?.trim() ?? ''
  if (!isSafeOutfitId(candidate) || reservedIds?.has(candidate) || await fileExists(directory, `${candidate}.webp`) || await fileExists(directory, `${candidate}.json`)) {
    do {
      candidate = createOutfitId()
    } while (reservedIds?.has(candidate) || await fileExists(directory, `${candidate}.webp`) || await fileExists(directory, `${candidate}.json`))
  }
  return candidate
}

function dateParts(timestamp: number) {
  const date = new Date(timestamp)
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return {
    dateKey: `${year}-${month}-${day}`,
    year,
    monthDay: `${month}月${day}日`,
    displayDate: `${year}年${month}月${day}日`,
    timeText: `${hour}:${minute}`,
    timestamp
  }
}

function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

async function writeBlob(handle: FileSystemFileHandle, value: Blob | string | Uint8Array): Promise<void> {
  const writable = await handle.createWritable()
  try {
    await writable.write(value)
    await writable.close()
  } catch (error) {
    await writable.abort(error).catch(() => undefined)
    throw error
  }
}

async function writeJson(directory: FileSystemDirectoryHandle, name: string, value: unknown): Promise<void> {
  const handle = await directory.getFileHandle(name, { create: true })
  await writeBlob(handle, `${JSON.stringify(value, null, 2)}\n`)
}

async function fileExists(directory: FileSystemDirectoryHandle, name: string): Promise<boolean> {
  try {
    await directory.getFileHandle(name)
    return true
  } catch (error) {
    if (isMissingEntryError(error)) return false
    throw error
  }
}

async function getClotheDirectory(
  albumDirectory: FileSystemDirectoryHandle,
  create: boolean
): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await albumDirectory.getDirectoryHandle(CLOTHE_DIRECTORY_NAME, { create })
  } catch (error) {
    if (!create && isMissingEntryError(error)) return null
    throw error
  }
}

async function readTags(directory: FileSystemDirectoryHandle): Promise<string[]> {
  try {
    const file = await (await directory.getFileHandle(TAGS_FILE_NAME)).getFile()
    const parsed: unknown = JSON.parse(await file.text())
    if (!Array.isArray(parsed)) throw new Error('Invalid tags file')
    const result: string[] = []
    for (const item of parsed) {
      const tag = normalizeOutfitTag(item)
      if (!isValidOutfitTag(tag) || isReservedOutfitTag(tag) || result.includes(tag)) continue
      result.push(tag)
      if (result.length === MAX_OUTFIT_TAGS) break
    }
    return result
  } catch (error) {
    if (!isMissingEntryError(error)) throw error
    await writeJson(directory, TAGS_FILE_NAME, DEFAULT_OUTFIT_TAGS)
    return [...DEFAULT_OUTFIT_TAGS]
  }
}

/** 读取用户删除后临时忽略的游戏搭配码。参数：directory 为 clothe 目录。 */
async function readIgnoredShareCodes(directory: FileSystemDirectoryHandle): Promise<Set<string>> {
  try {
    const file = await (await directory.getFileHandle(IGNORED_SHARE_CODES_FILE_NAME)).getFile()
    const parsed: unknown = JSON.parse(await file.text())
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map((item) => normalizeOutfitCode(item)).filter(Boolean))
  } catch (error) {
    if (isMissingEntryError(error)) return new Set()
    return new Set()
  }
}

/** 写入用户删除后临时忽略的游戏搭配码。参数：directory 为 clothe 目录，codes 为需要保留的忽略搭配码集合。 */
async function writeIgnoredShareCodes(directory: FileSystemDirectoryHandle, codes: Set<string>): Promise<void> {
  if (!codes.size) {
    await directory.removeEntry(IGNORED_SHARE_CODES_FILE_NAME).catch(() => undefined)
    return
  }
  await writeJson(directory, IGNORED_SHARE_CODES_FILE_NAME, [...codes])
}

/** 将搭配码加入临时忽略列表。参数：directory 为 clothe 目录，code 为用户刚删除的搭配码。 */
async function ignoreShareCode(directory: FileSystemDirectoryHandle, code: string): Promise<void> {
  const normalized = normalizeOutfitCode(code)
  if (!normalized) return
  const codes = await readIgnoredShareCodes(directory)
  codes.add(normalized)
  await writeIgnoredShareCodes(directory, codes)
}

export async function saveOutfitTags(albumDirectory: FileSystemDirectoryHandle, tags: string[]): Promise<string[]> {
  const directory = await getClotheDirectory(albumDirectory, true)
  if (!directory) throw new Error('Unable to create clothe directory')
  const normalized: string[] = []
  for (const value of tags) {
    const tag = normalizeOutfitTag(value)
    if (!isValidOutfitTag(tag) || isReservedOutfitTag(tag) || normalized.includes(tag)) continue
    normalized.push(tag)
    if (normalized.length === MAX_OUTFIT_TAGS) break
  }
  await writeJson(directory, TAGS_FILE_NAME, normalized)
  return normalized
}

async function parseOutfit(
  directory: FileSystemDirectoryHandle,
  metadataName: string,
  allowedTags: Set<string>
): Promise<{ outfit: OutfitItem | null; pairedImage: string | null }> {
  const metadataHandle = await directory.getFileHandle(metadataName)
  const metadataFile = await metadataHandle.getFile()
  const parsed = JSON.parse(await metadataFile.text()) as Partial<OutfitMetadata>
  const pairedImage = typeof parsed.image === 'string' ? parsed.image : null
  if (!pairedImage || !isSupportedImage(pairedImage) || typeof parsed.id !== 'string' || !parsed.id.trim()) {
    return { outfit: null, pairedImage }
  }

  const imageHandle = await directory.getFileHandle(pairedImage)
  const imageFile = await imageHandle.getFile()
  if (!imageFile.size) return { outfit: null, pairedImage }

  const parsedTimestamp = typeof parsed.createdAt === 'string' ? Date.parse(parsed.createdAt) : Number.NaN
  const timestamp = Number.isFinite(parsedTimestamp) ? parsedTimestamp : metadataFile.lastModified
  const createdAt = new Date(timestamp).toISOString()
  const id = parsed.id.trim()
  const outfit: OutfitItem = {
    ...dateParts(timestamp),
    id,
    name: pairedImage,
    image: pairedImage,
    code: normalizeOutfitCode(parsed.code),
    tags: normalizeTags(parsed.tags, allowedTags),
    note: typeof parsed.note === 'string' ? parsed.note.trim().slice(0, MAX_OUTFIT_NOTE_LENGTH) : '',
    createdAt,
    metadataName,
    url: null,
    fileSizeText: formatFileSize(imageFile.size),
    fileHandle: imageHandle,
    directoryHandle: directory
  }
  return { outfit, pairedImage }
}

async function scanOutfits(directory: FileSystemDirectoryHandle, tags: string[]): Promise<ScanResult> {
  const metadataNames: string[] = []
  const pairedImageNames = new Set<string>()
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'file' && name.endsWith('.json') && name !== TAGS_FILE_NAME && name !== IGNORED_SHARE_CODES_FILE_NAME) metadataNames.push(name)
  }

  const outfits: OutfitItem[] = []
  let failedCount = 0
  const seenIds = new Set<string>()
  const allowedTags = new Set(tags)
  const parsedOutfits = await mapWithConcurrency(metadataNames, SCAN_CONCURRENCY, async (metadataName) => {
    try {
      return await parseOutfit(directory, metadataName, allowedTags)
    } catch {
      // 单个元数据损坏或暂时不可读时计为一次失败，不中断其余方案扫描。
      return null
    }
  })

  for (const result of parsedOutfits) {
    if (!result) {
      failedCount += 1
      continue
    }
    if (result.pairedImage) pairedImageNames.add(result.pairedImage)
    if (!result.outfit || seenIds.has(result.outfit.id)) {
      failedCount += 1
      continue
    }
    seenIds.add(result.outfit.id)
    outfits.push(result.outfit)
  }

  outfits.sort((a, b) => b.timestamp - a.timestamp)
  return { outfits, failedCount, pairedImageNames }
}

function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('WebP conversion failed')), 'image/webp', 0.9)
  })
}

export async function convertImageToWebp(file: File): Promise<Blob> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large')
  if (imageExtension(file.name) === 'webp' || file.type === 'image/webp') {
    return new Blob([await file.arrayBuffer()], { type: 'image/webp' })
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    context.drawImage(bitmap, 0, 0)
    return await canvasToWebp(canvas)
  } finally {
    bitmap.close()
  }
}

async function validateImageBlob(blob: Blob): Promise<void> {
  if (!blob.size) throw new Error('Image is empty')
  const bitmap = await createImageBitmap(blob)
  try {
    if (!bitmap.width || !bitmap.height) throw new Error('Image dimensions are invalid')
    if (bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) throw new Error('Image dimensions are too large')
  } finally {
    bitmap.close()
  }
}

async function validateWrittenImage(directory: FileSystemDirectoryHandle, name: string): Promise<void> {
  const file = await (await directory.getFileHandle(name)).getFile()
  await validateImageBlob(file)
}

async function validateWrittenFileSize(directory: FileSystemDirectoryHandle, name: string, expectedSize: number): Promise<void> {
  const file = await (await directory.getFileHandle(name)).getFile()
  if (!file.size || file.size !== expectedSize) throw new Error('Written image size is invalid')
}

/** 逐级进入游戏目录的子文件夹。参数：rootHandle 为起点目录，segments 为路径片段；缺少目录时返回 null。 */
async function findOptionalNestedDirectory(
  rootHandle: FileSystemDirectoryHandle,
  segments: string[]
): Promise<FileSystemDirectoryHandle | null> {
  let currentHandle = rootHandle
  try {
    for (const segment of segments) currentHandle = await currentHandle.getDirectoryHandle(segment)
    return currentHandle
  } catch (error) {
    if (isMissingEntryError(error)) return null
    throw error
  }
}

/** 判断文件是否为游戏搭配码历史 JSON。参数：fileName 为文件名。 */
function isShareCodeFileName(fileName: string): boolean {
  const normalized = fileName.toLowerCase()
  return normalized.includes('sharecode') && normalized.endsWith('.json')
}

/** 从 sharecode 文件名开头读取玩家 ID。参数：fileName 为 sharecode 文件名；返回玩家 ID 或 null。 */
function playerIdFromShareCodeFileName(fileName: string): string | null {
  const matched = fileName.match(/^(\d+)/)
  return matched?.[1] ?? null
}

/** 从搭配码历史内容中读取最新记录。参数：content 为 JSON 文本，playerId 为 sharecode 文件名中读取的玩家 ID。 */
function parseLatestShareCode(content: string, playerId: string): string | null {
  const parsed: unknown = JSON.parse(content)
  if (!Array.isArray(parsed)) return null
  for (let index = parsed.length - 1; index >= 0; index -= 1) {
    const item = parsed[index]
    if (!item || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const roleId = typeof record.RoleID === 'string' ? record.RoleID : String(record.RoleID ?? '')
    if (roleId && roleId !== playerId) continue
    const code = normalizeOutfitCode(record.ShareCode)
    if (code) return code
  }
  return null
}

/** 找到最近修改且可解析的搭配码历史文件。参数：shareCodeDirectory 为 ShareCode 目录。 */
async function findLatestShareCode(
  shareCodeDirectory: FileSystemDirectoryHandle
): Promise<{ code: string; playerId: string; timestamp: number } | null> {
  const candidates: Array<{ file: File; playerId: string }> = []
  for await (const [name, handle] of shareCodeDirectory.entries()) {
    const playerId = playerIdFromShareCodeFileName(name)
    if (handle.kind !== 'file' || !isShareCodeFileName(name) || !playerId) continue
    candidates.push({ file: await (handle as FileSystemFileHandle).getFile(), playerId })
  }
  candidates.sort((left, right) => right.file.lastModified - left.file.lastModified || right.file.name.localeCompare(left.file.name))
  for (const candidate of candidates) {
    try {
      const code = parseLatestShareCode(await candidate.file.text(), candidate.playerId)
      if (code) return { code, playerId: candidate.playerId, timestamp: candidate.file.lastModified || Date.now() }
    } catch {
      // 损坏的历史文件会被跳过，继续尝试时间更早的候选文件。
    }
  }
  return null
}

/** 在玩家 DIY 目录中找到最近修改的图片。参数：diyDirectory 为玩家 DIY 目录。 */
async function findLatestDiyImage(
  diyDirectory: FileSystemDirectoryHandle
): Promise<{ file: File } | null> {
  let latest: { file: File } | null = null
  for await (const [name, handle] of diyDirectory.entries()) {
    if (handle.kind !== 'file' || !isSupportedImage(name)) continue
    const file = await (handle as FileSystemFileHandle).getFile()
    if (!latest || file.lastModified > latest.file.lastModified ||
      (file.lastModified === latest.file.lastModified && file.name > latest.file.name)) {
      latest = { file }
    }
  }
  return latest
}

/** 从游戏 ShareCode 与 DIY 目录导入最新搭配方案。参数：directory 为 clothe 目录，existingOutfits 为现有方案，source 为 X6Game 授权目录，onImportStart 在确认开始写入新方案时触发。 */
async function importLatestSharedOutfit(
  directory: FileSystemDirectoryHandle,
  existingOutfits: OutfitItem[],
  source: SharedOutfitSource,
  onImportStart?: () => void
): Promise<SharedOutfitImportResult> {
  try {
    const shareCodeDirectory = await findOptionalNestedDirectory(source.x6GameDirectory, ['Saved', 'ShareCode'])
    if (!shareCodeDirectory) return { importedCount: 0, duplicateCount: 0, failedCount: 0 }
    const latestShareCode = await findLatestShareCode(shareCodeDirectory)
    if (!latestShareCode) return { importedCount: 0, duplicateCount: 0, failedCount: 0 }
    const ignoredShareCodes = await readIgnoredShareCodes(directory)
    if (ignoredShareCodes.has(latestShareCode.code)) return { importedCount: 0, duplicateCount: 0, failedCount: 0 }
    if (ignoredShareCodes.size) await writeIgnoredShareCodes(directory, new Set())
    if (existingOutfits.some((outfit) => outfit.code === latestShareCode.code)) {
      return { importedCount: 0, duplicateCount: 1, failedCount: 0 }
    }

    const diyDirectory = await findOptionalNestedDirectory(source.x6GameDirectory, ['Saved', 'DIY', latestShareCode.playerId])
    const latestImage = diyDirectory ? await findLatestDiyImage(diyDirectory) : null
    if (!latestImage) return { importedCount: 0, duplicateCount: 0, failedCount: 1 }

    // 确认要导入新方案时通知调用方，让后台静默扫描补显示“更新中”状态
    onImportStart?.()
    const id = await createAvailableOutfitId(directory, `sharecode-${latestShareCode.playerId}-${Math.floor(latestShareCode.timestamp)}`)
    const imageName = `${id}.webp`
    const metadataName = `${id}.json`
    try {
      const webp = await convertImageToWebp(latestImage.file)
      await writeBlob(await directory.getFileHandle(imageName, { create: true }), webp)
      await validateWrittenImage(directory, imageName)
      await writeJson(directory, metadataName, {
        id,
        image: imageName,
        code: latestShareCode.code,
        tags: [],
        createdAt: new Date(latestShareCode.timestamp).toISOString()
      } satisfies OutfitMetadata)
      return { importedCount: 1, duplicateCount: 0, failedCount: 0 }
    } catch (error) {
      await directory.removeEntry(imageName).catch(() => undefined)
      await directory.removeEntry(metadataName).catch(() => undefined)
      throw error
    }
  } catch {
    // 自动读取失败统一折算为一项失败，保留现有调用方的计数式反馈。
    return { importedCount: 0, duplicateCount: 0, failedCount: 1 }
  }
}

/** 把未配对的外部图片导入为待填写方案。参数：directory 为 clothe 目录，pairedImageNames 为已有方案的图片名，onImportStart 在发现待导入图片时触发。 */
async function importExternalImages(directory: FileSystemDirectoryHandle, pairedImageNames: Set<string>, onImportStart?: () => void): Promise<{ imported: number; failed: number }> {
  const candidates: Array<{ name: string; handle: FileSystemFileHandle }> = []
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'file' && isSupportedImage(name) && !pairedImageNames.has(name)) {
      candidates.push({ name, handle: handle as FileSystemFileHandle })
    }
  }
  // 发现待导入图片时通知调用方，让后台静默扫描补显示“更新中”状态
  if (candidates.length) onImportStart?.()

  const jobs: Array<{ candidate: typeof candidates[number]; id: string; imageName: string; metadataName: string }> = []
  const reservedIds = new Set<string>()
  for (const candidate of candidates) {
    const id = await createAvailableOutfitId(directory, undefined, reservedIds)
    reservedIds.add(id)
    const imageName = `${id}.webp`
    const metadataName = `${id}.json`
    jobs.push({ candidate, id, imageName, metadataName })
  }

  let imported = 0
  let failed = 0
  let nextIndex = 0
  const runWorker = async () => {
    while (nextIndex < jobs.length) {
      const index = nextIndex
      nextIndex += 1
      const { candidate, id, imageName, metadataName } = jobs[index]
      try {
        const source = await candidate.handle.getFile()
        const webp = await convertImageToWebp(source)
        await writeBlob(await directory.getFileHandle(imageName, { create: true }), webp)
        await validateWrittenImage(directory, imageName)
        const metadata: OutfitMetadata = {
          id,
          image: imageName,
          code: '',
          tags: [],
          createdAt: new Date().toISOString()
        }
        await writeJson(directory, metadataName, metadata)
        if (candidate.name !== imageName) await directory.removeEntry(candidate.name)
        imported += 1
      } catch {
        // 保留原始外部图片，并清理本轮可能写入一半的托管文件后继续处理。
        failed += 1
        await directory.removeEntry(imageName).catch(() => undefined)
        await directory.removeEntry(metadataName).catch(() => undefined)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(IMPORT_CONCURRENCY, jobs.length) }, () => runWorker()))
  return { imported, failed }
}

/** 扫描并更新搭配码库。参数：albumDirectory 为相册目录，options.onImportStart 在检测到新增导入时触发，便于调用方补显示进度。 */
export async function readOutfitLibrary(
  albumDirectory: FileSystemDirectoryHandle,
  options: { importExternal?: boolean; create?: boolean; sharedSource?: SharedOutfitSource | null; onImportStart?: () => void } = {}
): Promise<OutfitLibraryResult> {
  const directory = await getClotheDirectory(albumDirectory, options.create ?? true)
  if (!directory) return { outfits: [], tags: [...DEFAULT_OUTFIT_TAGS], importedExternalCount: 0, importedSharedCount: 0, failedCount: 0 }
  const tags = await readTags(directory)
  let scan = await scanOutfits(directory, tags)
  let importedExternalCount = 0
  let importedSharedCount = 0
  let externalFailures = 0
  let sharedFailures = 0
  if (options.importExternal ?? true) {
    const external = await importExternalImages(directory, scan.pairedImageNames, options.onImportStart)
    importedExternalCount = external.imported
    externalFailures = external.failed
    if (external.imported) scan = await scanOutfits(directory, tags)
  }
  if (options.sharedSource) {
    const shared = await importLatestSharedOutfit(directory, scan.outfits, options.sharedSource, options.onImportStart)
    importedSharedCount = shared.importedCount
    sharedFailures = shared.failedCount
    if (shared.importedCount) scan = await scanOutfits(directory, tags)
  }
  return {
    outfits: scan.outfits,
    tags,
    importedExternalCount,
    importedSharedCount,
    failedCount: scan.failedCount + externalFailures + sharedFailures
  }
}

export async function saveOutfit(
  albumDirectory: FileSystemDirectoryHandle,
  input: SaveOutfitInput
): Promise<OutfitItem> {
  const directory = await getClotheDirectory(albumDirectory, true)
  if (!directory) throw new Error('Unable to create clothe directory')
  if (!input.outfit && !input.imageFile) throw new Error('An image is required')

  const id = input.outfit?.id ?? await createAvailableOutfitId(directory)
  const imageName = `${id}.webp`
  const metadataName = `${id}.json`
  const previousImage = input.outfit ? await input.outfit.fileHandle.getFile() : null
  const previousMetadata = input.outfit
    ? await (await directory.getFileHandle(input.outfit.metadataName)).getFile()
    : null
  const tags = await readTags(directory)
  const selectedTag = input.tag && tags.includes(input.tag) && isValidOutfitTag(input.tag) ? input.tag : null

  try {
    if (input.imageFile) {
      const webp = await convertImageToWebp(input.imageFile)
      await writeBlob(await directory.getFileHandle(imageName, { create: true }), webp)
      await validateWrittenImage(directory, imageName)
    }
    const metadata: OutfitMetadata = {
      id,
      image: imageName,
      code: normalizeOutfitCode(input.code),
      tags: selectedTag ? [selectedTag] : [],
      createdAt: input.outfit?.createdAt ?? new Date().toISOString(),
      note: typeof input.note === 'string' ? input.note.trim().slice(0, MAX_OUTFIT_NOTE_LENGTH) : ''
    }
    await writeJson(directory, metadataName, metadata)
    const parsed = await parseOutfit(directory, metadataName, new Set(tags))
    if (!parsed.outfit) throw new Error('Saved outfit is invalid')
    return parsed.outfit
  } catch (error) {
    if (input.outfit && previousImage && previousMetadata) {
      await writeBlob(await directory.getFileHandle(imageName, { create: true }), previousImage).catch(() => undefined)
      await writeBlob(await directory.getFileHandle(metadataName, { create: true }), previousMetadata).catch(() => undefined)
    } else {
      await directory.removeEntry(imageName).catch(() => undefined)
      await directory.removeEntry(metadataName).catch(() => undefined)
    }
    throw error
  }
}

export async function deleteOutfitTag(
  albumDirectory: FileSystemDirectoryHandle,
  outfits: OutfitItem[],
  removedTag: string
): Promise<{ tags: string[]; updatedCount: number }> {
  const directory = await getClotheDirectory(albumDirectory, false)
  if (!directory) return { tags: [], updatedCount: 0 }
  const currentTags = await readTags(directory)
  const tagsBackup = await (await directory.getFileHandle(TAGS_FILE_NAME)).getFile()
  let updated = 0
  const backups: Array<{ name: string; file: File }> = []
  for (const outfit of outfits) {
    if (outfit.tags[0] !== removedTag) continue
    backups.push({ name: outfit.metadataName, file: await (await directory.getFileHandle(outfit.metadataName)).getFile() })
  }
  try {
    for (const outfit of outfits) {
      if (outfit.tags[0] !== removedTag) continue
      await writeJson(directory, outfit.metadataName, {
        id: outfit.id,
        image: outfit.image,
        code: outfit.code,
        tags: [],
        createdAt: outfit.createdAt
      } satisfies OutfitMetadata)
      updated += 1
    }
    const tags = currentTags.filter((tag) => tag !== removedTag)
    await writeJson(directory, TAGS_FILE_NAME, tags)
    return { tags, updatedCount: updated }
  } catch (error) {
    for (const backup of backups) await writeBlob(await directory.getFileHandle(backup.name, { create: true }), backup.file).catch(() => undefined)
    await writeBlob(await directory.getFileHandle(TAGS_FILE_NAME, { create: true }), tagsBackup).catch(() => undefined)
    throw error
  }
}

export async function deleteOutfit(outfit: OutfitItem): Promise<void> {
  const image = await outfit.fileHandle.getFile()
  const metadata = await (await outfit.directoryHandle.getFileHandle(outfit.metadataName)).getFile()
  try {
    await outfit.directoryHandle.removeEntry(outfit.metadataName)
    await outfit.directoryHandle.removeEntry(outfit.image)
    await ignoreShareCode(outfit.directoryHandle, outfit.code)
  } catch (error) {
    await writeBlob(await outfit.directoryHandle.getFileHandle(outfit.image, { create: true }), image).catch(() => undefined)
    await writeBlob(await outfit.directoryHandle.getFileHandle(outfit.metadataName, { create: true }), metadata).catch(() => undefined)
    throw error
  }
}

function backupTimestamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}

async function availableBackupName(directory: FileSystemDirectoryHandle): Promise<string> {
  const base = `无限暖暖搭配码备份_${backupTimestamp()}`
  let suffix = 0
  while (await fileExists(directory, `${base}${suffix ? `_${suffix}` : ''}.zip`)) suffix += 1
  return `${base}${suffix ? `_${suffix}` : ''}.zip`
}

export async function exportOutfitBackup(
  albumDirectory: FileSystemDirectoryHandle,
  targetDirectory: FileSystemDirectoryHandle
): Promise<{ fileName: string; count: number }> {
  const library = await readOutfitLibrary(albumDirectory, { importExternal: false, create: true })
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tags: library.tags,
    outfits: library.outfits.map(({ id, image, code, tags, createdAt }) => ({
      id,
      image: `images/${image}`,
      code,
      tags,
      createdAt
    }))
  }
  const fileName = await availableBackupName(targetDirectory)
  const targetHandle = await targetDirectory.getFileHandle(fileName, { create: true })
  const writable = await targetHandle.createWritable()
  let pendingWrite = Promise.resolve()
  let resolveArchive!: () => void
  let rejectArchive!: (error: Error) => void
  const archiveComplete = new Promise<void>((resolve, reject) => {
    resolveArchive = resolve
    rejectArchive = reject
  })
  const archive = new Zip((error, chunk, final) => {
    if (error) {
      rejectArchive(error)
      return
    }
    pendingWrite = pendingWrite.then(() => writable.write(chunk))
    if (final) pendingWrite.then(resolveArchive, rejectArchive)
  })

  const addBytes = async (name: string, bytes: Uint8Array) => {
    const entry = new ZipDeflate(name, { level: 6 })
    archive.add(entry)
    entry.push(bytes, true)
    await pendingWrite
  }

  const addFile = async (name: string, file: File) => {
    const entry = new ZipPassThrough(name)
    archive.add(entry)
    const reader = file.stream().getReader()
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        entry.push(value)
        await pendingWrite
      }
      entry.push(new Uint8Array(), true)
      await pendingWrite
    } finally {
      reader.releaseLock()
    }
  }

  try {
    await addBytes('manifest.json', strToU8(`${JSON.stringify(manifest, null, 2)}\n`))
    for (const outfit of library.outfits) {
      await addFile(`images/${outfit.image}`, await outfit.fileHandle.getFile())
    }
    archive.end()
    await archiveComplete
    await writable.close()
    return { fileName, count: library.outfits.length }
  } catch (error) {
    archive.terminate()
    void archiveComplete.catch(() => undefined)
    await writable.abort(error).catch(() => undefined)
    await targetDirectory.removeEntry(fileName).catch(() => undefined)
    throw error
  }
}

export function isSafeOutfitArchivePath(path: string): boolean {
  if (!path || path.startsWith('/') || path.startsWith('\\') || path.includes('\\') || path.includes('\0')) return false
  const segments = path.split('/')
  return segments.every((segment) => segment.length > 0 && segment !== '.' && segment !== '..')
}

async function parseBackup(file: File): Promise<{ manifest: BackupManifest; files: Record<string, Uint8Array> }> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup is too large')
  const files: Record<string, Uint8Array> = {}
  let entryCount = 0
  let declaredBytes = 0
  let expandedBytes = 0
  let extractionError: Error | null = null
  const entryTasks: Promise<void>[] = []
  const unzip = new Unzip((entry) => {
    if (extractionError) return
    try {
      entryCount += 1
      if (entryCount > MAX_BACKUP_ENTRIES) throw new Error('Backup contains too many files')
      if (!isSafeOutfitArchivePath(entry.name)) throw new Error('Backup contains an unsafe path')
      if (entry.name !== 'manifest.json' && (!entry.name.startsWith('images/') || imageExtension(entry.name) !== 'webp')) {
        throw new Error('Backup contains an unsupported file')
      }
      if (entry.originalSize !== undefined) {
        if (entry.name !== 'manifest.json' && entry.originalSize > MAX_IMAGE_BYTES) throw new Error('Backup image is too large')
        declaredBytes += entry.originalSize
        if (declaredBytes > MAX_BACKUP_BYTES) throw new Error('Expanded backup is too large')
      }

      const chunks: Uint8Array[] = []
      let entryBytes = 0
      let finishEntry!: () => void
      let entryFinished = false
      entryTasks.push(new Promise<void>((resolve) => { finishEntry = resolve }))
      const finish = () => {
        if (entryFinished) return
        entryFinished = true
        finishEntry()
      }
      entry.ondata = (error, chunk, final) => {
        if (error) {
          extractionError = error
          entry.terminate()
          finish()
          return
        }
        if (extractionError) {
          entry.terminate()
          finish()
          return
        }
        if (chunk?.length) {
          entryBytes += chunk.length
          expandedBytes += chunk.length
          if (entry.name !== 'manifest.json' && entryBytes > MAX_IMAGE_BYTES) {
            extractionError = new Error('Backup image is too large')
            entry.terminate()
            finish()
            return
          }
          if (expandedBytes > MAX_BACKUP_BYTES) {
            extractionError = new Error('Expanded backup is too large')
            entry.terminate()
            finish()
            return
          }
          chunks.push(chunk)
        }
        if (final && !extractionError) {
          const content = new Uint8Array(entryBytes)
          let offset = 0
          for (const part of chunks) {
            content.set(part, offset)
            offset += part.length
          }
          files[entry.name] = content
          finish()
        }
      }
      entry.start()
    } catch (error) {
      extractionError = error instanceof Error ? error : new Error('Unable to extract backup')
      entry.terminate()
    }
  })
  unzip.register(typeof Worker === 'function' ? AsyncUnzipInflate : UnzipInflate)

  const stream = file.stream()
  const reader = stream.getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (extractionError) throw extractionError
      unzip.push(value ?? new Uint8Array(), done)
      if (extractionError) throw extractionError
      if (done) break
    }
    await Promise.all(entryTasks)
    if (extractionError) throw extractionError
  } catch (error) {
    await reader.cancel(error).catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }

  const manifestBytes = files['manifest.json']
  if (!manifestBytes) throw new Error('Backup manifest is missing')
  const manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest
  if (!manifest || typeof manifest !== 'object' || manifest.format !== BACKUP_FORMAT || manifest.version !== BACKUP_VERSION || !Array.isArray(manifest.outfits) || !Array.isArray(manifest.tags)) {
    throw new Error('Unsupported backup format')
  }
  for (const raw of manifest.outfits) {
    if (!raw || typeof raw !== 'object' || typeof raw.image !== 'string' || !isSafeOutfitArchivePath(raw.image) || !/^images\/[^/]+\.webp$/i.test(raw.image)) {
      throw new Error('Backup contains invalid outfit metadata')
    }
    if (!files[raw.image]?.byteLength) throw new Error('Backup is missing an outfit image')
  }
  return { manifest, files }
}

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false
  }
  return true
}

async function isIdenticalOutfit(
  existing: OutfitItem,
  raw: OutfitMetadata,
  code: string,
  imageBytes: Uint8Array
): Promise<boolean> {
  const createdTimestamp = typeof raw.createdAt === 'string' ? Date.parse(raw.createdAt) : Number.NaN
  const createdAt = Number.isFinite(createdTimestamp) ? new Date(createdTimestamp).toISOString() : ''
  const rawTag = normalizeTags(raw.tags)[0] ?? ''
  if (existing.code !== code || existing.createdAt !== createdAt || (existing.tags[0] ?? '') !== rawTag) return false
  const existingBytes = new Uint8Array(await (await existing.fileHandle.getFile()).arrayBuffer())
  return bytesEqual(existingBytes, imageBytes)
}

async function listDirectoryFileNames(directory: FileSystemDirectoryHandle): Promise<Set<string>> {
  const names = new Set<string>()
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'file') names.add(name)
  }
  return names
}

function allocateImportedOutfitId(
  preferred: string | undefined,
  existingIds: Set<string>,
  occupiedFileNames: Set<string>,
  reservedIds: Set<string>
): string {
  let candidate = preferred?.trim() ?? ''
  const isUnavailable = (id: string) => !isSafeOutfitId(id) || existingIds.has(id) || reservedIds.has(id) ||
    occupiedFileNames.has(`${id}.webp`) || occupiedFileNames.has(`${id}.json`)
  if (isUnavailable(candidate)) {
    do candidate = createOutfitId()
    while (isUnavailable(candidate))
  }
  reservedIds.add(candidate)
  return candidate
}

export async function importOutfitBackup(
  albumDirectory: FileSystemDirectoryHandle,
  backupFile: File
): Promise<OutfitImportResult> {
  const { manifest, files } = await parseBackup(backupFile)
  const current = await readOutfitLibrary(albumDirectory, { importExternal: false, create: true })
  const directory = await getClotheDirectory(albumDirectory, true)
  if (!directory) throw new Error('Unable to create clothe directory')

  const tags = [...current.tags]
  let rejectedTagCount = 0
  for (const rawTag of manifest.tags) {
    const tag = normalizeOutfitTag(rawTag)
    if (!isValidOutfitTag(tag) || isReservedOutfitTag(tag) || tags.length >= MAX_OUTFIT_TAGS) {
      if (!tags.includes(tag)) rejectedTagCount += 1
      continue
    }
    if (!tags.includes(tag)) tags.push(tag)
  }
  const existingIds = new Set(current.outfits.map((outfit) => outfit.id))
  const existingById = new Map(current.outfits.map((outfit) => [outfit.id, outfit]))
  const existingCodes = new Set(current.outfits.map((outfit) => outfit.code).filter(Boolean))
  const occupiedFileNames = await listDirectoryFileNames(directory)
  const reservedIds = new Set<string>()
  const imageValidations = new Map<string, Promise<Blob | null>>()
  const validateArchiveImage = (imagePath: string): Promise<Blob | null> => {
    const existing = imageValidations.get(imagePath)
    if (existing) return existing
    const validation = (async () => {
      const imageBytes = files[imagePath]
      if (!imageBytes?.byteLength || imageBytes.byteLength > MAX_IMAGE_BYTES) return null
      const imageBlob = new Blob([imageBytes], { type: 'image/webp' })
      try {
        await validateImageBlob(imageBlob)
        return imageBlob
      } catch {
        return null
      }
    })()
    imageValidations.set(imagePath, validation)
    return validation
  }

  const resourceTails = new Map<string, Promise<void>>()
  const jobs = manifest.outfits.map((raw) => {
    const code = normalizeOutfitCode(raw.code)
    const rawId = typeof raw.id === 'string' && isSafeOutfitId(raw.id.trim()) ? raw.id.trim() : ''
    const resourceKeys = [code ? `code:${code}` : '', rawId ? `id:${rawId}` : ''].filter(Boolean)
    const dependencies = Promise.all(resourceKeys.map((key) => resourceTails.get(key))).then(() => undefined)
    let release!: () => void
    const completion = new Promise<void>((resolve) => { release = resolve })
    for (const key of resourceKeys) resourceTails.set(key, completion)
    return { raw, code, dependencies, release }
  })
  let addedCount = 0
  let duplicateCount = 0
  let failedCount = 0
  const createdEntries: string[] = []
  const createdOutfits: OutfitItem[] = []

  await mapWithConcurrency(jobs, IMPORT_CONCURRENCY, async ({ raw, code, dependencies, release }) => {
    await dependencies
    let reservedId: string | null = null
    let imageName: string | null = null
    let metadataName: string | null = null
    try {
      if (code && existingCodes.has(code)) {
        duplicateCount += 1
        return
      }
      if (typeof raw.image !== 'string' || !isSafeOutfitArchivePath(raw.image) || !raw.image.startsWith('images/')) throw new Error('Invalid image path')
      const imageBytes = files[raw.image]
      if (!imageBytes?.byteLength) throw new Error('Missing image')
      const existing = typeof raw.id === 'string' ? existingById.get(raw.id.trim()) : undefined
      if (existing && await isIdenticalOutfit(existing, raw, code, imageBytes)) {
        duplicateCount += 1
        return
      }
      const imageBlob = await validateArchiveImage(raw.image)
      if (!imageBlob) throw new Error('Invalid image')
      const preferredId = typeof raw.id === 'string' && raw.id.trim() && !existingIds.has(raw.id.trim()) ? raw.id.trim() : undefined
      const id = allocateImportedOutfitId(preferredId, existingIds, occupiedFileNames, reservedIds)
      reservedId = id
      imageName = `${id}.webp`
      metadataName = `${id}.json`
      const createdTimestamp = typeof raw.createdAt === 'string' ? Date.parse(raw.createdAt) : Number.NaN
      const tag = normalizeTags(raw.tags, new Set(tags))[0]
      const createdAt = Number.isFinite(createdTimestamp) ? new Date(createdTimestamp).toISOString() : new Date().toISOString()
      const metadata: OutfitMetadata = {
        id,
        image: imageName,
        code,
        tags: tag ? [tag] : [],
        createdAt
      }
      try {
        const imageHandle = await directory.getFileHandle(imageName, { create: true })
        await writeBlob(imageHandle, imageBlob)
        await validateWrittenFileSize(directory, imageName, imageBlob.size)
        await writeJson(directory, metadataName, metadata)
        createdOutfits.push({
          ...dateParts(Date.parse(createdAt)),
          id,
          name: imageName,
          image: imageName,
          code,
        tags: metadata.tags,
          note: metadata.note ?? '',
          createdAt,
          metadataName,
          url: null,
          fileSizeText: formatFileSize(imageBlob.size),
          fileHandle: imageHandle,
          directoryHandle: directory
        })
      } catch (error) {
        await directory.removeEntry(imageName).catch(() => undefined)
        await directory.removeEntry(metadataName).catch(() => undefined)
        throw error
      }
      existingIds.add(id)
      if (code) existingCodes.add(code)
      occupiedFileNames.add(imageName)
      occupiedFileNames.add(metadataName)
      createdEntries.push(imageName, metadataName)
      addedCount += 1
    } catch {
      failedCount += 1
      if (reservedId) reservedIds.delete(reservedId)
    } finally {
      release()
    }
  })

  let savedTags: string[]
  try {
    savedTags = await saveOutfitTags(albumDirectory, tags)
  } catch (error) {
    for (const name of createdEntries) await directory.removeEntry(name).catch(() => undefined)
    await saveOutfitTags(albumDirectory, current.tags).catch(() => undefined)
    throw error
  }

  const outfits = [...current.outfits, ...createdOutfits].sort((left, right) => right.timestamp - left.timestamp)
  return {
    addedCount,
    duplicateCount,
    failedCount,
    rejectedTagCount,
    library: {
      outfits,
      tags: savedTags,
      importedExternalCount: 0,
      importedSharedCount: 0,
      failedCount: current.failedCount + failedCount
    }
  }
}
