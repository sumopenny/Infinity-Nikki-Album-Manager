import banners from '../../data/gongeo/banners.json'
import bannerNamesZh from '../../data/gongeo/locales/zh/banner.json'
import bannerNamesEn from '../../data/gongeo/locales/en/banner.json'
import type { ResonanceBanner, ResonanceLocalizedName } from './resonanceTypes'
const bannerEntries = banners as unknown as Array<Record<string, unknown>>
const bannerNames = {
  zh: bannerNamesZh as Record<string, string>,
  en: bannerNamesEn as Record<string, string>
}

export function localizedName(
  zh: string | undefined,
  en: string | undefined,
  fallback: string
): ResonanceLocalizedName {
  const chinese = zh || en || fallback
  return { zh: chinese, en: en || zh || fallback }
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

const bannerCache = new Map<string, ResonanceBanner | undefined>()

export function getBannerMeta(id: string): ResonanceBanner | undefined {
  if (!bannerCache.has(id))
    bannerCache.set(
      id,
      loadResonanceBanners().find((banner) => banner.bannerId === id)
    )
  return bannerCache.get(id)
}
