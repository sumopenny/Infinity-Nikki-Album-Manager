import {
  decodeHomeBuildShareCode,
  parseHomeBuildResponse,
  type HomeBuildWireData
} from './homeBuildWasmClient'
import {
  getSavedHomeSchemeParseResult,
  saveHomeSchemeParseResult
} from '../file-system/directoryStorage'

export const HOME_SCHEME_PARSER_VERSION = 'wire-v1'

export interface HomeSchemeParseResult {
  code: string
  name: string
  templateType: 0 | 1
  server: number
  coverImage: string | null
  version: string | null
  furnitureCount: number
  lastModifyTime: number
}

interface HomeSchemeParseCache {
  code: string
  result: HomeSchemeParseResult
  cachedAt: number
  parserVersion: string
}

function isCache(value: unknown, code: string): value is HomeSchemeParseCache {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<HomeSchemeParseCache>
  return item.code === code && item.parserVersion === HOME_SCHEME_PARSER_VERSION &&
    typeof item.cachedAt === 'number' && Boolean(item.result && item.result.code === code)
}

function toResult(code: string, server: number, value: HomeBuildWireData): HomeSchemeParseResult {
  if (value.TemplateType !== 0 && value.TemplateType !== 1) throw new Error('template_type_unsupported')
  return {
    code,
    name: value.Name,
    templateType: value.TemplateType,
    server,
    coverImage: value.CoverImage || null,
    version: value.version,
    furnitureCount: value.PlaceInfo.length,
    lastModifyTime: value.LastModifyTime
  }
}

/** 先查带解析器版本的本地缓存；未命中时通过同源代理取二进制并交给 WASM。 */
export async function parseHomeScheme(codeInput: string, signal?: AbortSignal): Promise<HomeSchemeParseResult> {
  const code = codeInput.replace(/\s/g, '')
  const route = await decodeHomeBuildShareCode(code)
  if (!route.ok) throw new Error(route.errorCode)
  if (route.value.serverId !== 49) throw new Error('home_build_server_unsupported')

  try {
    const cached: unknown = await getSavedHomeSchemeParseResult(code)
    if (isCache(cached, code)) return cached.result
  } catch {
    // Cache failure must not prevent parsing the share code.
  }

  const response = await fetch(`/api/home-build/${encodeURIComponent(route.value.resourceKey)}`, {
    signal,
    headers: { Accept: 'application/octet-stream' }
  })
  if (!response.ok) {
    let code = `home_build_http_${response.status}`
    try {
      const error = await response.json() as { errorCode?: unknown }
      if (typeof error.errorCode === 'string') code = error.errorCode
    } catch { /* 非 JSON 响应使用 HTTP 状态码。 */ }
    throw new Error(code)
  }

  const parsed = await parseHomeBuildResponse(new Uint8Array(await response.arrayBuffer()))
  if (!parsed.ok) throw new Error(parsed.errorCode)
  const result = toResult(code, route.value.serverId, parsed.value)
  const cache: HomeSchemeParseCache = {
    code,
    result,
    cachedAt: Date.now(),
    parserVersion: HOME_SCHEME_PARSER_VERSION
  }
  await saveHomeSchemeParseResult(code, cache).catch(() => undefined)
  return result
}
