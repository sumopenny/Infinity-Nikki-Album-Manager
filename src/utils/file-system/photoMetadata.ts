// 相片元数据：负责 album-metadata.json 的读取、校验和备注保存。
export const PHOTO_NOTE_LIMIT = 15
const ALBUM_METADATA_FILE_NAME = 'album-metadata.json'

export interface AlbumMetadata {
  version: 1
  photos: Record<string, { note: string }>
}

export function normalizePhotoNote(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, PHOTO_NOTE_LIMIT) : ''
}

export async function readAlbumMetadata(directory: FileSystemDirectoryHandle): Promise<AlbumMetadata> {
  try {
    const file = await (await directory.getFileHandle(ALBUM_METADATA_FILE_NAME)).getFile()
    const parsed = JSON.parse(await file.text()) as Partial<AlbumMetadata>
    const photos: Record<string, { note: string }> = {}
    if (parsed.photos && typeof parsed.photos === 'object') {
      for (const [name, value] of Object.entries(parsed.photos)) {
        const note = normalizePhotoNote((value as { note?: unknown })?.note)
        if (note) photos[name] = { note }
      }
    }
    return { version: 1, photos }
  } catch (error) {
    if (error instanceof DOMException && error.name !== 'NotFoundError') throw error
    return { version: 1, photos: {} }
  }
}

export async function savePhotoNote(directory: FileSystemDirectoryHandle, photoName: string, note: string): Promise<string> {
  const metadata = await readAlbumMetadata(directory)
  const normalized = normalizePhotoNote(note)
  if (normalized) metadata.photos[photoName] = { note: normalized }
  else delete metadata.photos[photoName]
  const handle = await directory.getFileHandle(ALBUM_METADATA_FILE_NAME, { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(`${JSON.stringify(metadata, null, 2)}\n`)
    await writable.close()
    // 写入后立即回读，避免浏览器权限或目录句柄异常时页面误报保存成功。
    const savedFile = await (await directory.getFileHandle(ALBUM_METADATA_FILE_NAME)).getFile()
    const saved = JSON.parse(await savedFile.text()) as Partial<AlbumMetadata>
    if (!saved || saved.version !== 1 || !saved.photos || typeof saved.photos !== 'object') {
      throw new Error('Saved album metadata failed validation')
    }
    return normalized
  } catch (error) {
    await writable.abort(error).catch(() => undefined)
    throw error
  }
}
