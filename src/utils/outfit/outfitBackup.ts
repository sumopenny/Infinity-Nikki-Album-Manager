// 搭配备份：负责 ZIP 备份导出、导入、流式解压、安全校验和重复数据识别。
import { strFromU8, strToU8, Unzip, UnzipInflate, Zip, ZipDeflate, ZipPassThrough } from 'fflate'
import { readOutfitLibrary, getClotheDirectory, saveOutfitTags } from './outfitFileSystem'
import { fileExists, writeBlob, writeJson } from './outfitStorage'
import { imageExtension, MAX_IMAGE_BYTES, validateImageBlob, validateWrittenFileSize } from './outfitImage'
import { MAX_OUTFIT_NOTE_LENGTH, MAX_OUTFIT_TAGS, isReservedOutfitTag, isValidOutfitTag, normalizeOutfitCode, normalizeOutfitTag, type OutfitImportResult, type OutfitItem } from './outfitTypes'

const BACKUP_FORMAT = 'infinity-nikki-outfit-backup'
const BACKUP_VERSION = 1
const MAX_BACKUP_BYTES = 512 * 1024 * 1024
const MAX_BACKUP_ENTRIES = 2_000
const IMPORT_CONCURRENCY = 27

interface OutfitMetadata { id: string; image: string; code: string; tags: string[]; createdAt: string; note?: string; diyImageModifiedAt?: number }
interface BackupManifest { format: string; version: number; exportedAt: string; tags: string[]; outfits: OutfitMetadata[] }

function dateParts(timestamp: number) { const date = new Date(timestamp); const year = String(date.getFullYear()); const month = String(date.getMonth() + 1).padStart(2, '0'); const day = String(date.getDate()).padStart(2, '0'); const hour = String(date.getHours()).padStart(2, '0'); const minute = String(date.getMinutes()).padStart(2, '0'); return { dateKey: `${year}-${month}-${day}`, year, monthDay: `${month}月${day}日`, displayDate: `${year}年${month}月${day}日`, timeText: `${hour}:${minute}`, timestamp } }
function formatFileSize(size: number): string { if (size < 1024) return `${size} B`; if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`; return `${(size / 1024 / 1024).toFixed(1)} MB` }
function isSafeOutfitId(value: string): boolean { return value.length > 0 && value.length <= 128 && value !== '.' && value !== '..' && !/[\\/\0]/.test(value) }
function createOutfitId(): string { if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); return `outfit-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
function normalizeTags(value: unknown, allowedTags?: Set<string>): string[] { if (!Array.isArray(value)) return []; const tag = normalizeOutfitTag(value[0]); return isValidOutfitTag(tag) && (!allowedTags || allowedTags.has(tag)) ? [tag] : [] }

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
    outfits: library.outfits.map(({ id, image, code, tags, createdAt, note, diyImageModifiedAt }) => ({
      id,
      image: `images/${image}`,
      code,
      tags,
      createdAt,
      ...(note ? { note: note.trim().slice(0, MAX_OUTFIT_NOTE_LENGTH) } : {}),
      ...(diyImageModifiedAt !== undefined ? { diyImageModifiedAt } : {})
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

type BackupEntryHandler = (name: string, content: Uint8Array | null, byteLength: number) => void | Promise<void>

/**
 * 顺序扫描 ZIP，并只为调用方关心的条目组装字节。读取循环会在处理队列达到上限时暂停，
 * 从而避免把整个解压结果同时保存在内存中。
 */
async function streamBackupEntries(
  file: File,
  shouldCollect: (name: string) => boolean,
  onEntry: BackupEntryHandler,
  concurrency = 1
): Promise<void> {
  if (file.size > MAX_BACKUP_BYTES) throw new Error('Backup is too large')
  let entryCount = 0
  let declaredBytes = 0
  let expandedBytes = 0
  let extractionError: Error | null = null
  const activeTasks = new Set<Promise<void>>()
  let activeHandlers = 0
  const handlerWaiters: Array<() => void> = []
  const acquireHandler = async () => {
    if (activeHandlers >= concurrency) await new Promise<void>((resolve) => handlerWaiters.push(resolve))
    activeHandlers += 1
  }
  const releaseHandler = () => {
    activeHandlers -= 1
    handlerWaiters.shift()?.()
  }
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

      const collect = shouldCollect(entry.name)
      const chunks: Uint8Array[] = []
      let entryBytes = 0
      entry.ondata = (error, chunk, final) => {
        if (error) {
          extractionError = error
          entry.terminate()
          return
        }
        if (extractionError) {
          entry.terminate()
          return
        }
        if (chunk?.length) {
          entryBytes += chunk.length
          expandedBytes += chunk.length
          if (entry.name !== 'manifest.json' && entryBytes > MAX_IMAGE_BYTES) {
            extractionError = new Error('Backup image is too large')
            entry.terminate()
            return
          }
          if (expandedBytes > MAX_BACKUP_BYTES) {
            extractionError = new Error('Expanded backup is too large')
            entry.terminate()
            return
          }
          if (collect) chunks.push(chunk)
        }
        if (final && !extractionError) {
          let content: Uint8Array | null = null
          if (collect) {
            content = new Uint8Array(entryBytes)
            let offset = 0
            for (const part of chunks) {
              content.set(part, offset)
              offset += part.length
            }
          }
          let task!: Promise<void>
          task = (async () => {
            await acquireHandler()
            try {
              await onEntry(entry.name, content, entryBytes)
            } finally {
              releaseHandler()
            }
          })()
            .catch((taskError) => {
              extractionError = taskError instanceof Error ? taskError : new Error('Unable to process backup')
            })
            .finally(() => activeTasks.delete(task))
          activeTasks.add(task)
        }
      }
      entry.start()
    } catch (error) {
      extractionError = error instanceof Error ? error : new Error('Unable to extract backup')
      entry.terminate()
    }
  })
  // 每次只解压输入流的当前分块，便于读取循环对异步图片写入施加背压。
  unzip.register(UnzipInflate)

  const stream = file.stream()
  const reader = stream.getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (extractionError) throw extractionError
      unzip.push(value ?? new Uint8Array(), done)
      if (extractionError) throw extractionError
      while (activeTasks.size >= concurrency) {
        await Promise.race(activeTasks)
        if (extractionError) throw extractionError
      }
      if (done) break
    }
    await Promise.all(activeTasks)
    if (extractionError) throw extractionError
  } catch (error) {
    await reader.cancel(error).catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
}

