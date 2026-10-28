import { getCatalogImageSource } from '../gongeo/catalogImage'
import { getBannerMeta } from './resonanceBanners'
import type { ResonancePart, ResonanceRecord, ResonanceRarity } from './resonanceTypes'
export const getResonancePartIconUrl = (itemId: string): string =>
  getCatalogImageSource('icon', itemId)

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
