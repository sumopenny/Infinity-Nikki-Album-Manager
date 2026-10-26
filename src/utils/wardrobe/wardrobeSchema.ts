export type WardrobeRegionScope = 'cn' | 'global'
// 保留旧版备份的来源字段兼容性；界面不再提供手动修改入口。
export type OwnershipSource = 'manual' | 'pearpal'
export interface Ownership {
  owned: boolean
  source: OwnershipSource
}
export interface WardrobeSnapshot {
  entries: Record<string, Ownership>
  unknownSuitIds: string[]
  updatedAt: string
  imported?: boolean
  /** 可选字段兼容旧存档；只随确认后的衣橱数据及备份保存。 */
  regionScope?: WardrobeRegionScope
}
export const emptyWardrobe = (): WardrobeSnapshot => ({
  entries: {},
  unknownSuitIds: [],
  updatedAt: '',
  imported: false
})
const validId = (id: string) => /^[1-9]\d{0,14}$/.test(id) && Number.isSafeInteger(Number(id))

/** 文件及数据库使用相同校验；只投影衣橱字段，不保留凭据或任意附加对象。 */
export function validateWardrobe(value: unknown): WardrobeSnapshot {
  if (!value || typeof value !== 'object') throw new Error('INVALID_WARDROBE')
  const raw = value as WardrobeSnapshot
  if (
    !raw.entries ||
    typeof raw.entries !== 'object' ||
    Array.isArray(raw.entries) ||
    !Array.isArray(raw.unknownSuitIds) ||
    raw.unknownSuitIds.some((id) => typeof id !== 'string' || !validId(id)) ||
    (raw.imported !== undefined && typeof raw.imported !== 'boolean') ||
    (raw.regionScope !== undefined && raw.regionScope !== 'cn' && raw.regionScope !== 'global') ||
    typeof raw.updatedAt !== 'string' ||
    (raw.updatedAt !== '' && !Number.isFinite(Date.parse(raw.updatedAt)))
  )
    throw new Error('INVALID_WARDROBE')
  const entries: Record<string, Ownership> = {}
  for (const [id, entry] of Object.entries(raw.entries)) {
    if (
      !validId(id) ||
      !entry ||
      typeof entry.owned !== 'boolean' ||
      !['manual', 'pearpal'].includes(entry.source)
    )
      throw new Error('INVALID_WARDROBE')
    entries[id] = { owned: entry.owned, source: entry.source }
  }
  return {
    ...(raw.regionScope === undefined ? {} : { regionScope: raw.regionScope }),
    entries,
    unknownSuitIds: [...new Set(raw.unknownSuitIds)],
    updatedAt: raw.updatedAt,
    imported: raw.imported ?? (Object.keys(entries).length > 0 || raw.unknownSuitIds.length > 0)
  }
}

/** 有效空导入与清空状态不同；兼容旧版非空存档。 */
export function hasWardrobeSnapshot(snapshot: WardrobeSnapshot): boolean {
  return (
    !!snapshot.imported ||
    Object.keys(snapshot.entries).length > 0 ||
    snapshot.unknownSuitIds.length > 0
  )
}
/** 固定本地比较顺序，但不补齐尚未持久化的区服字段。 */
export function wardrobeBaseline(snapshot: WardrobeSnapshot): string {
  const data = validateWardrobe(snapshot)
  data.entries = Object.fromEntries(
    Object.entries(data.entries).sort(([a], [b]) => a.localeCompare(b))
  )
  data.unknownSuitIds.sort()
  return JSON.stringify(data)
}
