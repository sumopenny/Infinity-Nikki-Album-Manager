import { strFromU8, Unzip, UnzipInflate, UnzipPassThrough } from 'fflate'
import { HOME_BACKUP_LIMITS, planBackupParts, downloadBackupParts, type BackupDownload } from '../backup/zipBackup'
import { writeBlob } from '../file-system/fileIO'
import { deleteHomeScheme, readHomeSchemeLibrary, saveHomeScheme, saveHomeSchemeTags } from './homeSchemeFileSystem'
import { normalizeHomeSchemeCode, normalizeHomeSchemeTag, type HomeSchemeItem, type HomeSchemeMetadata } from './homeSchemeTypes'

const BACKUP_FORMAT = 'infinity-nikki-home-scheme-backup'
const BACKUP_VERSION = 1
const MAX_BACKUP_BYTES = HOME_BACKUP_LIMITS.bytes
const MAX_IMAGE_BYTES = HOME_BACKUP_LIMITS.image
const MAX_ENTRIES = HOME_BACKUP_LIMITS.entries

interface BackupScheme {
  id: string
  image: string | null
  code: string
  name: string
  schemeType: 'home' | 'combo'
  tags: string[]
  note: string
  metadata?: HomeSchemeMetadata
  createdAt: string
  updatedAt: string
}

interface BackupManifest {
  format: string
  version: number
  exportedAt: string
  tags: string[]
  homeSchemes: BackupScheme[]
}

function isSafePath(path: string): boolean {
  return Boolean(path) && !path.startsWith('/') && !path.startsWith('\\') && !path.includes('\\') && !path.includes('\0') &&
    path.split('/').every((part) => part && part !== '.' && part !== '..')
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && value !== '.' && value !== '..' && !/[\\/\0]/.test(value)
}

function normalizeBackupMetadata(value: unknown): HomeSchemeMetadata {
  const raw = value && typeof value === 'object' ? value as Partial<HomeSchemeMetadata> : {}
  return {
    version: typeof raw.version === 'string' ? raw.version : null,
    furnitureCount: typeof raw.furnitureCount === 'number' ? raw.furnitureCount : null,
    server: typeof raw.server === 'number' ? raw.server : null,
    lastModifyTime: typeof raw.lastModifyTime === 'number' ? raw.lastModifyTime : null,
    coverImageUrl: typeof raw.coverImageUrl === 'string' ? raw.coverImageUrl : null
  }
}

function normalizeBackupDate(value: unknown, fallback: string): string {
  const timestamp = typeof value === 'string' ? Date.parse(value) : Number.NaN
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : fallback
}

function backupBaseName(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return 'InfinityNikkiHomeSchemes_' + date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' +
    pad(date.getDate()) + '_' + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds())
}

export async function exportHomeSchemeBackup(
  album: FileSystemDirectoryHandle,
  download?: BackupDownload
): Promise<{ fileNames: string[]; count: number }> {
  const library = await readHomeSchemeLibrary(album)
  try {
    if (library.failedCount) throw new Error('家园收藏读取不完整，无法导出完整备份 / Some home schemes could not be read')
    const exportedAt = new Date().toISOString()
    const items = []
    for (const scheme of library.schemes) {
      const image = scheme.image ? 'images/' + scheme.image : null
      items.push({
        record: { id: scheme.id, image, code: scheme.code, name: scheme.name, schemeType: scheme.schemeType, tags: scheme.tags, note: scheme.note, metadata: scheme.metadata, createdAt: scheme.createdAt, updatedAt: scheme.updatedAt },
        files: image && scheme.fileHandle ? [{ name: image, blob: await scheme.fileHandle.getFile() }] : []
      })
    }
    const parts = planBackupParts(items, homeSchemes => ({ format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt, tags: library.tags, homeSchemes }), 'manifest.json', HOME_BACKUP_LIMITS)
    const fileNames = await downloadBackupParts(backupBaseName(), parts, 'manifest.json', HOME_BACKUP_LIMITS, download)
    return { fileNames, count: library.schemes.length }
  } finally {
    for (const scheme of library.schemes) if (scheme.fileHandle && scheme.imageUrl) URL.revokeObjectURL(scheme.imageUrl)
  }
}

