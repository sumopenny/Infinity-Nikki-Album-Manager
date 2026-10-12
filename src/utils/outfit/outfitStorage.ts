import { writeJson } from '../file-system/fileIO'
// 搭配文件存储：负责搭配目录中的 JSON 文件、标签和忽略分享码读写。
import {
  DEFAULT_OUTFIT_TAGS,
  MAX_OUTFIT_TAGS,
  normalizeOutfitCode,
  normalizeOutfitTag,
  isValidOutfitTag,
  isReservedOutfitTag
} from './outfitTypes'

const TAGS_FILE_NAME = 'tags.json'
const IGNORED_SHARE_CODES_FILE_NAME = 'ignored-sharecodes.json'

function isMissingEntryError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

export async function readTags(directory: FileSystemDirectoryHandle): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse(await (await directory.getFileHandle(TAGS_FILE_NAME)).getFile().then((file) => file.text()))
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

export async function readIgnoredShareCodes(directory: FileSystemDirectoryHandle): Promise<Set<string>> {
  try {
    const parsed: unknown = JSON.parse(await (await directory.getFileHandle(IGNORED_SHARE_CODES_FILE_NAME)).getFile().then((file) => file.text()))
    if (!Array.isArray(parsed)) throw new Error('Invalid ignored share codes file')
    return new Set(parsed.map((item) => normalizeOutfitCode(item)).filter(Boolean))
  } catch (error) {
    if (isMissingEntryError(error)) return new Set()
    throw error
  }
}

export async function writeIgnoredShareCodes(directory: FileSystemDirectoryHandle, codes: Set<string>): Promise<void> {
  if (!codes.size) {
    try { await directory.removeEntry(IGNORED_SHARE_CODES_FILE_NAME) } catch (error) { if (!isMissingEntryError(error)) throw error }
    return
  }
  await writeJson(directory, IGNORED_SHARE_CODES_FILE_NAME, [...codes])
}