async function inspectBackup(file: File): Promise<BackupManifest> {
  let manifestBytes: Uint8Array | null = null
  const availableImages = new Set<string>()
  await streamBackupEntries(file, (name) => name === 'manifest.json', (name, content, byteLength) => {
    if (name === 'manifest.json') manifestBytes = content
    else if (byteLength > 0) availableImages.add(name)
  })

  if (!manifestBytes) throw new Error('Backup manifest is missing')
  const manifest = JSON.parse(strFromU8(manifestBytes)) as BackupManifest
  if (!manifest || typeof manifest !== 'object' || manifest.format !== BACKUP_FORMAT || manifest.version !== BACKUP_VERSION || !Array.isArray(manifest.outfits) || !Array.isArray(manifest.tags)) {
    throw new Error('Unsupported backup format')
  }
  for (const raw of manifest.outfits) {
    if (!raw || typeof raw !== 'object' || typeof raw.image !== 'string' || !isSafeOutfitArchivePath(raw.image) || !/^images\/[^/]+\.webp$/i.test(raw.image)) {
      throw new Error('Backup contains invalid outfit metadata')
    }
    if (!availableImages.has(raw.image)) throw new Error('Backup is missing an outfit image')
  }
  return manifest
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
  // 第一遍只校验结构并读取清单；确认备份完整后才创建或修改相册目录。
  const manifest = await inspectBackup(backupFile)
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

  const resourceTails = new Map<string, Promise<void>>()
  const jobs = manifest.outfits.map((raw) => {
    const code = normalizeOutfitCode(raw.code)
    const rawId = typeof raw.id === 'string' && isSafeOutfitId(raw.id.trim()) ? raw.id.trim() : ''
    const resourceKeys = [code ? `code:${code}` : '', rawId ? `id:${rawId}` : ''].filter(Boolean)
    const dependencies = Promise.all(resourceKeys.map((key) => resourceTails.get(key))).then(() => undefined)
    let release!: () => void
    const completion = new Promise<void>((resolve) => { release = resolve })
    for (const key of resourceKeys) resourceTails.set(key, completion)
    return { raw, code, imagePath: raw.image, dependencies, release }
  })
  const jobsByImage = new Map<string, typeof jobs>()
  for (const job of jobs) {
    const imageJobs = jobsByImage.get(job.imagePath) ?? []
    imageJobs.push(job)
    jobsByImage.set(job.imagePath, imageJobs)
  }
  let addedCount = 0
  let duplicateCount = 0
  let failedCount = 0
  const createdEntries: string[] = []
  const createdOutfits: OutfitItem[] = []

  const processJob = async (
    { raw, code, dependencies, release }: typeof jobs[number],
    imageBytes: Uint8Array
  ): Promise<void> => {
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
      if (!imageBytes?.byteLength) throw new Error('Missing image')
      const existing = typeof raw.id === 'string' ? existingById.get(raw.id.trim()) : undefined
      if (existing && await isIdenticalOutfit(existing, raw, code, imageBytes)) {
        duplicateCount += 1
        return
      }
      const imageBlob = new Blob([imageBytes], { type: 'image/webp' })
      await validateImageBlob(imageBlob)
      const preferredId = typeof raw.id === 'string' && raw.id.trim() && !existingIds.has(raw.id.trim()) ? raw.id.trim() : undefined
      const id = allocateImportedOutfitId(preferredId, existingIds, occupiedFileNames, reservedIds)
      reservedId = id
      imageName = `${id}.webp`
      metadataName = `${id}.json`
      const createdTimestamp = typeof raw.createdAt === 'string' ? Date.parse(raw.createdAt) : Number.NaN
      const tag = normalizeTags(raw.tags, new Set(tags))[0]
      const createdAt = Number.isFinite(createdTimestamp) ? new Date(createdTimestamp).toISOString() : new Date().toISOString()
      const note = typeof raw.note === 'string' ? raw.note.trim().slice(0, MAX_OUTFIT_NOTE_LENGTH) : ''
      const metadata: OutfitMetadata = {
        id,
        image: imageName,
        code,
        tags: tag ? [tag] : [],
        createdAt,
        note,
        ...(typeof raw.diyImageModifiedAt === 'number' ? { diyImageModifiedAt: raw.diyImageModifiedAt } : {})
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
  }

  // 第二遍只组装当前待处理图片；写入任务达到上限后暂停继续读取 ZIP。
  const processedImagePaths = new Set<string>()
  await streamBackupEntries(
    backupFile,
    (name) => jobsByImage.has(name),
    async (name, content) => {
      if (!jobsByImage.has(name)) return
      if (processedImagePaths.has(name)) return
      processedImagePaths.add(name)
      if (!content?.byteLength) throw new Error('Backup is missing an outfit image')
      const imageJobs = jobsByImage.get(name) ?? []
      // 同一图片被多条清单记录引用时复用当前字节，并按清单顺序完成去重判断。
      for (const job of imageJobs) await processJob(job, content)
    },
    IMPORT_CONCURRENCY
  )

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
