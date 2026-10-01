import { convertImageToWebp, validateWrittenFileSize } from '../outfit/outfitImage'
import { fileExists, writeBlob, writeJson } from '../outfit/outfitStorage'
import {
  isValidHomeSchemeTag,
  MAX_HOME_SCHEME_CODE_LENGTH,
  MAX_HOME_SCHEME_NOTE_LENGTH,
  MAX_HOME_SCHEME_TAGS,
  normalizeHomeSchemeCode,
  normalizeHomeSchemeTag,
  type HomeSchemeItem,
  type HomeSchemeMetadata,
  type HomeSchemeType,
  type SaveHomeSchemeInput
} from './homeSchemeTypes'

const HOME_DIRECTORY_NAME = 'home'
const TAGS_FILE_NAME = 'tags.json'
const RECORD_VERSION = 1

interface HomeSchemeRecord {
  version: number
  id: string
  image: string | null
  code: string
  name: string
  schemeType: HomeSchemeType
  metadata: HomeSchemeMetadata
  tags: string[]
  note: string
  createdAt: string
  updatedAt: string
}

function isMissing(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

function createId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `home-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128 && value !== '.' && value !== '..' && !/[\\/\0]/.test(value)
}

function safeImageName(value: unknown, id: string): value is string {
  return value === `${id}.webp`
}

function emptyMetadata(): HomeSchemeMetadata {
  return { version: null, furnitureCount: null, server: null, lastModifyTime: null, coverImageUrl: null }
}

function normalizeMetadata(value: unknown): HomeSchemeMetadata {
  const raw = value && typeof value === 'object' ? value as Partial<HomeSchemeMetadata> : {}
  return {
    version: typeof raw.version === 'string' ? raw.version : null,
    furnitureCount: typeof raw.furnitureCount === 'number' ? raw.furnitureCount : null,
    server: typeof raw.server === 'number' ? raw.server : null,
    lastModifyTime: typeof raw.lastModifyTime === 'number' ? raw.lastModifyTime : null,
    coverImageUrl: typeof raw.coverImageUrl === 'string' ? raw.coverImageUrl : null
  }
}

async function getHomeDirectory(album: FileSystemDirectoryHandle, create: boolean): Promise<FileSystemDirectoryHandle | null> {
  try {
    return await album.getDirectoryHandle(HOME_DIRECTORY_NAME, { create })
  } catch (error) {
    if (!create && isMissing(error)) return null
    throw error
  }
}

export async function countHomeSchemes(album: FileSystemDirectoryHandle): Promise<number> {
  const directory = await getHomeDirectory(album, false)
  if (!directory) return 0
  let count = 0
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind !== 'file' || !name.endsWith('.json') || name === TAGS_FILE_NAME) continue
    try {
      const fileHandle = await directory.getFileHandle(name)
      const raw = JSON.parse(await (await fileHandle.getFile()).text()) as Partial<HomeSchemeRecord>
      if (safeId(raw.id) && raw.id === name.slice(0, -5) && typeof raw.code === 'string' && typeof raw.name === 'string') count += 1
    } catch { /* Invalid records are not included in the navigation count. */ }
  }
  return count
}

async function readTagsFromHome(directory: FileSystemDirectoryHandle): Promise<string[]> {
  try {
    const raw: unknown = JSON.parse(await (await directory.getFileHandle(TAGS_FILE_NAME)).getFile().then((file) => file.text()))
    if (!Array.isArray(raw)) throw new Error('Home scheme tag file is invalid')
    const tags: string[] = []
    for (const value of raw) {
      const tag = normalizeHomeSchemeTag(value)
      if (isValidHomeSchemeTag(tag) && !tags.includes(tag)) tags.push(tag)
      if (tags.length === MAX_HOME_SCHEME_TAGS) break
    }
    return tags
  } catch (error) {
    if (!isMissing(error)) throw error
    await writeJson(directory, TAGS_FILE_NAME, [])
    return []
  }
}

export async function readHomeSchemeLibrary(album: FileSystemDirectoryHandle): Promise<{
  schemes: HomeSchemeItem[]
  tags: string[]
  failedCount: number
}> {
  const directory = await getHomeDirectory(album, false)
  if (!directory) return { schemes: [], tags: [], failedCount: 0 }
  const tags = await readTagsFromHome(directory)
  const allowedTags = new Set(tags)
  const schemes: HomeSchemeItem[] = []
  let failedCount = 0

  for await (const [name, handle] of directory.entries()) {
    if (handle.kind !== 'file' || !name.endsWith('.json') || name === TAGS_FILE_NAME) continue
    try {
      const recordFileHandle = await directory.getFileHandle(name)
      const raw: unknown = JSON.parse(await (await recordFileHandle.getFile()).text())
      if (!raw || typeof raw !== 'object') throw new Error('Invalid scheme')
      const record = raw as Partial<HomeSchemeRecord>
      if (!safeId(record.id) || record.id !== name.slice(0, -5) || typeof record.code !== 'string' ||
          typeof record.name !== 'string' || (record.schemeType !== 'home' && record.schemeType !== 'combo') ||
          typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string') throw new Error('Invalid scheme')
      const code = normalizeHomeSchemeCode(record.code)
      if (code.length < 2 || code.length > MAX_HOME_SCHEME_CODE_LENGTH) throw new Error('Invalid scheme code')
      const selectedTags = Array.isArray(record.tags)
        ? [...new Set(record.tags.map(normalizeHomeSchemeTag).filter((tag) => allowedTags.has(tag)))].slice(0, 1)
        : []
      const imageName = safeImageName(record.image, record.id) ? record.image : null
      let fileHandle: FileSystemFileHandle | null = null
      let imageUrl = normalizeMetadata(record.metadata).coverImageUrl
      if (imageName && await fileExists(directory, imageName)) {
        fileHandle = await directory.getFileHandle(imageName)
        imageUrl = URL.createObjectURL(await fileHandle.getFile())
      } else if (imageName) {
        failedCount += 1
      }
      schemes.push({
        id: record.id,
        image: fileHandle ? imageName : null,
        imageUrl,
        code,
        name: record.name.trim(),
        schemeType: record.schemeType,
        tags: selectedTags,
        note: typeof record.note === 'string' ? record.note.slice(0, MAX_HOME_SCHEME_NOTE_LENGTH) : '',
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        metadata: normalizeMetadata(record.metadata),
        fileHandle,
        directoryHandle: directory
      })
    } catch {
      failedCount += 1
    }
  }
  schemes.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  return { schemes, tags, failedCount }
}

export function releaseHomeSchemeUrls(schemes: HomeSchemeItem[]): void {
  for (const scheme of schemes) {
    if (scheme.fileHandle && scheme.imageUrl) URL.revokeObjectURL(scheme.imageUrl)
  }
}

export async function saveHomeSchemeTags(album: FileSystemDirectoryHandle, values: string[]): Promise<string[]> {
  const directory = await getHomeDirectory(album, true)
  if (!directory) throw new Error('Unable to create home directory')
  const tags: string[] = []
  for (const value of values) {
    const tag = normalizeHomeSchemeTag(value)
    if (!isValidHomeSchemeTag(tag) || tags.includes(tag)) continue
    tags.push(tag)
    if (tags.length === MAX_HOME_SCHEME_TAGS) break
  }
  await writeJson(directory, TAGS_FILE_NAME, tags)
  return tags
}

export async function saveHomeScheme(
  album: FileSystemDirectoryHandle,
  input: SaveHomeSchemeInput,
  existing: HomeSchemeItem[]
): Promise<HomeSchemeItem> {
  const code = normalizeHomeSchemeCode(input.code)
  const name = input.name.trim()
  if (code.length < 2 || code.length > MAX_HOME_SCHEME_CODE_LENGTH) throw new Error('home_scheme_code_invalid')
  if (!name) throw new Error('home_scheme_name_required')
  if (existing.some((scheme) => scheme.code === code && scheme.id !== input.item?.id)) throw new Error('home_scheme_code_duplicate')
  if (input.schemeType !== 'home' && input.schemeType !== 'combo') throw new Error('home_scheme_type_invalid')

  const directory = await getHomeDirectory(album, true)
  if (!directory) throw new Error('Unable to create home directory')
  const tags = await readTagsFromHome(directory)
  const selectedTags = input.tags.map(normalizeHomeSchemeTag).filter((tag) => tags.includes(tag) && isValidHomeSchemeTag(tag)).slice(0, 1)
  let id = input.item?.id ?? (safeId(input.id) ? input.id : createId())
  if (!input.item && input.id && await fileExists(directory, `${id}.json`)) id = createId()
  const imageName = `${id}.webp`
  const metadataName = `${id}.json`
  const oldImageName = input.item?.image ?? null
  const previousRecord = input.item
    ? await (await directory.getFileHandle(metadataName)).getFile()
    : null
  const previousImage = oldImageName
    ? await (await directory.getFileHandle(oldImageName)).getFile().catch(() => null)
    : null
  const imageFileName = input.removeImage ? null : input.imageFile ? imageName : oldImageName && previousImage ? oldImageName : null
  const record: HomeSchemeRecord = {
    version: RECORD_VERSION,
    id,
    image: imageFileName,
    code,
    name,
    schemeType: input.schemeType,
    metadata: normalizeMetadata(input.metadata),
    tags: selectedTags,
    note: input.note.trim().slice(0, MAX_HOME_SCHEME_NOTE_LENGTH),
    createdAt: input.createdAt ?? input.item?.createdAt ?? new Date().toISOString(),
    updatedAt: input.updatedAt ?? new Date().toISOString()
  }

  try {
    if (input.imageFile) {
      const webp = await convertImageToWebp(input.imageFile)
      await writeBlob(await directory.getFileHandle(imageName, { create: true }), webp)
      await validateWrittenFileSize(directory, imageName, webp.size)
    }
    await writeJson(directory, metadataName, record)
    if (oldImageName && oldImageName !== imageFileName) await directory.removeEntry(oldImageName)
  } catch (error) {
    if (previousRecord) await writeBlob(await directory.getFileHandle(metadataName, { create: true }), previousRecord).catch(() => undefined)
    else await directory.removeEntry(metadataName).catch(() => undefined)
    if (previousImage && oldImageName) await writeBlob(await directory.getFileHandle(oldImageName, { create: true }), previousImage).catch(() => undefined)
    if (!previousImage || oldImageName !== imageName) await directory.removeEntry(imageName).catch(() => undefined)
    throw error
  }

  const library = await readHomeSchemeLibrary(album)
  const saved = library.schemes.find((scheme) => scheme.id === id)
  releaseHomeSchemeUrls(library.schemes.filter((scheme) => scheme.id !== id))
  if (!saved) throw new Error('Saved home scheme could not be read')
  return saved
}

export async function deleteHomeScheme(item: HomeSchemeItem): Promise<void> {
  const recordFile = await (await item.directoryHandle.getFileHandle(`${item.id}.json`)).getFile()
  const imageFile = item.image ? await (await item.directoryHandle.getFileHandle(item.image)).getFile().catch(() => null) : null
  try {
    await item.directoryHandle.removeEntry(`${item.id}.json`)
    if (item.image) await item.directoryHandle.removeEntry(item.image)
  } catch (error) {
    await writeBlob(await item.directoryHandle.getFileHandle(`${item.id}.json`, { create: true }), recordFile).catch(() => undefined)
    if (imageFile && item.image) await writeBlob(await item.directoryHandle.getFileHandle(item.image, { create: true }), imageFile).catch(() => undefined)
    throw error
  }
}

export async function deleteHomeSchemeTag(
  album: FileSystemDirectoryHandle,
  schemes: HomeSchemeItem[],
  removedTag: string
): Promise<{ tags: string[]; updatedCount: number }> {
  const directory = await getHomeDirectory(album, false)
  if (!directory) return { tags: [], updatedCount: 0 }
  const tags = await readTagsFromHome(directory)
  const updated = schemes.filter((scheme) => scheme.tags.includes(removedTag))
  const backups = await Promise.all(updated.map(async (scheme) => ({
    name: `${scheme.id}.json`,
    file: await (await directory.getFileHandle(`${scheme.id}.json`)).getFile()
  })))
  const tagsBackup = await (await directory.getFileHandle(TAGS_FILE_NAME)).getFile()
  try {
    for (const scheme of updated) {
      const raw = JSON.parse(await (await directory.getFileHandle(`${scheme.id}.json`)).getFile().then((file) => file.text())) as HomeSchemeRecord
      await writeJson(directory, `${scheme.id}.json`, { ...raw, tags: raw.tags.filter((tag) => tag !== removedTag), updatedAt: new Date().toISOString() })
    }
    const nextTags = tags.filter((tag) => tag !== removedTag)
    await writeJson(directory, TAGS_FILE_NAME, nextTags)
    return { tags: nextTags, updatedCount: updated.length }
  } catch (error) {
    for (const backup of backups) await writeBlob(await directory.getFileHandle(backup.name, { create: true }), backup.file).catch(() => undefined)
    await writeBlob(await directory.getFileHandle(TAGS_FILE_NAME, { create: true }), tagsBackup).catch(() => undefined)
    throw error
  }
}

export async function reorderHomeSchemeTags(album: FileSystemDirectoryHandle, current: string[], reordered: string[]): Promise<string[]> {
  if (reordered.length !== current.length || new Set(reordered).size !== current.length || reordered.some((tag) => !current.includes(tag))) {
    throw new Error('home_scheme_tag_order_invalid')
  }
  return saveHomeSchemeTags(album, reordered)
}

export function createEmptyHomeSchemeMetadata(): HomeSchemeMetadata {
  return emptyMetadata()
}
