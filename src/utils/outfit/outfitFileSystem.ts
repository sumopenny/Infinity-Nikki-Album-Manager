// 搭配文件系统：负责搭配方案扫描、游戏数据导入、标签、保存和删除流程。
import { fileExists, readIgnoredShareCodes, readTags, writeBlob, writeIgnoredShareCodes, writeJson } from './outfitStorage'
import { convertImageToWebp, isSupportedImage, validateWrittenFileSize } from './outfitImage'
import {
  DEFAULT_OUTFIT_TAGS,
  MAX_OUTFIT_TAGS,
  MAX_OUTFIT_NOTE_LENGTH,
  normalizeOutfitCode,
  normalizeOutfitTag,
  isValidOutfitTag,
  isReservedOutfitTag,
  type OutfitItem,
  type OutfitLibraryResult,
  type SharedOutfitSource,
  type SharedOutfitImportResult,
  type SaveOutfitInput,
  type OutfitDeleteResult
} from './outfitTypes'

export {
  DEFAULT_OUTFIT_TAGS,
  MAX_OUTFIT_TAGS,
  MAX_OUTFIT_TAG_LENGTH,
  MAX_OUTFIT_CODE_LENGTH,
  MAX_OUTFIT_NOTE_LENGTH,
  normalizeOutfitCode,
  normalizeOutfitTag,
  isValidOutfitTag,
  isReservedOutfitTag
} from './outfitTypes'
export type { OutfitItem, OutfitLibraryResult, SharedOutfitSource, SharedOutfitImportResult, SaveOutfitInput, OutfitImportResult, OutfitDeleteResult } from './outfitTypes'
export { convertImageToWebp } from './outfitImage'

const CLOTHE_DIRECTORY_NAME = 'clothe'
const TAGS_FILE_NAME = 'tags.json'
const IGNORED_SHARE_CODES_FILE_NAME = 'ignored-sharecodes.json'
const SCAN_CONCURRENCY = 10
const IMPORT_CONCURRENCY = 27
const DELETE_BACKUP_CONCURRENCY = 6
const DELETE_FILE_CONCURRENCY = 10

interface PreparedOutfitDelete {
  outfit: OutfitItem
  image: File | null
  metadata: File | null
}

interface SuccessfulOutfitDelete extends PreparedOutfitDelete {
  image: File
  metadata: File
}

