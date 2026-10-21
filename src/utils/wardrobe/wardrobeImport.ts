import type { WardrobeCatalog } from './wardrobeCatalog'
import { inferWardrobeFromPulls } from './wardrobeInference'
import { emptyWardrobe, type WardrobeSnapshot } from './wardrobeStorage'
import { wardrobeRegionScope, type WardrobeRegionScope } from './wardrobeRegion'

export interface WardrobeImportPreview {
  snapshot: WardrobeSnapshot
}
const safeId = (value: unknown): string | null => {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? String(id) : null
}
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}

/** 手账套装展开对应版本，并读取直接返回的部件；缺失数据不以总数补齐。 */
export function parseWardrobePearpal(
  value: unknown,
  catalog: WardrobeCatalog,
  regionScope?: WardrobeRegionScope
): WardrobeImportPreview {
  const raw = object(value),
    self = object(raw.info_from_self),
    gm = object(raw.info_from_gm)
  if (
    !Array.isArray(self.suit_list) &&
    !Array.isArray(gm.clothes) &&
    !Array.isArray(self.gacha_list) &&
    !Object.keys(object(self.gacha_list)).length
  )
    throw new Error('INVALID_PEARPAL_WARDROBE')
  const snapshot = emptyWardrobe()
  snapshot.imported = true
  const add = (id: string) => {
    const entry = catalog.byId.get(id)
    // 本模块仅处理服装；未收录服装 ID 保留，妆容和其他物品不进入衣橱。
    if (!entry && !/^102\d[0-7]\d{5}$/.test(id)) return
    if (entry && entry.kind !== 'item') return
    snapshot.entries[id] = { owned: true, source: 'pearpal' }
  }
  for (const rawId of Array.isArray(self.suit_list) ? self.suit_list : []) {
    const id = safeId(rawId)
    if (!id) continue
    const outfit = catalog.byId.get(id)
    if (outfit?.kind === 'outfit' && outfit.parts.length) outfit.parts.forEach(add)
    else snapshot.unknownSuitIds.push(id)
  }
  for (const cloth of Array.isArray(gm.clothes) ? gm.clothes : []) {
    const id = safeId(object(cloth).item_id)
    if (id) add(id)
  }
  const rows = Array.isArray(self.gacha_list)
    ? self.gacha_list
    : Object.values(object(self.gacha_list)).flatMap((value) => (Array.isArray(value) ? value : []))
  for (const row of rows) {
    const id = safeId(object(row).result)
    if (id) add(id)
  }
  inferWardrobeFromPulls(rows, catalog).forEach(add)
  snapshot.unknownSuitIds = [...new Set(snapshot.unknownSuitIds)]
  snapshot.regionScope = regionScope ?? wardrobeRegionScope(snapshot)
  return { snapshot }
}
