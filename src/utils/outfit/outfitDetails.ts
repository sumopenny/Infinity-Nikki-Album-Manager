import type { Language } from '../../i18n'
import type { LookbookDyeSwatch } from './outfitCodeParser'

// 由 Vite 开发服务器（及生产环境同域代理）转发到 data.gongeo.us，避免浏览器跨域。
const DATA_API_BASE_URL = '/api/gongeo'
const CDN_BASE_URL = 'https://cdn.gongeo.us'
const REQUEST_TIMEOUT_MS = 8000
const getMakeupItemImageUrl = (itemId: number): string =>
  `${CDN_BASE_URL}/images/items/${itemId}.png`

const isMakeupClothType = (clothType: number | null): boolean =>
  clothType !== null && clothType >= 80 && clothType <= 85

const PALETTE_NAMES: Record<number, [string, string]> = {
  1: ['围兜暖毛球', 'Bibcoon Furball Hug'],
  2: ['星夜时光树', 'Starlit Chronos Tree'],
  3: ['星光果之梦', 'Stellar Fruit Dream'],
  4: ['眼影鱼碎闪', 'Palettetail Shimmer'],
  5: ['春日满满星', 'Spring Starlit Breath'],
  6: ['飞球果飘飘', 'Flight Fruit Flutter'],
  7: ['崖上的壁灯', 'Lantern by the Cliff'],
  8: ['风铃子腹语', "Chimecada's Murmur"],
  9: ['风絮草飘飞时', 'Windbloom Whirl'],
  10: ['雨夜路灯花', 'Lampbloom Mist'],
  11: ['耳坠萤未眠', 'Sleepless Glimmerdrop'],
  12: ['碧波裙摆湖', 'Silken Lake Emerald'],
  13: ['星荧草来信', "Glimmergrass's Letter"],
  14: ['丝巾蛾魅影', "Scarfmoth's Phantom"],
  15: ['花伞藤萝之雨', 'Wisteriasol Rain'],
  16: ['兔耳草嫩蕊', 'Budding Hare Ears'],
  17: ['裙撑萤之歌', "Bustlefly's Song"],
  18: ['名流鸦盛宴', "Celebcrow's Feast"],
  19: ['绒绒衬衫毛团', 'Puffy Shirtcat Fluff']
}

const EVOLUTION_LABELS: Record<Language, string[]> = {
  zh: ['原套', '焕新', '1进', '2进', '满进'],
  en: ['Original', 'Glow-Up', 'Evo. 1', 'Evo. 2', 'Evo. 3']
}

const DYE_UNLOCK_LABELS: Record<Language, string[]> = {
  // 与暖暖相册 DyeCondition 保持同一顺序：directly、complete、growUp、evolution1、evolution2。
  zh: ['原套可染', '满进可染', '焕新可染', '1进可染', '2进可染', '满进可染'],
  en: ['Dyeable on original', 'Dyeable on Evo. 3', 'Dyeable on Glow-Up', 'Dyeable on Evo. 1', 'Dyeable on Evo. 2', 'Dyeable on Evo. 3']
}

export interface OutfitDyeDetail {
  area: string
  paletteId: number
  paletteName: string
  slot: number | null
  color: string
}

export interface OutfitDetail {
  itemId: number
  outfitId: number | null
  itemName: string
  outfitName: string
  detailImageUrl: string | null
  quality: number | null
  outfitItemIds: number[]
  outfitImageUrl: string | null
  evolution: string
  dyeCondition: string
  dyes: OutfitDyeDetail[]
  loadError: boolean
}


type ApiEntity = {
  id?: unknown
  name?: unknown
  quality?: unknown
  items?: unknown
  description?: unknown
  props?: unknown
}

type CompactRow = unknown[]
type DyeAreaInfo = { primaryCount: number; customOrder: number[] }
type CatalogSnapshot = {
  items: CompactRow[]
  outfits: CompactRow[]
  outfitItems: CompactRow[]
  makeupItems: CompactRow[]
  makeupOutfits: CompactRow[]
  dyeCatalog: { raw: CompactRow[]; areas: CompactRow[] }
  outfitNames: Record<string, string>
}

const detailCache = new Map<string, Promise<OutfitDetail>>()
let catalogSnapshotPromise: Promise<Omit<CatalogSnapshot, 'outfitNames'>> | null = null

