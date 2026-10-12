import { unzip, strFromU8 } from 'fflate'
import { CAMERA_BACKUP_LIMITS, planBackupParts, backupPartName, backupPartBlob } from '../backup/zipBackup'
import { cameraFavoriteTags, coverMetadata, validateFavorite, type FavoriteLibrary } from './favorites'

export async function* exportCameraBackup(library: FavoriteLibrary): AsyncGenerator<{ fileName: string; blob: Blob }> {
  const validRecords = library.records.map(validateFavorite)
  if (new Set(library.records.map(record => record.id)).size !== library.records.length) throw new Error('收藏 ID 重复')
  const items = []
  for (const record of validRecords) {
    const files = []
    if (record.cover) {
      const blob = library.covers.get(record.id)
      if (!blob) throw new Error('封面文件缺失，无法导出完整备份')
      const metadata = await coverMetadata(blob, record.cover.name)
      if (metadata.sha256 !== record.cover.sha256 || metadata.size !== record.cover.size) throw new Error('封面校验失败，无法导出完整备份')
      files.push({ name: 'covers/' + record.id, blob })
    }
    items.push({ record, files })
  }
  const parts = planBackupParts(items, records => ({ format: 'nikki-camera-favorites', version: 2, tags: cameraFavoriteTags(library), records }), 'favorites.json', CAMERA_BACKUP_LIMITS)
  const base = 'camera-favorites-' + new Date().toISOString().slice(0, 10)
  for (let i = 0; i < parts.length; i++) {
    yield { fileName: backupPartName(base, i, parts.length), blob: await backupPartBlob(parts[i], 'favorites.json', CAMERA_BACKUP_LIMITS) }
  }
}

export async function readCameraBackup(file: Blob): Promise<FavoriteLibrary> {
  if (file.size > CAMERA_BACKUP_LIMITS.bytes) throw new Error('备份超过 1 GB，请拆分后导入')
  let total = 0
  const names = new Set<string>()
  let invalid = false
  const files = await new Promise<Record<string, Uint8Array>>(async (resolve, reject) => {
    try {
      unzip(new Uint8Array(await file.arrayBuffer()), { filter: (entry) => {
        if (names.has(entry.name) || !/^(favorites\.json|covers\/[a-zA-Z0-9-]{1,100})$/.test(entry.name)) invalid = true
        names.add(entry.name)
        if (names.size > CAMERA_BACKUP_LIMITS.entries) invalid = true
        total += entry.originalSize
        if (total > CAMERA_BACKUP_LIMITS.bytes || entry.name === 'favorites.json' && entry.originalSize > CAMERA_BACKUP_LIMITS.manifest) invalid = true
        return !invalid
      } }, (error, data) => error ? reject(new Error('无法读取 ZIP 备份')) : resolve(data))
    } catch (error) { reject(error) }
  })
  if (invalid || !files['favorites.json']) throw new Error('备份格式无效或解压后的体积过大')
  if (Object.values(files).reduce((sum, bytes) => sum + bytes.length, 0) > CAMERA_BACKUP_LIMITS.bytes
    || files['favorites.json'].length > CAMERA_BACKUP_LIMITS.manifest) throw new Error('备份解压后的体积过大')
  const manifest = JSON.parse(strFromU8(files['favorites.json']))
  if (!manifest || manifest.format !== 'nikki-camera-favorites' || manifest.version !== 2 || !Array.isArray(manifest.records) || manifest.records.length > CAMERA_BACKUP_LIMITS.records) {
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
