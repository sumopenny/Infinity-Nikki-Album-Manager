const MAX_RESPONSE_BYTES = 8 * 1024 * 1024
const KEY_PATTERN = /^[A-Za-z0-9]{1,29}$/

interface PagesFunctionContext {
  params: Record<string, string | undefined>
}

function jsonError(status: number, code: string): Response {
  return Response.json({ ok: false, errorCode: code }, {
    status,
    headers: { 'cache-control': 'no-store' }
  })
}

/** 只代理家园方案固定 CDN 的对象键，限制响应大小以避免代理被用于大流量转发。 */
export async function onRequestGet(context: PagesFunctionContext): Promise<Response> {
  const key = context.params.key ?? ''
  if (!KEY_PATTERN.test(key)) return jsonError(400, 'resource_key_invalid')

  let upstream: Response
  try {
    upstream = await fetch(`https://x6cn-home-build-data.nuanpaper.com/default/${key}`, {
      headers: { Range: 'bytes=0-' },
      signal: AbortSignal.timeout(15_000)
    })
  } catch {
    return jsonError(502, 'upstream_unavailable')
  }

  if (upstream.status !== 200 && upstream.status !== 206) return jsonError(502, 'upstream_response_invalid')
  const declaredLength = Number(upstream.headers.get('content-length') ?? 0)
  if (declaredLength > MAX_RESPONSE_BYTES) return jsonError(413, 'response_too_large')
  if (!upstream.body) return jsonError(502, 'upstream_body_missing')

  const reader = upstream.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel()
        return jsonError(413, 'response_too_large')
      }
      chunks.push(value)
    }
  } catch {
    return jsonError(502, 'upstream_read_failed')
  }

  const body = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'application/octet-stream',
      'content-length': String(body.byteLength),
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  })
}
