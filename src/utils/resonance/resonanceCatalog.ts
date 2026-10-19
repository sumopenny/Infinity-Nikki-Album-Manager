import { getCatalogImageSource } from '../gongeo/catalogImage'
// 共鸣目录使用上游稳定 ID 和双语目录构造可在不同界面语言间切换的记录。
import banners from '../../data/gongeo/banners.json'
import outfitItems from '../../data/gongeo/outfitItems.json'
import outfits from '../../data/gongeo/outfits.json'
import itemNamesZh from '../../data/gongeo/locales/zh/item.json'
import itemNamesEn from '../../data/gongeo/locales/en/item.json'
import outfitNamesZh from '../../data/gongeo/locales/zh/outfit.json'
import outfitNamesEn from '../../data/gongeo/locales/en/outfit.json'
import bannerNamesZh from '../../data/gongeo/locales/zh/banner.json'
import bannerNamesEn from '../../data/gongeo/locales/en/banner.json'
import type {
  ResonanceBanner,
  ResonanceLocalizedName,
  ResonancePart,
  ResonancePull,
  ResonanceRecord,
  ResonanceRarity,
  ResonanceSet
} from './resonanceTypes'

const CDN = 'https://cdn.gongeo.us/images'
/** 部件卡片使用方形图标；从 ID 生成地址可兼容旧记录中保存的全图地址。 */
export const getResonancePartIconUrl = (itemId: string): string =>
  getCatalogImageSource('icon', itemId)
const bannerEntries = banners as unknown as Array<Record<string, unknown>>
const itemNames = {
  zh: itemNamesZh as Record<string, string>,
  en: itemNamesEn as Record<string, string>
}
const outfitNames = {
  zh: outfitNamesZh as Record<string, string>,
  en: outfitNamesEn as Record<string, string>
}
const bannerNames = {
  zh: bannerNamesZh as Record<string, string>,
  en: bannerNamesEn as Record<string, string>
}

/** 套装 ID -> 该套装的全部部件 ID */
const outfitParts = new Map(
  (outfitItems as unknown as Array<[number, number[]]>).map(([id, items]) => [
    String(id),
    items.map(String)
  ])
)
/** 部件 ID -> 所属套装 ID（变体部件可能同时属于多个条目） */
const itemOutfits = new Map<string, string[]>()
for (const [outfitId, itemIds] of outfitParts) {
  for (const itemId of itemIds) {
    const related = itemOutfits.get(itemId) ?? []
    related.push(outfitId)
    itemOutfits.set(itemId, related)
  }
}

function localizedName(
  zh: string | undefined,
  en: string | undefined,
  fallback: string
): ResonanceLocalizedName {
  const chinese = zh || en || fallback
  return { zh: chinese, en: en || zh || fallback }
}

function getOutfitDisplayId(outfitId: string): string {
  const outfit = (outfits as unknown as Array<unknown[]>).find((entry) => {
    const variants = Array.isArray(entry[0]) ? entry[0] : [entry[0]]
    return variants.map(String).includes(outfitId)
  })
  return outfit && Array.isArray(outfit[0]) ? String(outfit[0][0]) : outfitId
}

function getOutfitName(outfitId: string): ResonanceLocalizedName {
  const displayId = getOutfitDisplayId(outfitId)
  return localizedName(
    outfitNames.zh[`outfit.${displayId}.name`],
    outfitNames.en[`outfit.${displayId}.name`],
    outfitId
  )
}

function getItemName(itemId: string): ResonanceLocalizedName {
  return localizedName(
    itemNames.zh[`item.${itemId}.name`],
    itemNames.en[`item.${itemId}.name`],
    itemId
  )
}

