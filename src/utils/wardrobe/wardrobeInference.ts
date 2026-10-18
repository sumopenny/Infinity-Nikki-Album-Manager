import banners from '../../data/gongeo/banners.json'
import type { WardrobeCatalog } from './wardrobeCatalog'

interface TrackerBanner {
  bannerId: number
  bannerType: number
  outfit4StarId: string[]
  outfit5StarId: string[]
  rewardIds?: string[]
}

/** 复用共鸣录的服装推断规则；常驻卡池不推断进化或奖励。 */
export function inferWardrobeFromPulls(
  rows: readonly unknown[],
  catalog: WardrobeCatalog
): string[] {
  const groups = new Map<string, { total: number; items: Set<string> }>()
  for (const value of rows) {
    if (!value || typeof value !== 'object') continue
    const row = value as Record<string, unknown>
    const bannerId = String(row.card_pool_id ?? '')
    const count = Number(row.pool_cnt)
    if (
      row.pool_cnt === null ||
      row.pool_cnt === undefined ||
      row.pool_cnt === '' ||
      !Number.isSafeInteger(count) ||
      count < 0
    )
      continue
    const group = groups.get(bannerId) ?? { total: 0, items: new Set<string>() }
    group.total = Math.max(group.total, count + 1)
    group.items.add(String(row.result))
    groups.set(bannerId, group)
  }
  const result = new Set<string>()
  const add = (id: string) => {
    if (catalog.byId.get(id)?.kind === 'item') result.add(id)
  }
  for (const banner of banners as TrackerBanner[]) {
    const group = groups.get(String(banner.bannerId))
    if (!group || banner.bannerType === 1) continue
    if (banner.bannerType === 3) {
      banner.rewardIds?.slice(0, Math.floor(group.total / 5)).forEach(add)
    }
    for (const id of [...banner.outfit5StarId, ...banner.outfit4StarId]) {
      const outfit = catalog.byId.get(id)
      // 手账与共鸣录 processPearpalData 一致，按出现过的部件判定一套集齐，
      // 不把重复手账行当成第二套，也不以 suit_list 代替卡池完成度。
      if (!outfit?.parts.length || !outfit.parts.every((part) => group.items.has(part))) continue
      const base = id.length === 7 ? id.slice(0, 5) : id
      const variants = [base, base + '01']
      if (banner.outfit5StarId.includes(id)) {
        if (group.total >= 180) variants.push(base + '02')
        if (group.total >= 230) variants.push(base + '03')
      }
      for (const variant of variants) catalog.byId.get(variant)?.parts.forEach(add)
    }
  }
  return [...result]
}
