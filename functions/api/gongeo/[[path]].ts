interface GongeoFunctionContext {
  request: Request
  params: { path?: string[] }
}
const UPSTREAM_BASE_URL = 'https://data.gongeo.us/v1/'
const responseHeaders = (ok: boolean, duration: number) => ({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': ok ? 'public, max-age=300' : 'no-store',
  'server-timing': 'upstream;dur=' + duration
})

/** 固定公共图鉴代理：超时覆盖正文，仅通过结构校验的成功响应允许缓存。 */
export async function onRequestGet(context: GongeoFunctionContext): Promise<Response> {
  const started = Date.now()
  const path = (context.params.path ?? []).join('/')
  if (!/^(?:items|makeups|outfits)\/[1-9]\d*$/.test(path))
    return Response.json(
      { error: 'invalid_catalog_path' },
      { status: 400, headers: responseHeaders(false, 0) }
    )
  const upstreamUrl = new URL(UPSTREAM_BASE_URL + path)
  const language = new URL(context.request.url).searchParams.get('lang')
  if (language === 'zh' || language === 'en') upstreamUrl.searchParams.set('lang', language)
  const controller = new AbortController()
  const abort = () => controller.abort()
  context.request.signal.addEventListener('abort', abort, { once: true })
  if (context.request.signal.aborted) abort()
  const timer = setTimeout(abort, 7000)
  try {
    if (controller.signal.aborted) throw new Error('Aborted')
    const upstream = await fetch(upstreamUrl, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { Accept: 'application/json' }
    })
    if (upstream.status !== 200) {
      void upstream.body?.cancel().catch(() => undefined)
      return Response.json(
        { error: 'upstream_rejected' },
        {
          status: upstream.status === 404 ? 404 : 502,
          headers: responseHeaders(false, Date.now() - started)
        }
      )
    }
    const payload: unknown = await upstream.json()
    if (controller.signal.aborted) throw new Error('Aborted')
    if (!payload || typeof payload !== 'object' || Array.isArray(payload))
      throw new Error('Invalid catalog response')
    return Response.json(payload, { headers: responseHeaders(true, Date.now() - started) })
  } catch {
    return Response.json(
      { error: controller.signal.aborted ? 'upstream_timeout' : 'upstream_unavailable' },
      {
        status: controller.signal.aborted ? 504 : 502,
        headers: responseHeaders(false, Date.now() - started)
      }
    )
  } finally {
    clearTimeout(timer)
    context.request.signal.removeEventListener('abort', abort)
  }
}