interface OutfitMetadata {
  id: string
  image: string
  code: string
  tags: string[]
  createdAt: string
  note?: string
  diyImageModifiedAt?: number
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

export async function getClotheDirectory(
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
  if (Number.isFinite(parsed.diyImageModifiedAt)) outfit.diyImageModifiedAt = parsed.diyImageModifiedAt
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
  let failureStage: SharedOutfitImportResult['failureStage']
  try {
    const shareCodeDirectory = await findOptionalNestedDirectory(source.x6GameDirectory, ['Saved', 'ShareCode'])
    if (!shareCodeDirectory) return { importedCount: 0, duplicateCount: 0, failedCount: 0 }
    const latestShareCode = await findLatestShareCode(shareCodeDirectory)
    if (!latestShareCode) return { importedCount: 0, duplicateCount: 0, failedCount: 0 }
    const ignoredShareCodes = await readIgnoredShareCodes(directory)
    if (ignoredShareCodes.has(latestShareCode.code)) return { importedCount: 0, duplicateCount: 0, failedCount: 0 }
    if (ignoredShareCodes.size) await writeIgnoredShareCodes(directory, new Set())
    if (existingOutfits.some((outfit) => outfit.code === latestShareCode.code)) {
      return { importedCount: 0, duplicateCount: 1, failedCount: 0, failureStage: 'duplicate' }
    }

    const diyDirectory = await findOptionalNestedDirectory(source.x6GameDirectory, ['Saved', 'DIY', latestShareCode.playerId])
    const latestImage = diyDirectory ? await findLatestDiyImage(diyDirectory) : null
    if (!latestImage) {
      failureStage = 'missing-image'
      return { importedCount: 0, duplicateCount: 0, failedCount: 1, failureStage }
    }
    const previousImageModifiedAt = existingOutfits.reduce((latest, outfit) => Math.max(latest, outfit.diyImageModifiedAt ?? 0), 0)
    if (previousImageModifiedAt && latestImage.file.lastModified <= previousImageModifiedAt) {
      failureStage = 'image-not-updated'
      return { importedCount: 0, duplicateCount: 0, failedCount: 1, failureStage }
    }

    // 确认要导入新方案时通知调用方，让后台静默扫描补显示“更新中”状态
    onImportStart?.()
    const id = await createAvailableOutfitId(directory, `sharecode-${latestShareCode.playerId}-${Math.floor(latestShareCode.timestamp)}`)
    const imageName = `${id}.webp`
    const metadataName = `${id}.json`
    try {
      try {
        const webp = await convertImageToWebp(latestImage.file)
        await writeBlob(await directory.getFileHandle(imageName, { create: true }), webp)
        await validateWrittenFileSize(directory, imageName, webp.size)
        await writeJson(directory, metadataName, {
          id,
          image: imageName,
          code: latestShareCode.code,
          tags: [],
          createdAt: new Date(latestShareCode.timestamp).toISOString(),
          diyImageModifiedAt: latestImage.file.lastModified
        } satisfies OutfitMetadata)
      } catch (error) {
        failureStage = 'image-write-failed'
        throw error
      }
      return { importedCount: 1, duplicateCount: 0, failedCount: 0 }
    } catch (error) {
      await directory.removeEntry(imageName).catch(() => undefined)
      await directory.removeEntry(metadataName).catch(() => undefined)
      throw error
    }
  } catch {
    // 自动读取失败统一折算为一项失败，保留现有调用方的计数式反馈。
    return { importedCount: 0, duplicateCount: 0, failedCount: 1, failureStage: failureStage ?? 'image-write-failed' }
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
        await validateWrittenFileSize(directory, imageName, webp.size)
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
    return {
      outfits: scan.outfits,
      tags,
      importedExternalCount,
      importedSharedCount,
      failedCount: scan.failedCount + externalFailures + sharedFailures,
      sharedFailureStage: shared.failureStage
    }
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
      await validateWrittenFileSize(directory, imageName, webp.size)
    }
    const metadata: OutfitMetadata = {
      id,
      image: imageName,
      code: normalizeOutfitCode(input.code),
      tags: selectedTag ? [selectedTag] : [],
      createdAt: input.outfit?.createdAt ?? new Date().toISOString(),
      note: typeof input.note === 'string' ? input.note.trim().slice(0, MAX_OUTFIT_NOTE_LENGTH) : '',
      ...(input.outfit?.diyImageModifiedAt !== undefined ? { diyImageModifiedAt: input.outfit.diyImageModifiedAt } : {})
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
        createdAt: outfit.createdAt,
        ...(outfit.diyImageModifiedAt !== undefined ? { diyImageModifiedAt: outfit.diyImageModifiedAt } : {})
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

/**
 * 批量永久删除搭配方案。先并发读取回滚备份，再并发删除双文件，最后一次性提交忽略搭配码列表。
 * 任一提交步骤失败都会恢复本批已删除文件，避免图片与元数据只删除一半。
 */
export async function deleteOutfits(outfits: OutfitItem[]): Promise<OutfitDeleteResult> {
  if (!outfits.length) return { deleted: [], failedNames: [] }

  const prepared = await mapWithConcurrency<OutfitItem, PreparedOutfitDelete>(outfits, DELETE_BACKUP_CONCURRENCY, async (outfit) => {
    try {
      const image = await outfit.fileHandle.getFile()
      const metadata = await (await outfit.directoryHandle.getFileHandle(outfit.metadataName)).getFile()
      return { outfit, image, metadata }
    } catch {
      return { outfit, image: null, metadata: null }
    }
  })
  const failedNames = prepared.filter((item) => !item.image || !item.metadata).map((item) => item.outfit.code || item.outfit.name)
  const validPrepared = prepared.filter((item): item is SuccessfulOutfitDelete => Boolean(item.image && item.metadata))
  const results = await mapWithConcurrency<SuccessfulOutfitDelete, { item: SuccessfulOutfitDelete; ok: boolean }>(validPrepared, DELETE_FILE_CONCURRENCY, async (item) => {
    try {
      await item.outfit.directoryHandle.removeEntry(item.outfit.metadataName)
      await item.outfit.directoryHandle.removeEntry(item.outfit.image)
      return { item, ok: true }
    } catch {
      await writeBlob(await item.outfit.directoryHandle.getFileHandle(item.outfit.image, { create: true }), item.image).catch(() => undefined)
      await writeBlob(await item.outfit.directoryHandle.getFileHandle(item.outfit.metadataName, { create: true }), item.metadata).catch(() => undefined)
      return { item, ok: false }
    }
  })

  const deleted = results.filter((result) => result.ok).map((result) => result.item.outfit)
  const failed = [
    ...failedNames,
    ...results.filter((result) => !result.ok).map((result) => result.item.outfit.code || result.item.outfit.name)
  ]
  if (!deleted.length) return { deleted, failedNames: failed }

  try {
    const codes = await readIgnoredShareCodes(deleted[0].directoryHandle)
    for (const outfit of deleted) {
      const code = normalizeOutfitCode(outfit.code)
      if (code) codes.add(code)
    }
    await writeIgnoredShareCodes(deleted[0].directoryHandle, codes)
  } catch (error) {
    for (const item of results.filter((result) => result.ok).map((result) => result.item)) {
      await writeBlob(await item.outfit.directoryHandle.getFileHandle(item.outfit.image, { create: true }), item.image).catch(() => undefined)
      await writeBlob(await item.outfit.directoryHandle.getFileHandle(item.outfit.metadataName, { create: true }), item.metadata).catch(() => undefined)
    }
    throw error
  }

  return { deleted, failedNames: failed }
}

export async function deleteOutfit(outfit: OutfitItem): Promise<void> {
  const result = await deleteOutfits([outfit])
  if (result.failedNames.length) throw new Error(`Unable to delete outfit: ${result.failedNames[0] || outfit.name}`)
}