/** 卡池目录与共鸣录一致，按稳定卡池 ID 从大到小排序。 */
export function loadResonanceBanners(): ResonanceBanner[] {
  return bannerEntries
    .map((entry) => {
      const id = String(entry.bannerId)
      const runs = (Array.isArray(entry.runs) ? entry.runs : []) as Array<Record<string, unknown>>
      const run = [...runs].sort((a, b) =>
        String(b.start ?? '').localeCompare(String(a.start ?? ''))
      )[0]
      const fallback = typeof entry.name === 'string' ? entry.name : id
      return {
        bannerId: id,
        bannerType: Number(entry.bannerType ?? 1),
        name: localizedName(
          bannerNames.zh[`banner.${id}.name`],
          bannerNames.en[`banner.${id}.name`],
          fallback
        ),
        startAt: String(run?.start ?? ''),
        endAt: String(run?.end ?? ''),
        outfit5StarIds: Array.isArray(entry.outfit5StarId) ? entry.outfit5StarId.map(String) : [],
        outfit4StarIds: Array.isArray(entry.outfit4StarId) ? entry.outfit4StarId.map(String) : [],
        version: String(run?.version ?? '')
      }
    })
    .sort((a, b) => Number(b.bannerId) - Number(a.bannerId))
}

export type ResonanceBannerOrder = 'newest' | 'oldest'
export type ResonanceRarityFilter = 'all' | ResonanceRarity

/** 按星级筛选和卡池新旧排序；同池保持目录中的五星、四星套装顺序。 */
export function sortResonanceRecords(
  records: ResonanceRecord[],
  order: ResonanceBannerOrder = 'newest',
  rarity: ResonanceRarityFilter = 'all'
): ResonanceRecord[] {
  return records
    .filter((record) => rarity === 'all' || record.rarity === rarity)
    .sort((a, b) => {
      const bannerOrder =
        order === 'newest'
          ? Number(b.bannerId) - Number(a.bannerId)
          : Number(a.bannerId) - Number(b.bannerId)
      if (Number.isFinite(bannerOrder) && bannerOrder !== 0) return bannerOrder
      const banner = getBannerMeta(a.bannerId)
      const outfitOrder = [...(banner?.outfit5StarIds ?? []), ...(banner?.outfit4StarIds ?? [])]
      const aIndex = outfitOrder.indexOf(a.outfitId)
      const bIndex = outfitOrder.indexOf(b.outfitId)
      if (aIndex !== bIndex)
        return (aIndex < 0 ? Infinity : aIndex) - (bIndex < 0 ? Infinity : bIndex)
      return a.outfitId.localeCompare(b.outfitId)
    })
}

/** 已获得部件按抽到时间从晚到早排列，未获得部件保持目录顺序并置后。 */
export function sortResonanceParts(parts: ResonancePart[]): ResonancePart[] {
  return [...parts].sort((a, b) => {
    const aOwned = a.pullNumber > 0 || a.manual === true
    const bOwned = b.pullNumber > 0 || b.manual === true
    if (aOwned !== bOwned) return aOwned ? -1 : 1
    return (b.acquisitionOrder ?? -1) - (a.acquisitionOrder ?? -1)
  })
}

const bannerCache = new Map<string, ResonanceBanner | undefined>()

export function getBannerMeta(id: string): ResonanceBanner | undefined {
  if (!bannerCache.has(id))
    bannerCache.set(
      id,
      loadResonanceBanners().find((banner) => banner.bannerId === id)
    )
  return bannerCache.get(id)
}

function rarityForOutfit(banner: ResonanceBanner, outfitId: string): ResonanceRarity | null {
  if (banner.outfit5StarIds.includes(outfitId)) return 5
  if (banner.outfit4StarIds.includes(outfitId)) return 4
  return null
}

/** 部件在当前卡池内归属的套装与稀有度。 */
export function resolveOutfit(
  banner: ResonanceBanner,
  itemId: string
): { outfitId: string; rarity: ResonanceRarity } | null {
  for (const outfitId of itemOutfits.get(itemId) ?? []) {
    const rarity = rarityForOutfit(banner, outfitId)
    if (rarity) return { outfitId, rarity }
  }
  return null
}

/**
 * 归一化单个卡池的抽卡历史。
 * 上游按最新记录优先返回；同一部件按 pool_cnt 顺序取前两次，分别计入第一、第二套。
 */
