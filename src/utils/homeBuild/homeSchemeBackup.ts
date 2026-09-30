import { strFromU8, strToU8, Unzip, UnzipInflate, UnzipPassThrough, zipSync } from 'fflate'
import { fileExists, writeBlob } from '../outfit/outfitStorage'
import { deleteHomeScheme, readHomeSchemeLibrary, saveHomeScheme, saveHomeSchemeTags } from './homeSchemeFileSystem'
import { normalizeHomeSchemeCode, normalizeHomeSchemeTag, type HomeSchemeItem } from './homeSchemeTypes'
import { createEmptyHomeSchemeMetadata } from './homeSchemeFileSystem'

const BACKUP_FORMAT = 'infinity-nikki-home-scheme-backup'
const BACKUP_VERSION = 1
const MAX_BACKUP_BYTES = 128 * 1024 * 1024
const MAX_IMAGE_BYTES = 64 * 1024 * 1024
const MAX_ENTRIES = 500

interface BackupScheme {
  id: string
  image: string | null
  code: string
  name: string
  schemeType: 'home' | 'combo'
  tags: string[]
  note: string
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

function backupBaseName(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return 'InfinityNikkiHomeSchemes_' + date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' +
    pad(date.getDate()) + '_' + pad(date.getHours()) + pad(date.getMinutes()) + pad(date.getSeconds())
}

async function availableBackupName(directory: FileSystemDirectoryHandle): Promise<string> {
  const base = backupBaseName()
  let suffix = 0
  while (await fileExists(directory, base + (suffix ? '_' + suffix : '') + '.zip')) suffix += 1
  return base + (suffix ? '_' + suffix : '') + '.zip'
}

export async function exportHomeSchemeBackup(album: FileSystemDirectoryHandle): Promise<{ fileName: string; count: number }> {
  const library = await readHomeSchemeLibrary(album)
  const files: Record<string, Uint8Array> = {}
  const manifest: BackupManifest = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    tags: library.tags,
    homeSchemes: library.schemes.map((scheme) => ({
      id: scheme.id,
      image: scheme.image ? 'images/' + scheme.image : null,
      code: scheme.code,
      name: scheme.name,
      schemeType: scheme.schemeType,
      tags: scheme.tags,
      note: scheme.note,
      createdAt: scheme.createdAt,
      updatedAt: scheme.updatedAt
    }))
  }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2) + '\n')
  let totalBytes = files['manifest.json'].byteLength
  try {
    for (const scheme of library.schemes) {
      if (!scheme.image || !scheme.fileHandle) continue
      const bytes = new Uint8Array(await (await scheme.fileHandle.getFile()).arrayBuffer())
      totalBytes += bytes.byteLength
      if (bytes.byteLength > MAX_IMAGE_BYTES || totalBytes > MAX_BACKUP_BYTES) throw new Error('home_scheme_backup_too_large')
      files['images/' + scheme.image] = bytes
    }
    const archive = zipSync(files, { level: 6 })
    if (archive.byteLength > MAX_BACKUP_BYTES) throw new Error('home_scheme_backup_too_large')
    const fileName = await availableBackupName(album)
    try {
      await writeBlob(await album.getFileHandle(fileName, { create: true }), archive)
    } catch (error) {
      await album.removeEntry(fileName).catch(() => undefined)
      throw error
    }
    return { fileName, count: library.schemes.length }
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
          if ((manifest && size > 4 * 1024 * 1024) || (!manifest && size > MAX_IMAGE_BYTES) || expandedBytes > MAX_BACKUP_BYTES) {
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
      const saved = await saveHomeScheme(album, {
        code, name: raw.name, schemeType: raw.schemeType,
        tags: raw.tags.map(normalizeHomeSchemeTag),
        note: raw.note,
        metadata: createEmptyHomeSchemeMetadata(),
        imageFile
      }, [...current.schemes, ...imported])
      imported.push(saved)
      existingCodes.add(code)
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
