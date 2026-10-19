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
interface Flight {
  controller: AbortController
  promise: Promise<CatalogEntity>
  consumers: number
}
const flights = new Map<string, Flight>()
let generation = 0

/** 按需输出公共请求耗时，不记录路径、个人记录或正文。 */
function timing(started: number, source: string, status?: number) {
  try {
    if (sessionStorage.getItem('nikki-catalog-diagnostics') !== '1') return
    console.info('[catalog-timing]', {
      source,
      status,
      durationMs: Math.round(performance.now() - started)
    })
  } catch {
    /* 诊断不可用不影响图鉴。 */
  }
}

/** 每位调用者独立取消；最后一位离开时才中止共享请求及正文读取。 */
async function consume(flight: Flight, signal?: AbortSignal): Promise<CatalogEntity> {
  flight.consumers++
  let released = false
  const release = () => {
    if (!released) {
      released = true
      if (--flight.consumers === 0) flight.controller.abort()
    }
  }
  let abort: (() => void) | undefined
  const cancelled = new Promise<never>((_, reject) => {
    if (!signal) return
    abort = () => {
      release()
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    signal.addEventListener('abort', abort, { once: true })
    if (signal.aborted) abort()
  })
  try {
    return await Promise.race([flight.promise, cancelled])
  } finally {
    if (abort) signal?.removeEventListener('abort', abort)
    release()
  }
}

/** 公共图鉴按实体、语言共享成功缓存和在途请求；个人拥有记录不进入此缓存。 */
export async function requestCatalogEntity(
  path: string,
  language: Language,
  signal?: AbortSignal
): Promise<CatalogEntity> {
  if (!/^\/(items|makeups|outfits)\/[1-9]\d*$/.test(path) || !['zh', 'en'].includes(language))
    throw new Error('Invalid catalog request')
  if (signal?.aborted) throw new DOMException('Catalog request aborted', 'AbortError')
  const started = performance.now()
  const key = path + '?lang=' + language
  const cached = cache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    timing(started, 'memory')
    return cached.entity
  }
  cache.delete(key)
  let flight = flights.get(key)
  if (!flight || flight.controller.signal.aborted) {
    const currentGeneration = generation
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    const promise = (async () => {
      const response = await fetch('/api/gongeo' + key, {
        signal: controller.signal,
        headers: { Accept: 'application/json' }
      })
      timing(started, 'response_headers', response.status)
      if (!response.ok) throw new Error('Catalog request failed with ' + response.status)
      const payload: unknown = await response.json()
      if (controller.signal.aborted) throw new DOMException('Catalog request aborted', 'AbortError')
      if (!payload || typeof payload !== 'object' || Array.isArray(payload))
        throw new Error('Invalid catalog response')
      const entity = payload as CatalogEntity
      if (generation === currentGeneration) {
        for (const [entryKey, entry] of cache)
          if (entry.expiresAt <= Date.now()) cache.delete(entryKey)
        if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value!)
        cache.set(key, { entity, expiresAt: Date.now() + CACHE_TTL_MS })
      }
      return entity
    })()
    const current: Flight = { controller, promise, consumers: 0 }
    current.promise = promise.finally(() => {
      clearTimeout(timer)
      timing(started, 'request_complete')
      if (flights.get(key) === current) flights.delete(key)
    })
    flight = current
    flights.set(key, flight)
  }
  return consume(flight, signal)
}

export function clearCatalogApiCache(): void {
  generation++
  cache.clear()
  // 已开始的调用仍可结束，但清理后的请求不能复用旧任务或回写旧缓存。
  flights.clear()
}
