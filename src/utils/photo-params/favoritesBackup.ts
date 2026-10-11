import { zip, unzip, strToU8, strFromU8 } from 'fflate'
import { cameraFavoriteTags, coverMetadata, validateFavorite, type FavoriteLibrary } from './favorites'

export async function exportCameraBackup(library: FavoriteLibrary): Promise<Blob> {
  const files: Record<string, Uint8Array> = {}
  library.records.forEach(validateFavorite)
  for (const record of library.records) {
    if (!record.cover) continue
    const cover = library.covers.get(record.id)
    if (!cover) throw new Error('封面文件缺失，无法导出完整备份')
    files['covers/' + record.id] = new Uint8Array(await cover.arrayBuffer())
  }
  files['favorites.json'] = strToU8(JSON.stringify({ format: 'nikki-camera-favorites', version: 2, tags: cameraFavoriteTags(library), records: library.records }, null, 2))
  const bytes = await new Promise<Uint8Array>((resolve, reject) => zip(files, { level: 0 }, (error, data) => error ? reject(error) : resolve(data)))
  return new Blob([bytes.slice().buffer as ArrayBuffer], { type: 'application/zip' })
}

export async function readCameraBackup(file: Blob): Promise<FavoriteLibrary> {
  if (file.size > 1024 * 1024 * 1024) throw new Error('备份超过 1 GB，请拆分后导入')
  let total = 0
  let invalid = false
  const files = await new Promise<Record<string, Uint8Array>>(async (resolve, reject) => {
    try {
      unzip(new Uint8Array(await file.arrayBuffer()), { filter: (entry) => {
        total += entry.originalSize
        if (total > 1024 * 1024 * 1024 || entry.name === 'favorites.json' && entry.originalSize > 20 * 1024 * 1024) invalid = true
        return !invalid
      } }, (error, data) => error ? reject(new Error('无法读取 ZIP 备份')) : resolve(data))
    } catch (error) { reject(error) }
  })
  if (invalid || !files['favorites.json']) throw new Error('备份格式无效或解压后的体积过大')
  const manifest = JSON.parse(strFromU8(files['favorites.json']))
  if (!manifest || manifest.format !== 'nikki-camera-favorites' || manifest.version !== 2 || !Array.isArray(manifest.records) || manifest.records.length > 10000) {
    throw new Error('不支持此备份格式或版本')
  }
  const records = manifest.records.map(validateFavorite)
  if (!Array.isArray(manifest.tags) || manifest.tags.length > 10040
    || !manifest.tags.every((tag: unknown) => typeof tag === 'string' && !!tag.trim() && tag.length <= 60)
    || new Set(manifest.tags).size !== manifest.tags.length) throw new Error('备份标签列表损坏')
  const tags = cameraFavoriteTags({ records, tags: manifest.tags })
  const ids = new Set<string>()
  const covers = new Map<string, Blob>()
  for (const record of records) {
    if (ids.has(record.id)) throw new Error('备份包含重复记录 ID')
    ids.add(record.id)
    if (!record.cover) continue
    const bytes = files['covers/' + record.id]
    if (!bytes) throw new Error('备份封面缺失')
    const cover = new Blob([bytes.slice().buffer as ArrayBuffer], { type: record.cover.type })
    const metadata = await coverMetadata(cover, record.cover.name)
    if (metadata.size !== record.cover.size || metadata.sha256 !== record.cover.sha256) throw new Error('备份封面校验失败')
    covers.set(record.id, cover)
  }
  return { records, covers, tags }
}
