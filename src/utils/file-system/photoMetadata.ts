// 相片元数据：负责 album-metadata.json 的读取、校验和备注保存。
export const PHOTO_NOTE_LIMIT = 15
const ALBUM_METADATA_FILE_NAME = 'album-metadata.json'
const METADATA_WRITE_LOCK = 'infinity-nikki-album-metadata-write'

export class PhotoMetadataError extends Error {
  constructor(
    public readonly code: 'invalid' | 'changed' | 'lockUnavailable' | 'verificationFailed'
  ) {
    super(`photo_metadata_${code}`)
  }
}

export interface AlbumMetadata {
  version: 1
  photos: Record<string, { note: string }>
}

export function normalizePhotoNote(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, PHOTO_NOTE_LIMIT) : ''
}

/** 严格识别元数据格式，损坏或未知版本必须保留原文件，不能当作空库覆盖。 */
export function parseAlbumMetadata(text: string): AlbumMetadata {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new PhotoMetadataError('invalid')
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw new PhotoMetadataError('invalid')
  const raw = parsed as Partial<AlbumMetadata>
  // 兼容早期没有 version 字段的备注文件，其余结构仍需有效。
  if (
    (raw.version !== undefined && raw.version !== 1) ||
    !raw.photos ||
    typeof raw.photos !== 'object' ||
    Array.isArray(raw.photos)
  ) {
    throw new PhotoMetadataError('invalid')
  }
  for (const value of Object.values(raw.photos)) {
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      typeof value.note !== 'string'
    )
      throw new PhotoMetadataError('invalid')
  }
  return { version: 1, photos: raw.photos }
}

/** 仅文件不存在时返回空库；权限、读取及格式错误交由调用方提示。 */
async function readMetadataFile(directory: FileSystemDirectoryHandle): Promise<AlbumMetadata> {
  let file: File
  try {
    file = await (await directory.getFileHandle(ALBUM_METADATA_FILE_NAME)).getFile()
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError')
      return { version: 1, photos: {} }
    throw error
  }
  return parseAlbumMetadata(await file.text())
}

/** 展示仍使用规范化备注，保存时则读取原始有效记录以保留其他照片的数据。 */
export async function readAlbumMetadata(
  directory: FileSystemDirectoryHandle
): Promise<AlbumMetadata> {
  const metadata = await readMetadataFile(directory)
  return {
    version: 1,
    photos: Object.fromEntries(
      Object.entries(metadata.photos)
        .map(([name, value]) => [name, { note: normalizePhotoNote(value.note) }] as const)
        .filter(([, value]) => value.note)
    )
  }
}

/** 写入并回读校验元数据；失败时保留原始异常，供移动流程决定是否保留副本。 */
async function writeMetadata(
  directory: FileSystemDirectoryHandle,
  metadata: AlbumMetadata
): Promise<void> {
  const handle = await directory.getFileHandle(ALBUM_METADATA_FILE_NAME, { create: true })
  const writable = await handle.createWritable()
  try {
    await writable.write(`${JSON.stringify(metadata, null, 2)}\n`)
    await writable.close()
    if (JSON.stringify(await readMetadataFile(directory)) !== JSON.stringify(metadata))
      throw new PhotoMetadataError('verificationFailed')
  } catch (error) {
    await writable.abort(error).catch(() => undefined)
    throw error
  }
}

/** 在共享写锁内迁移备注，再删除源文件；失败恢复元数据，恢复失败则要求调用方保留目标副本。 */
export async function transferPhotoNote(
  directory: FileSystemDirectoryHandle,
  from: string | string[],
  to: string | null,
  fallback: string,
  removeSource: () => Promise<void>
): Promise<string> {
  const transfer = async () => {
    const original = await readMetadataFile(directory)
    const keys = Array.isArray(from) ? from : [from]
    const note = normalizePhotoNote(original.photos[keys[0]]?.note ?? fallback)
    const next: AlbumMetadata = { version: 1, photos: { ...original.photos } }
    for (const key of keys) delete next.photos[key]
    if (to) {
      delete next.photos[to]
      // 空备注也保留回收键，区分新回收记录与旧版按原名保存的备注。
      if (note || to.startsWith('trash/')) next.photos[to] = { note }
    }
    const changed = JSON.stringify(next) !== JSON.stringify(original)
    if (changed && !navigator.locks?.request) throw new PhotoMetadataError('lockUnavailable')
    try {
      if (changed) await writeMetadata(directory, next)
      await removeSource()
    } catch (error) {
      if (changed) {
        try {
          await writeMetadata(directory, original)
        } catch {
          throw Object.assign(new PhotoMetadataError('verificationFailed'), {
            preserveTarget: true
          })
        }
      }
      throw error
    }
    return note
  }
  return navigator.locks?.request
    ? navigator.locks.request(METADATA_WRITE_LOCK, transfer)
    : transfer()
}

/** 回收站须保留空备注键，以识别已迁移的新记录。 */
export async function readTrashNotes(
  directory: FileSystemDirectoryHandle
): Promise<Record<string, { note: string }>> {
  return (await readMetadataFile(directory)).photos
}

/** 同站点窗口共用写锁；不同目录也短暂串行，避免同名或不同句柄导致锁身份冲突。 */
export async function savePhotoNote(
  directory: FileSystemDirectoryHandle,
  photoName: string,
  note: string,
  expectedNote?: string
): Promise<string> {
  // 不用仅限当前页面的队列冒充跨窗口保护；缺少锁能力时停止写入。
  if (typeof navigator === 'undefined' || !navigator.locks?.request)
    throw new PhotoMetadataError('lockUnavailable')
  return navigator.locks.request(METADATA_WRITE_LOCK, async () => {
    const metadata = await readMetadataFile(directory)
    const currentNote = Object.hasOwn(metadata.photos, photoName)
      ? metadata.photos[photoName].note
      : ''
    if (
      expectedNote !== undefined &&
      normalizePhotoNote(currentNote) !== normalizePhotoNote(expectedNote)
    ) {
      throw new PhotoMetadataError('changed')
    }
    const normalized = normalizePhotoNote(note)
    // 保留其他照片的原始备注，只修改本次目标，避免顺手清洗造成数据损失。
    metadata.photos = { ...metadata.photos, [photoName]: { note: normalized } }
    if (!normalized) delete metadata.photos[photoName]
    await writeMetadata(directory, metadata)
    return normalized
  })
}
