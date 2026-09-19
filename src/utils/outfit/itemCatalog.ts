// 部件图鉴查询:懒加载本地图鉴数据(部件与妆容的中英文名称),按语言返回名称与图标地址。
const CDN_BASE_URL = 'https://cdn.gongeo.us'

export interface ItemCatalogEntry {
  id: number
  zh: string
  en: string
  makeup: boolean
}

type ItemCatalogData = {
  items: Record<string, [string, string]>
  makeups: Record<string, [string, string]>
}

let catalogPromise: Promise<Map<number, ItemCatalogEntry>> | null = null

/** 懒加载图鉴,首次调用后常驻内存;加载失败允许下次重试。 */
export function loadItemCatalog(): Promise<Map<number, ItemCatalogEntry>> {
  catalogPromise ??= import('../../data/itemCatalog.json')
    .then((mod) => {
      const data = mod.default as unknown as ItemCatalogData
      const map = new Map<number, ItemCatalogEntry>()
      for (const [id, [zh, en]] of Object.entries(data.items)) {
        map.set(Number(id), { id: Number(id), zh, en, makeup: false })
      }
      for (const [id, [zh, en]] of Object.entries(data.makeups)) {
        map.set(Number(id), { id: Number(id), zh, en, makeup: true })
      }
      return map
    })
    .catch((error) => {
      catalogPromise = null
      throw error
    })
  return catalogPromise
}

/** 部件与妆容图标分别位于不同 CDN 路径。 */
export function getCatalogImageUrl(entry: ItemCatalogEntry): string {
  return entry.makeup
    ? `${CDN_BASE_URL}/images/items/makeups/${entry.id}.png`
    : `${CDN_BASE_URL}/images/items/icons/${entry.id}.png`
}

export function getCatalogEntryName(entry: ItemCatalogEntry, language: 'zh' | 'en'): string {
  return language === 'en' ? entry.en : entry.zh
}
