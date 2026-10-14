interface OutfitCodeFunctionContext {
  request: Request
  params: { id?: string }
}

const UPSTREAM_BASE_URL = 'https://x6cn-clothdiydata.nuanpaper.com/default/'
const UPSTREAM_TIMEOUT_MS = 8_000
const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
}

/** Forward the fixed object path, keeping cancellation alive through body delivery. */
export async function onRequestGet(context: OutfitCodeFunctionContext): Promise<Response> {
  const pathId = context.params.id ?? ''
  if (!/^\d{18}$/.test(pathId))
    return Response.json({ error: 'invalid_path_id' }, { status: 400, headers: JSON_HEADERS })
  const startedAt = Date.now()
  const timeoutSignal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
  const controller = new AbortController()
  const abortForRequest = () => controller.abort(context.request.signal.reason)
  const abortForTimeout = () => controller.abort(timeoutSignal.reason)
  const cleanup = () => {
    context.request.signal.removeEventListener('abort', abortForRequest)
    timeoutSignal.removeEventListener('abort', abortForTimeout)
  }
  context.request.signal.addEventListener('abort', abortForRequest, { once: true })
  timeoutSignal.addEventListener('abort', abortForTimeout, { once: true })
  if (context.request.signal.aborted) abortForRequest()
  if (timeoutSignal.aborted) abortForTimeout()
  try {
    const upstream = await fetch(UPSTREAM_BASE_URL + pathId + '.json', {
      signal: controller.signal
    })
    const headersAt = Date.now()
    const headers = new Headers({
      'cache-control': 'private, no-store',
      'server-timing': `upstream_headers;dur=${headersAt - startedAt}`,
      'x-outfit-proxy-upstream-ms': String(headersAt - startedAt)
    })
    for (const key of ['content-type', 'x-oss-request-id']) {
      const value = upstream.headers.get(key)
      if (value) headers.set(key === 'x-oss-request-id' ? 'x-outfit-proxy-request-id' : key, value)
    }
    if (!upstream.body) {
      cleanup()
      return new Response(null, { status: upstream.status, headers })
    }
    const reader = upstream.body.getReader()
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      cleanup()
      reader.releaseLock()
    }
    // pull() respects downstream backpressure instead of eagerly buffering the body.
    const body = new ReadableStream<Uint8Array>({
      async pull(downstream) {
        try {
          const { value, done } = await reader.read()
          if (finished) return
          if (done) {
            downstream.close()
            finish()
          } else downstream.enqueue(value)
        } catch (error) {
          if (!finished) {
            downstream.error(error)
            finish()
          }
        }
      },
      async cancel(reason) {
        controller.abort(reason)
        try {
          await reader.cancel(reason)
        } finally {
          finish()
        }
      }
    })
    return new Response(body, { status: upstream.status, headers })
  } catch {
    cleanup()
    const timedOut = timeoutSignal.aborted && !context.request.signal.aborted
    const totalMs = Date.now() - startedAt
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
  }
}
