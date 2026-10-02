interface OutfitCodeFunctionContext {
  request: Request
  params: { id?: string }
}

const UPSTREAM_BASE_URL = 'https://x6cn-clothdiydata.nuanpaper.com/default/'
// Keep this below the browser's 10-second timeout so Pages can return a logged 504 first.
const UPSTREAM_TIMEOUT_MS = 8_000
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

  const startedAt = Date.now()
  const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
  const requestController = new AbortController()
  const abortForRequest = () => requestController.abort(context.request.signal.reason)
  const abortForTimeout = () => requestController.abort(timeoutSignal.reason)
  context.request.signal.addEventListener('abort', abortForRequest, { once: true })
  timeoutSignal.addEventListener('abort', abortForTimeout, { once: true })
  if (context.request.signal.aborted) abortForRequest()
  if (timeoutSignal.aborted) abortForTimeout()
  try {
    const upstream = await fetch(UPSTREAM_BASE_URL + pathId + '.json', {
      signal: requestController.signal
    })
    const headersAt = Date.now()
    const headers = new Headers({
      'cache-control': 'private, no-store',
      'server-timing': `upstream_headers;dur=${headersAt - startedAt}`,
      'x-outfit-proxy-upstream-ms': String(headersAt - startedAt)
    })
    const contentType = upstream.headers.get('content-type')
    const requestId = upstream.headers.get('x-oss-request-id')
    if (requestId) headers.set('x-outfit-proxy-request-id', requestId)
    if (contentType) headers.set('content-type', contentType)
    const measuredBody = upstream.body && new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = upstream.body!.getReader()
        try {
          while (true) {
            const { value, done } = await reader.read()
            if (done) break
            controller.enqueue(value)
          }
          controller.close()
          console.log(JSON.stringify({
            event: 'outfit_code_proxy_complete',
            pathId,
            status: upstream.status,
            upstreamHeadersMs: headersAt - startedAt,
            bodyMs: Date.now() - headersAt,
            totalMs: Date.now() - startedAt,
            requestId
          }))
        } catch (error) {
          controller.error(error)
          console.error(JSON.stringify({
            event: 'outfit_code_proxy_body_failed',
            pathId,
            status: upstream.status,
            upstreamHeadersMs: headersAt - startedAt,
            totalMs: Date.now() - startedAt,
            requestId,
            error: String(error)
          }))
        } finally {
          reader.releaseLock()
        }
      },
      cancel(reason) {
        requestController.abort(reason)
      }
    })
    return new Response(measuredBody ?? null, { status: upstream.status, headers })
  } catch {
    const timedOut = timeoutSignal.aborted && !context.request.signal.aborted
    const totalMs = Date.now() - startedAt
    console.error(JSON.stringify({
      event: 'outfit_code_proxy_failed',
      pathId,
      totalMs,
      reason: timedOut ? 'upstream_timeout' : 'upstream_unavailable'
    }))
    return Response.json(
      { error: timedOut ? 'upstream_timeout' : 'upstream_unavailable' },
      {
        status: timedOut ? 504 : 502,
        headers: {
          ...JSON_HEADERS,
          'server-timing': `upstream;dur=${totalMs}`,
          'x-outfit-proxy-upstream-ms': String(totalMs)
        }
      }
    )
  } finally {
    context.request.signal.removeEventListener('abort', abortForRequest)
    timeoutSignal.removeEventListener('abort', abortForTimeout)
  }
}
