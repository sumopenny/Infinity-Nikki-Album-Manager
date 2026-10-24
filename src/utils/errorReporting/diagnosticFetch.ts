import { annotateDiagnosticError, trackDiagnostic } from './errorReporter'

/** 显式接入业务请求，不覆盖全局 fetch；不读取请求/响应正文或授权头。 */
export async function diagnosticFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const started = performance.now()
  let endpoint = 'unknown'
  try {
    const url = new URL(
      input instanceof Request ? input.url : String(input),
      typeof location === 'undefined' ? 'https://local.invalid' : location.href
    )
    endpoint = url.pathname.replace(/^(\/api\/(?:outfit-code|home-build))\/.*$/, '$1/:key')
  } catch {
    /* URL error is still raised by fetch. */
  }
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET')
  try {
    const response = await fetch(input, init)
    trackDiagnostic('network', 'request-complete', {
      endpoint,
      method,
      status: response.status,
      durationMs: Math.round(performance.now() - started),
      requestId: response.headers.get('X-Request-Id')
    })
    return response
  } catch (error) {
    const data = { endpoint, method, durationMs: Math.round(performance.now() - started) }
    trackDiagnostic('network', 'request-failed', data)
    annotateDiagnosticError(error, { stage: 'network', context: data })
    throw error
  }
}
