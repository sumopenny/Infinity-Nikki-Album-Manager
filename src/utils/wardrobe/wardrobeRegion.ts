import type { WardrobeCatalog } from './wardrobeCatalog'
import type { WardrobeSnapshot } from './wardrobeStorage'

export type WardrobeRegionScope = 'cn' | 'global'
// 与共鸣录 catalogAvailability 的服装区服规则一致；同名部件不能互换 ID。
const EXCLUSIVE_ITEMS: Record<string, WardrobeRegionScope> = {
  '1021720039': 'cn',
  '1021720040': 'global',
  '1021780027': 'cn',
  '1028780027': 'global'
}
export const isWardrobeItemAvailable = (id: string, scope: WardrobeRegionScope) =>
  !EXCLUSIVE_ITEMS[id] || EXCLUSIVE_ITEMS[id] === scope

/** 旧存档优先识别已拥有的国际服专属部件，否则沿用原先国服默认；不读取尚未确认的导入选择。 */
export function wardrobeRegionScope(snapshot: WardrobeSnapshot): WardrobeRegionScope {
  return (
    snapshot.regionScope ??
    (Object.entries(EXCLUSIVE_ITEMS).some(
      ([id, scope]) => scope === 'global' && snapshot.entries[id]?.owned
    )
      ? 'global'
      : 'cn')
  )
}

/** 仅过滤展示图鉴，保留底层全部 ID 和存档；列表、筛选、详情及统计共用同一视图。 */
export function wardrobeCatalogForRegion(
  catalog: WardrobeCatalog,
  scope: WardrobeRegionScope
): WardrobeCatalog {
  const entries = catalog.entries
    .filter((entry) => entry.kind !== 'item' || isWardrobeItemAvailable(entry.id, scope))
    .map((entry) =>
      entry.kind === 'outfit'
        ? { ...entry, parts: entry.parts.filter((id) => isWardrobeItemAvailable(id, scope)) }
        : entry
    )
  return { entries, byId: new Map(entries.map((entry) => [entry.id, entry])) }
}
