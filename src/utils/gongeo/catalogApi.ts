import type { Language } from '../../i18n/types'

export interface CatalogEntity {
  id?: unknown
  name?: unknown
  quality?: unknown
  items?: unknown
  description?: unknown
  props?: unknown
}

const REQUEST_TIMEOUT_MS = 8000
const CACHE_TTL_MS = 5 * 60 * 1000
const CACHE_LIMIT = 128
const cache = new Map<string, { entity: CatalogEntity; expiresAt: number }>()
let generation = 0

/** 公共图鉴详情：仅缓存成功响应，按实体及语言隔离；账号拥有记录不进入此缓存。 */
export async function requestCatalogEntity(
  path: string,
  language: Language,
  signal?: AbortSignal
): Promise<CatalogEntity> {
  if (!/^\/(items|makeups|outfits)\/[1-9]\d*$/.test(path) || !['zh', 'en'].includes(language))
    throw new Error('Invalid catalog request')
  if (signal?.aborted) throw new DOMException('Catalog request aborted', 'AbortError')
  const key = `${path}?lang=${language}`
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return cached.entity
  cache.delete(key)

  const currentGeneration = generation
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal?.addEventListener('abort', abort, { once: true })
  // 不依赖 AbortSignal.any/timeout，兼容现有手机浏览器；覆盖响应正文读取阶段。
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`/api/gongeo${key}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' }
    })
    if (!response.ok) throw new Error(`Catalog request failed with ${response.status}`)
    const payload: unknown = await response.json()
    if (controller.signal.aborted) throw new DOMException('Catalog request aborted', 'AbortError')
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      throw new Error('Invalid catalog response')
    const entity = payload as CatalogEntity
    if (generation === currentGeneration) {
      // 有限内存缓存；清除缓存后，之前启动的请求不能把旧内容重新写回来。
      for (const [entryKey, entry] of cache)
        if (entry.expiresAt <= Date.now()) cache.delete(entryKey)
      if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!)
      cache.set(key, { entity, expiresAt: Date.now() + CACHE_TTL_MS })
    }
    return entity
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', abort)
  }
}

export function clearCatalogApiCache(): void {
  generation++
  cache.clear()
}