const loadCatalogSnapshot = async (language: Language): Promise<CatalogSnapshot> => {
  catalogSnapshotPromise ??= Promise.all([
    import('../../data/gongeo/items.json'),
    import('../../data/gongeo/outfits.json'),
    import('../../data/gongeo/outfitItems.json'),
    import('../../data/gongeo/makeupItems.json'),
    import('../../data/gongeo/makeupOutfits.json'),
    import('../../data/gongeo/palettes.json')
  ]).then(([items, outfits, outfitItems, makeupItems, makeupOutfits, dyeCatalog]) => ({
    items: items.default as CompactRow[],
    outfits: outfits.default as CompactRow[],
    outfitItems: outfitItems.default as CompactRow[],
    makeupItems: makeupItems.default as CompactRow[],
    makeupOutfits: makeupOutfits.default as CompactRow[],
    dyeCatalog: dyeCatalog.default as CatalogSnapshot['dyeCatalog']
  }))
  const [snapshot, names] = await Promise.all([
    catalogSnapshotPromise,
    language === 'en'
      ? import('../../data/gongeo/locales/en/outfit.json')
      : import('../../data/gongeo/locales/zh/outfit.json')
  ])
  return { ...snapshot, outfitNames: names.default as Record<string, string> }
}

const asId = (value: unknown): number | null => {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

const idsIn = (value: unknown): number[] =>
  (Array.isArray(value) ? value : [value])
    .map(asId)
    .filter((id): id is number => id !== null)

const compactIds = (row: CompactRow | undefined): number[] => idsIn(row?.[0])

const findItemRow = (catalog: CatalogSnapshot, itemId: number) =>
  catalog.items.find((row) => compactIds(row).includes(itemId))

const getItemFamilyIds = (catalog: CatalogSnapshot, itemId: number): number[] => {
  const familyIds = compactIds(findItemRow(catalog, itemId))
  return familyIds.length ? familyIds : [itemId]
}

const findOutfitRow = (catalog: CatalogSnapshot, outfitId: number) =>
  catalog.outfits.find((row) => compactIds(row).includes(outfitId))

const findDyeRow = (catalog: CatalogSnapshot, itemId: number) =>
  catalog.dyeCatalog.raw.find((row) => compactIds(row).includes(itemId))

const findDyeArea = (catalog: CatalogSnapshot, itemId: number): DyeAreaInfo | null => {
  const row = catalog.dyeCatalog.areas.find((entry) => compactIds(entry).includes(itemId))
  if (!row || typeof row[1] !== 'number' || !Array.isArray(row[2])) return null
  return {
    primaryCount: row[1],
    customOrder: row[2].filter((area): area is number => typeof area === 'number')
  }
}

const getVariantIndex = (itemId: number): number => {
  const prefix = String(itemId).slice(0, 4)
  if (['1021', '1020', '1029'].includes(prefix)) return 0
  if (['1022', '1026', '1027', '1028'].includes(prefix)) return 1
  if (prefix === '1023') return 2
  if (prefix === '1024') return 3
  if (prefix === '1025') return 4
  return 0
}

const getLocalizedName = (
  entity: ApiEntity | null,
  outfitId: number,
  language: Language,
  catalog: CatalogSnapshot
) => {
  if (typeof entity?.name === 'string' && entity.name.trim()) return entity.name
  if (entity?.name && typeof entity.name === 'object') {
    const localized = entity.name as { zh?: unknown; en?: unknown }
    const value = localized[language]
    if (typeof value === 'string' && value.trim()) return value
  }
  const names = catalog.outfitNames
  const variantName = names[`outfit.${outfitId}.name`]
  if (typeof variantName === 'string' && variantName.trim()) return variantName
  const row = findOutfitRow(catalog, outfitId)
  const baseId = asId(row?.[5]) ?? compactIds(row)[0]
  const baseName = baseId ? names[`outfit.${baseId}.name`] : null
  return typeof baseName === 'string' && baseName.trim() ? baseName : ''
}

const findRelatedOutfitId = (catalog: CatalogSnapshot, itemIds: number[]): number | null => {
  for (const row of catalog.outfitItems) {
    const outfitId = asId(row[0])
    const outfitItems = idsIn(row[1])
    if (outfitId && itemIds.some((itemId) => outfitItems.includes(itemId)) && findOutfitRow(catalog, outfitId)) {
      return outfitId
    }
  }
  return null
}

// 妆容部件通过“完整妆容 -> 妆容套装”两级目录关联套装，不能直接套用服装关系表。
const findRelatedMakeupOutfitId = (catalog: CatalogSnapshot, itemIds: number[]): number | null => {
  const fullMakeupIds = new Set<number>()
  for (const [fullMakeupId, componentIds] of catalog.makeupItems) {
    const fullId = asId(fullMakeupId)
    if (fullId && (itemIds.includes(fullId) || idsIn(componentIds).some((id) => itemIds.includes(id)))) {
      fullMakeupIds.add(fullId)
    }
  }
  for (const [outfitId, makeupIds] of catalog.makeupOutfits) {
    const id = asId(outfitId)
    if (id && idsIn(makeupIds).some((makeupId) => fullMakeupIds.has(makeupId)) && findOutfitRow(catalog, id)) {
      return id
    }
  }
  return null
}

const isMakeupCatalogItem = (catalog: CatalogSnapshot, itemId: number): boolean =>
  catalog.makeupItems.some(([makeupId, componentIds]) => (
    asId(makeupId) === itemId || idsIn(componentIds).includes(itemId)
  ))

const isOutfitRelatedToItem = (catalog: CatalogSnapshot, outfitId: number, itemIds: number[]) => {
  const outfitVariants = compactIds(findOutfitRow(catalog, outfitId))
  const outfitBaseId = outfitVariants[0]
  return catalog.outfitItems.some((row) => {
    const relationOutfitId = Number(row[0])
    const relatedIds = idsIn(row[1])
    return (
      (relationOutfitId === outfitId || relationOutfitId === outfitBaseId) &&
      itemIds.some((itemId) => relatedIds.includes(itemId))
    )
  })
}

// 共鸣录以 featureTag 区分主/次区域，次区域需从主区域数量之后顺延。
const getDyeAreaNumber = (
  dye: LookbookDyeSwatch,
  areaInfo: DyeAreaInfo | null,
  fallbackPrimaryCount: number
) => {
  let area = dye.featureTag === 3
    ? (areaInfo?.primaryCount ?? fallbackPrimaryCount) + dye.targetGroupId
    : dye.targetGroupId
  if (areaInfo) {
    const customIndex = areaInfo.customOrder.indexOf(area)
    if (customIndex >= 0) return customIndex + 1
    area += areaInfo.customOrder.filter((value) => value > area).length
  }
  return area
}

const getPaletteSerial = (dyeGroups: unknown[], paletteId: number): number | null => {
  let position = 0
  for (const group of dyeGroups) {
    if (!Array.isArray(group)) continue
    for (const value of group) {
      position += 1
      if (Number(value) === paletteId) return position
    }
  }
  return null
}

const getPaletteName = (paletteId: number, language: Language): string => {
  const names = PALETTE_NAMES[paletteId]
  return names
    ? names[language === 'en' ? 1 : 0]
    : language === 'en'
      ? `Palette ${paletteId}`
      : `染色盘 ${paletteId}`
}

const getDyeCondition = (
  dyes: LookbookDyeSwatch[],
  dyeGroups: unknown[],
  language: Language,
  hasSpecialEffect = false
): string => {
  if (hasSpecialEffect) return DYE_UNLOCK_LABELS[language][5]
  if (!dyes.length) return DYE_UNLOCK_LABELS[language][0]
  const conditions = new Set<number>()
  for (const dye of dyes) {
    if (dye.paletteId < 0) {
      conditions.add(5)
      continue
    }
    const condition = dyeGroups.findIndex(
      (group) => Array.isArray(group) && group.some((palette) => Number(palette) === dye.paletteId)
    )
    if (condition >= 0) conditions.add(condition)
  }
  const highestCondition = Math.max(...conditions, -1)
  return DYE_UNLOCK_LABELS[language][highestCondition] || (language === 'en' ? 'Unavailable in the catalog' : '图鉴未提供条件')
}

const requestEntity = async (path: string, language: Language): Promise<ApiEntity> => {
  const response = await fetch(`${DATA_API_BASE_URL}${path}?lang=${language}`, {
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: { Accept: 'application/json' }
  })
  if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`)
  const payload: unknown = await response.json()
  return payload && typeof payload === 'object' ? payload as ApiEntity : {}
}

const createDetail = async (
  itemId: number,
  outfitId: number | null,
  language: Language,
  fallbackItemName: string,
  dyes: LookbookDyeSwatch[],
  clothType: number | null,
  hasSpecialEffect: boolean
): Promise<OutfitDetail> => {
  const catalog = await loadCatalogSnapshot(language)
  const isMakeup = isMakeupClothType(clothType) || isMakeupCatalogItem(catalog, itemId)
  // 搭配码的 outfit 字段不一定是图鉴套装 ID；无效时按部件家族回查套装关系。
  const entityRequest = requestEntity(`${isMakeup ? '/makeups' : '/items'}/${itemId}`, language)
    .then((entity) => ({ ok: true as const, entity }), () => ({ ok: false as const, entity: null }))
  const familyIds = getItemFamilyIds(catalog, itemId)
  const catalogOutfitId = outfitId && findOutfitRow(catalog, outfitId) && isOutfitRelatedToItem(catalog, outfitId, familyIds)
    ? outfitId
    : isMakeup
      ? findRelatedMakeupOutfitId(catalog, [itemId, ...familyIds])
      : findRelatedOutfitId(catalog, familyIds)
  const outfitRequest = catalogOutfitId
    ? requestEntity(`/outfits/${catalogOutfitId}`, language)
    : Promise.resolve(null)
  const [entityResult, outfitResult] = await Promise.allSettled([entityRequest, outfitRequest])
  const entityLoaded = entityResult.status === 'fulfilled' && entityResult.value.ok
  const outfitEntity = outfitResult.status === 'fulfilled' ? outfitResult.value : null
  const outfitRow = catalogOutfitId ? findOutfitRow(catalog, catalogOutfitId) : undefined
  const relation = catalogOutfitId
    ? catalog.outfitItems.find((row) => Number(row[0]) === catalogOutfitId)
    : undefined
  const dyeRow = familyIds.map((id) => findDyeRow(catalog, id)).find((row) => row !== undefined)
  const dyeGroups = dyeRow?.slice(1) ?? []
  const areaInfo = familyIds.map((id) => findDyeArea(catalog, id)).find((area) => area !== null) ?? null
  const fallbackPrimaryCount = Math.max(
    0,
    ...dyes.filter((dye) => dye.featureTag === 1).map((dye) => dye.targetGroupId)
  )
  const paletteRows = new Map<string, OutfitDyeDetail>()

  for (const dye of dyes) {
    const areaNumber = getDyeAreaNumber(dye, areaInfo, fallbackPrimaryCount)
    const paletteSerial = getPaletteSerial(dyeGroups, dye.paletteId)
    const detail = {
      area: `区域 ${String(areaNumber).padStart(2, '0')}`,
      paletteId: paletteSerial ?? dye.paletteId,
      paletteName: getPaletteName(dye.paletteId, language),
      slot: dye.slot,
      color: dye.color
    }
    const key = `${detail.area}:${detail.paletteId}:${detail.slot}:${detail.color}`
    paletteRows.set(key, detail)
  }

  const resolvedOutfitId = catalogOutfitId
  const outfitName = resolvedOutfitId
    ? getLocalizedName(outfitEntity, resolvedOutfitId, language, catalog)
    : ''

  return {
    itemId,
    outfitId: resolvedOutfitId,
    itemName: fallbackItemName,
    outfitName,
    detailImageUrl: resolvedOutfitId
      ? `${CDN_BASE_URL}/images/outfits/${resolvedOutfitId}.png`
      : isMakeup
        ? getMakeupItemImageUrl(itemId)
        : null,
    quality: outfitRow && Number.isSafeInteger(Number(outfitRow[1]))
      ? Number(outfitRow[1])
      : null,
    outfitItemIds: idsIn(relation?.[1]),
    outfitImageUrl: resolvedOutfitId
      ? `${CDN_BASE_URL}/images/outfits/${resolvedOutfitId}.png`
      : null,
    evolution: EVOLUTION_LABELS[language][getVariantIndex(itemId)],
    dyeCondition: isMakeup
      ? language === 'en' ? 'None' : '无'
      : getDyeCondition(dyes, dyeGroups, language, hasSpecialEffect),
    dyes: [...paletteRows.values()].sort((left, right) => {
      const areaOrder = Number(left.area.replace(/\D/g, '')) - Number(right.area.replace(/\D/g, ''))
      return areaOrder || left.paletteId - right.paletteId || (left.slot ?? 0) - (right.slot ?? 0)
    }),
    loadError: !isMakeup && !entityLoaded && !outfitEntity
  }
}

export function loadOutfitDetail(
  itemId: number,
  outfitId: number | null,
  language: Language,
  fallbackItemName: string,
  dyes: LookbookDyeSwatch[],
  clothType: number | null = null,
  hasSpecialEffect = false
): Promise<OutfitDetail> {
  const key = `${itemId}:${outfitId ?? 'none'}:${clothType ?? 'none'}:${hasSpecialEffect ? 'effect' : 'plain'}:${language}:${dyes.map((dye) => `${dye.targetGroupId}:${dye.featureTag}:${dye.paletteId}:${dye.slot}:${dye.color}`).join(',')}`
  const cached = detailCache.get(key)
  if (cached) return cached
  const promise = createDetail(itemId, outfitId, language, fallbackItemName, dyes, clothType, hasSpecialEffect).catch(() => ({
    itemId,
    outfitId: null,
    itemName: fallbackItemName,
    outfitName: '',
    detailImageUrl: isMakeupClothType(clothType)
      ? getMakeupItemImageUrl(itemId)
      : null,
    quality: null,
    outfitItemIds: [],
    outfitImageUrl: null,
    evolution: EVOLUTION_LABELS[language][getVariantIndex(itemId)],
    dyeCondition: isMakeupClothType(clothType)
      ? language === 'en' ? 'None' : '无'
      : language === 'en' ? 'Catalog details unavailable' : '图鉴详情加载失败',
    dyes: [],
    loadError: true
  }))
  detailCache.set(key, promise)
  return promise
}

export function clearOutfitDetailCache(): void {
  detailCache.clear()
}
