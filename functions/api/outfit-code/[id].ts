interface OutfitCodeFunctionContext {
  request: Request
  params: { id?: string }
}

const UPSTREAM_BASE_URL = 'https://x6cn-clothdiydata.nuanpaper.com/default/'
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
} as const

/** 只代理固定对象存储中的 18 位编号，避免把 Pages Function 变成开放代理。 */
export async function onRequestGet(context: OutfitCodeFunctionContext): Promise<Response> {
  const pathId = context.params.id ?? ''
  if (!/^\d{18}$/.test(pathId)) {
    return Response.json({ error: 'invalid_path_id' }, { status: 400, headers: JSON_HEADERS })
  }

  try {
    const upstream = await fetch(UPSTREAM_BASE_URL + pathId + '.json', {
      signal: context.request.signal
    })
    const headers = new Headers({ 'cache-control': 'private, no-store' })
    const contentType = upstream.headers.get('content-type')
    if (contentType) headers.set('content-type', contentType)
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502, headers: JSON_HEADERS })
  }
}
