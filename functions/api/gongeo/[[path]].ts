interface GongeoFunctionContext {
  request: Request
  params: { path?: string[] }
}

const UPSTREAM_BASE_URL = 'https://data.gongeo.us/v1/'
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=300'
} as const

/** 仅代理图鉴详情接口，避免 Pages Function 变成开放代理。 */
export async function onRequestGet(context: GongeoFunctionContext): Promise<Response> {
  const path = (context.params.path ?? []).join('/')
  if (!/^(?:items|makeups|outfits)\/\d+$/.test(path)) {
    return Response.json({ error: 'invalid_catalog_path' }, { status: 400, headers: JSON_HEADERS })
  }

  const upstreamUrl = new URL(UPSTREAM_BASE_URL + path)
  const language = new URL(context.request.url).searchParams.get('lang')
  if (language === 'zh' || language === 'en') upstreamUrl.searchParams.set('lang', language)

  try {
    const upstream = await fetch(upstreamUrl, {
      signal: context.request.signal,
      headers: { Accept: 'application/json' }
    })
    const headers = new Headers(JSON_HEADERS)
    const contentType = upstream.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502, headers: JSON_HEADERS })
  }
}