async function extractBackup(file: File): Promise<Map<string, Uint8Array>> {
  if (!file.size || file.size > MAX_BACKUP_BYTES) throw new Error('home_scheme_backup_size_invalid')
  const entries = new Map<string, Uint8Array>()
  let count = 0, expandedBytes = 0, failure: Error | null = null
  const unzip = new Unzip((entry) => {
    try {
      count += 1
      if (count > MAX_ENTRIES || !isSafePath(entry.name)) throw new Error('home_scheme_backup_path_invalid')
      const manifest = entry.name === 'manifest.json'
      if (!manifest && !/^images\/[^/]+\.webp$/i.test(entry.name)) throw new Error('home_scheme_backup_entry_invalid')
      const chunks: Uint8Array[] = []
      let size = 0
      entry.ondata = (error, chunk, final) => {
        if (error) { failure = error; entry.terminate(); return }
        if (chunk?.byteLength) {
          size += chunk.byteLength
          expandedBytes += chunk.byteLength
          if ((manifest && size > HOME_BACKUP_LIMITS.manifest) || (!manifest && size > MAX_IMAGE_BYTES) || expandedBytes > MAX_BACKUP_BYTES) {
            failure = new Error('home_scheme_backup_expanded_size_invalid')
            entry.terminate()
            return
          }
          chunks.push(chunk)
        }
        if (final && !failure) {
          if (entries.has(entry.name)) { failure = new Error('home_scheme_backup_duplicate_entry'); return }
          const bytes = new Uint8Array(size)
          let offset = 0
          for (const part of chunks) { bytes.set(part, offset); offset += part.byteLength }
          entries.set(entry.name, bytes)
        }
      }
      entry.start()
    } catch (error) {
      failure = error instanceof Error ? error : new Error('home_scheme_backup_invalid')
    }
  })
  unzip.register(UnzipInflate)
  unzip.register(UnzipPassThrough)
  const reader = file.stream().getReader()
  try {
    while (true) {
      const { value, done } = await reader.read()
      unzip.push(value ?? new Uint8Array(), done)
      if (failure) throw failure
      if (done) break
    }
  } catch (error) {
    await reader.cancel(error).catch(() => undefined)
    throw error
  } finally {
    reader.releaseLock()
  }
  return entries
}

function parseManifest(entries: Map<string, Uint8Array>): BackupManifest {
  const bytes = entries.get('manifest.json')
  if (!bytes) throw new Error('home_scheme_backup_manifest_missing')
  const raw: unknown = JSON.parse(strFromU8(bytes))
  if (!raw || typeof raw !== 'object') throw new Error('home_scheme_backup_manifest_invalid')
  const manifest = raw as Partial<BackupManifest>
  if (manifest.format !== BACKUP_FORMAT || manifest.version !== BACKUP_VERSION ||
      !Array.isArray(manifest.homeSchemes) || !Array.isArray(manifest.tags)) throw new Error('home_scheme_backup_format_unsupported')
  for (const item of manifest.homeSchemes) {
    if (!item || !isSafeId(item.id) || typeof item.name !== 'string' || typeof item.code !== 'string' ||
        (item.schemeType !== 'home' && item.schemeType !== 'combo') || !Array.isArray(item.tags) ||
        typeof item.createdAt !== 'string' || typeof item.updatedAt !== 'string' ||
        (item.image !== null && (typeof item.image !== 'string' || !isSafePath(item.image) || item.image !== `images/${item.id}.webp`))) {
      throw new Error('home_scheme_backup_record_invalid')
    }
    if (item.image && !entries.has(item.image)) throw new Error('home_scheme_backup_image_missing')
  }
  return manifest as BackupManifest
}

