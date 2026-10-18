import type { Language } from '../../i18n/types'
import { assignWardrobeRewardSources, wardrobeGameVersionFromSource } from './wardrobeFilters'

export type WardrobeKind = 'outfit' | 'item'
// 与上游紧凑图鉴的 styleIndex 顺序一致，不能把缺失值当作 0（甜美）。
const WARDROBE_STYLES = ['sweet', 'sexy', 'fresh', 'cool', 'elegant'] as const
export type WardrobeStyle = (typeof WARDROBE_STYLES)[number]
export const wardrobeStyleLabels: Record<WardrobeStyle, Record<Language, string>> = {
  sweet: { zh: '甜美', en: 'Sweet' },
  sexy: { zh: '性感', en: 'Sexy' },
  fresh: { zh: '清新', en: 'Fresh' },
  cool: { zh: '帅气', en: 'Cool' },
  elegant: { zh: '典雅', en: 'Elegant' }
}
export interface WardrobeEntry {
  id: string
  kind: WardrobeKind
  name: { zh: string; en: string }
  quality: number
  variant: number
  category: number
  familyRootId: string | null
  style: WardrobeStyle | null
  labels: number[]
  obtainType: number | null
  version: string | null
  sourceDetails: string[]
  image: string
  parts: string[]
}
export interface WardrobeCatalog {
  entries: WardrobeEntry[]
  byId: Map<string, WardrobeEntry>
}
const ids = (value: unknown): string[] => (Array.isArray(value) ? value : [value]).map(String)

/** ID 编码区分版本；不能按紧凑行下标猜测，因为部分家族缺少中间版本。 */
export function itemVariant(id: string, root?: string): number {
  if (id === root) return 0
  return (
    (
      { '1022': 1, '1026': 1, '1027': 1, '1028': 1, '1023': 2, '1024': 3, '1025': 4 } as Record<
        string,
        number
      >
    )[id.slice(0, 4)] ?? 0
  )
}
let pending: Promise<WardrobeCatalog> | null = null
export function loadWardrobeCatalog(): Promise<WardrobeCatalog> {
  pending ??= Promise.all([
    import('../../data/gongeo/items.json'),
    import('../../data/gongeo/outfits.json'),
    import('../../data/gongeo/outfitItems.json'),
    import('../../data/gongeo/locales/zh/item.json'),
    import('../../data/gongeo/locales/en/item.json'),
    import('../../data/gongeo/locales/zh/outfit.json'),
    import('../../data/gongeo/locales/en/outfit.json')
  ])
    .then(([items, outfits, outfitParts, zhItems, enItems, zhOutfits, enOutfits]) => {
      const entries: WardrobeEntry[] = []
      const outfitMap = new Map(
        (outfitParts.default as unknown as [number, number[]][]).map(([id, parts]) => [
          String(id),
          ids(parts)
        ])
      )
      const nameFor = (
        id: string,
        root: string,
        kind: WardrobeKind,
        language: Language
      ): string => {
        const dict = (
          kind === 'outfit'
            ? language === 'zh'
              ? zhOutfits.default
              : enOutfits.default
            : language === 'zh'
              ? zhItems.default
              : enItems.default
        ) as Record<string, string>
        const prefix = kind === 'outfit' ? 'outfit' : 'item'
        return dict[`${prefix}.${id}.name`] || dict[`${prefix}.${root}.name`] || id
      }
      for (const [data, kind] of [
        [items.default, 'item'],
        [outfits.default, 'outfit']
      ] as const) {
        for (const row of data as unknown as unknown[][]) {
          const family = ids(row[0])
          for (const id of family) {
            const root = String(row[kind === 'item' ? 6 : 5] ?? family[0])
            const parts = kind === 'outfit' ? (outfitMap.get(id) ?? []) : [id]
            const variant =
              kind === 'outfit'
                ? id.length === 7
                  ? Number(id.slice(-2))
                  : 0
                : itemVariant(id, root)
            const rawLabels = row[kind === 'item' ? 4 : 3]
            const rawObtainType = row[kind === 'item' ? 5 : 4]
            const obtainType =
              typeof rawObtainType === 'number' &&
              Number.isSafeInteger(rawObtainType) &&
              rawObtainType > 0
                ? rawObtainType
                : null
            entries.push({
              id,
              kind,
              name: { zh: nameFor(id, root, kind, 'zh'), en: nameFor(id, root, kind, 'en') },
              quality: Number(row[1]),
              variant,
              category: Number(row[2]),
              familyRootId: /^[1-9]\d*$/.test(root) ? root : null,
              style:
                typeof row[kind === 'item' ? 3 : 2] === 'number'
                  ? (WARDROBE_STYLES[Number(row[kind === 'item' ? 3 : 2])] ?? null)
                  : null,
              labels: Array.isArray(rawLabels)
                ? rawLabels.filter(
                    (label): label is number =>
                      typeof label === 'number' && Number.isSafeInteger(label) && label > 0
                  )
                : [],
              obtainType,
              version: wardrobeGameVersionFromSource(obtainType),
              sourceDetails: [],
              parts,
              image: `https://cdn.gongeo.us/images/${kind === 'outfit' ? 'outfits' : 'items/icons'}/${id}.png`
            })
          }
        }
      }
      assignWardrobeRewardSources(entries)
      return { entries, byId: new Map(entries.map((entry) => [entry.id, entry])) }
    })
    .catch((error) => {
      pending = null
      throw error
    })
  return pending
}
