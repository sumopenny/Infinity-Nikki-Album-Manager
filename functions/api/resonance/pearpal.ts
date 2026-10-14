interface Context { request: Request }

const CACHE_HEADERS = {
  'cache-control': 'no-store, no-cache, must-revalidate',
  pragma: 'no-cache',
  expires: '0'
}
const PEARPAL_API = 'https://myl-api.nuanpaper.com'
const ACTION_PATHS = {
  verify: '/v1/strategy/user/info/get',
  snapshot: '/v1/strategy/user/note/book/info'
} as const

export async function onRequestPost({ request }: Context): Promise<Response> {
  const action = new URL(request.url).searchParams.get('action')
  if (action !== 'verify' && action !== 'snapshot') {
    return Response.json({ error: 'invalid_action' }, { status: 400, headers: CACHE_HEADERS })
  }

  const contentLength = Number(request.headers.get('content-length') ?? 0)
  if (contentLength > 8192) return Response.json({ error: 'request_too_large' }, { status: 413, headers: CACHE_HEADERS })

  let body: { token?: unknown; openid?: unknown }
  try {
    const rawBody = await request.text()
    if (rawBody.length > 8192) return Response.json({ error: 'request_too_large' }, { status: 413, headers: CACHE_HEADERS })
    const parsed: unknown = JSON.parse(rawBody)
    // JSON 顶层必须是非空对象；合法 JSON 的 null、数组和标量也不能作为凭据对象。
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return Response.json({ error: 'invalid_body' }, { status: 400, headers: CACHE_HEADERS })
    }
    body = parsed as typeof body
  } catch {
    return Response.json({ error: 'invalid_body' }, { status: 400, headers: CACHE_HEADERS })
  }
  if (typeof body.token !== 'string' || !body.token || body.token.length > 4096 ||
      typeof body.openid !== 'string' || !body.openid || body.openid.length > 256) {
    return Response.json({ error: 'invalid_credentials' }, { status: 400, headers: CACHE_HEADERS })
  }

  const target = new URL(ACTION_PATHS[action], PEARPAL_API)
  try {
    const upstream = await fetch(target, {
      method: 'POST',
      signal: AbortSignal.timeout(20000),
      cache: 'no-store',
      headers: {
        'content-type': 'application/json',
        accept: action === 'snapshot' ? 'application/octet-stream' : 'application/json'
      },
      body: JSON.stringify({ client_id: 1106, token: body.token, openid: body.openid })
    })
    if (!upstream.ok) {
      return Response.json({ error: 'upstream_rejected' }, { status: 502, headers: CACHE_HEADERS })
    }
    const responseHeaders = new Headers(CACHE_HEADERS)
    responseHeaders.set('content-type', upstream.headers.get('content-type') ?? (action === 'snapshot' ? 'application/octet-stream' : 'application/json'))
    return new Response(upstream.body, { status: 200, headers: responseHeaders })
  } catch {
    return Response.json({ error: 'upstream_unavailable' }, { status: 502, headers: CACHE_HEADERS })
  }
}