export async function importHomeSchemeBackup(
  album: FileSystemDirectoryHandle,
  backupFile: File
): Promise<{ addedCount: number; duplicateCount: number; failedCount: number; schemes: HomeSchemeItem[]; tags: string[] }> {
  const entries = await extractBackup(backupFile)
  const manifest = parseManifest(entries)
  // Check image payloads before reading the library, which creates object URLs.
  for (const raw of manifest.homeSchemes) {
    if (!raw.image) continue
    const bytes = entries.get(raw.image)
    if (!bytes) throw new Error('home_scheme_backup_image_missing')
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/webp' })).catch(() => null)
    if (!image) throw new Error('home_scheme_backup_image_invalid')
    image.close()
  }

  const current = await readHomeSchemeLibrary(album)
  const existingCodes = new Set(current.schemes.map((scheme) => scheme.code))
  const existingIds = new Set(current.schemes.map((scheme) => scheme.id))
  const tags = [...current.tags]
  for (const rawTag of manifest.tags) {
    const tag = normalizeHomeSchemeTag(rawTag)
    if (tag && [...tag].length <= 5 && !tags.includes(tag) && tags.length < 40) tags.push(tag)
  }
  let previousTags: File | null = null
  let hadHomeDirectory = true
  try {
    const home = await album.getDirectoryHandle('home')
    previousTags = await (await home.getFileHandle('tags.json')).getFile()
  } catch {
    try { await album.getDirectoryHandle('home') }
    catch { hadHomeDirectory = false }
  }

  const imported: HomeSchemeItem[] = []
  let duplicateCount = 0, failedCount = 0
  try {
    await saveHomeSchemeTags(album, tags)
    for (const raw of manifest.homeSchemes) {
      const code = normalizeHomeSchemeCode(raw.code)
      if (existingCodes.has(code)) { duplicateCount += 1; continue }
      if (code.length < 2 || code.length > 30 || !raw.name.trim() || typeof raw.note !== 'string' || raw.note.length > 15) {
        failedCount += 1
        continue
      }
      const imageBytes = raw.image ? entries.get(raw.image) : undefined
      const imageFile = imageBytes ? new File([imageBytes], raw.image!.split('/').pop()!, { type: 'image/webp' }) : null
      const createdAt = normalizeBackupDate(raw.createdAt, new Date().toISOString())
      const updatedAt = normalizeBackupDate(raw.updatedAt, createdAt)
      const saved = await saveHomeScheme(album, {
        id: existingIds.has(raw.id) ? undefined : raw.id,
        createdAt,
        updatedAt,
        code, name: raw.name, schemeType: raw.schemeType,
        tags: raw.tags.map(normalizeHomeSchemeTag),
        note: raw.note,
        metadata: normalizeBackupMetadata(raw.metadata),
        imageFile
      }, [...current.schemes, ...imported])
      imported.push(saved)
      existingCodes.add(code)
      existingIds.add(saved.id)
    }
    const result = await readHomeSchemeLibrary(album)
    return { addedCount: imported.length, duplicateCount, failedCount: failedCount + result.failedCount, schemes: result.schemes, tags: result.tags }
  } catch (error) {
    for (const scheme of imported) await deleteHomeScheme(scheme).catch(() => undefined)
    if (previousTags) {
      const home = await album.getDirectoryHandle('home')
      await writeBlob(await home.getFileHandle('tags.json', { create: true }), previousTags).catch(() => undefined)
    } else if (hadHomeDirectory) {
      const home = await album.getDirectoryHandle('home').catch(() => null)
      if (home) await home.removeEntry('tags.json').catch(() => undefined)
    } else {
      await album.removeEntry('home', { recursive: true }).catch(() => undefined)
    }
    throw error
  } finally {
    for (const scheme of current.schemes) if (scheme.fileHandle && scheme.imageUrl) URL.revokeObjectURL(scheme.imageUrl)
    for (const scheme of imported) if (scheme.fileHandle && scheme.imageUrl) URL.revokeObjectURL(scheme.imageUrl)
  }
}