export function normalizeBannerPulls(bannerId: string, rawPulls: unknown[]): ResonancePull[] {
  const banner = getBannerMeta(bannerId)
  if (!banner) throw new Error(`Unknown banner: ${bannerId}`)
  const tuples = rawPulls
    .map((row) => {
      if (Array.isArray(row))
        return {
          itemId: String(row[1] ?? ''),
          obtainedAt: String(row[0] ?? ''),
          pity: null as number | null,
          poolCount: null as number | null
        }
      const item = row as Record<string, unknown>
      return {
        itemId: String(item.itemId ?? item.item_id ?? item.result ?? ''),
        obtainedAt: String(item.obtainedAt ?? item.time ?? item.timestamp ?? ''),
        pity: Number.isFinite(Number(item.pullsToObtain)) ? Number(item.pullsToObtain) : null,
        poolCount: Number.isInteger(Number(item.poolCount)) ? Number(item.poolCount) : null
      }
    })
    .filter((row) => /^\d+$/.test(row.itemId))

  const chronological = tuples.reverse()
  const pity = { 4: 0, 5: 0 }
  const occurrences = new Map<string, number>()
  const result: ResonancePull[] = []
  chronological.forEach((row, index) => {
    pity[4] += 1
    pity[5] += 1
    const resolved = resolveOutfit(banner, row.itemId)
    if (!resolved) return

    const pullsToObtain = row.pity ?? pity[resolved.rarity]
    pity[resolved.rarity] = 0
    const itemIds = outfitParts.get(resolved.outfitId) ?? []
    if (!itemIds.length) return
    const occurrence = (occurrences.get(row.itemId) ?? 0) + 1
    occurrences.set(row.itemId, occurrence)
    if (occurrence > 2) return
    const setNumber = occurrence as 1 | 2

    result.push({
      itemId: row.itemId,
      outfitId: resolved.outfitId,
      rarity: resolved.rarity,
      setNumber,
      // 手账的 pool_cnt 从 0 开始，不能用数组下标代替累计抽数（源数据可能缺行）。
      pullNumber: row.poolCount === null ? index + 1 : row.poolCount + 1,
      pullsToObtain,
      obtainedAt: row.obtainedAt
    })
  })
  return result
}

/** 把归一化后的抽卡记录组装成两套装箱的成品记录。 */
export function buildResonanceRecords(bannerId: string, pulls: ResonancePull[]): ResonanceRecord[] {
  const banner = getBannerMeta(bannerId)
  if (!banner) throw new Error(`Unknown banner: ${bannerId}`)
  const ids = [
    ...banner.outfit5StarIds.map((id) => ({ id, rarity: 5 as const })),
    ...banner.outfit4StarIds.map((id) => ({ id, rarity: 4 as const }))
  ]
  return ids
    .filter(({ id }) => pulls.some((pull) => pull.outfitId === id))
    .map(({ id, rarity }) => {
      const itemIds = outfitParts.get(id) ?? []
      const makeSet = (setNumber: 1 | 2): ResonanceSet => {
        const parts: ResonanceSet['parts'] = itemIds.map((itemId) => ({
          id: itemId,
          name: getItemName(itemId),
          imageUrl: getResonancePartIconUrl(itemId),
          pullNumber: 0
        }))
        let totalPulls = 0
        for (const [order, pull] of pulls.entries()) {
          if (pull.outfitId !== id || pull.setNumber !== setNumber) continue
          const index = parts.findIndex((part) => part.id === pull.itemId)
          if (index < 0 || parts[index]!.pullNumber > 0 || parts[index]!.manual) continue
          parts[index] = {
            ...parts[index]!,
            pullNumber: pull.pullsToObtain,
            acquisitionOrder: order + 1,
            ...(pull.manual ? { manual: true } : {})
          }
          totalPulls += pull.pullsToObtain
        }
        return { setNumber, parts, totalPulls }
      }
      const displayId = getOutfitDisplayId(id)
      return {
        id: `${bannerId}:${id}`,
        bannerId,
        bannerName: banner.name,
        bannerStartAt: banner.startAt,
        outfitId: id,
        outfitName: getOutfitName(id),
        rarity,
        outfitImageUrl: `${CDN}/outfits/${displayId}.png`,
        sets: [makeSet(1), makeSet(2)]
      }
    })
}
