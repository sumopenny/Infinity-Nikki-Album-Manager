import { diagnosticFetch } from '../errorReporting/diagnosticFetch'
import { annotateDiagnosticError } from '../errorReporting/errorReporter'

export interface CloudUser {
  id: string
  username: string
}
export class CloudRequestError extends Error {
  constructor(
    code: string,
    public traceId?: string,
    options?: ErrorOptions
  ) {
    super(code, options)
    annotateDiagnosticError(this, {
      code: /^[A-Z][A-Z0-9_]{0,79}$/.test(code) ? code : 'SERVER_ERROR',
      context: { requestId: traceId }
    })
  }
}

/** 仅传输同源请求；非 JSON 网关错误是结果不明，不能伪装成空存档或成功。 */
export async function requestCloud<T>(
  path: string,
  action: string,
  user?: CloudUser | null,
  body?: unknown
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  try {
    const response = await diagnosticFetch(`${path}?action=${encodeURIComponent(action)}`, {
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'X-Resonance-Request': '1',
        ...(user ? { 'X-Resonance-Account': user.id } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) })
    })
    const traceId = response.headers.get('X-Request-Id') ?? undefined
    const result = await response.json().catch(() => {
      throw new CloudRequestError('SERVER_ERROR', traceId)
    })
    if (!response.ok)
      throw new CloudRequestError(
        typeof result?.error === 'string' ? result.error : 'SERVER_ERROR',
        traceId
      )
    if (!result || typeof result !== 'object') throw new CloudRequestError('SERVER_ERROR', traceId)
    return result as T
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError'))
      throw new CloudRequestError('NETWORK', undefined, { cause: error })
    throw error
  } finally {
    clearTimeout(timer)
  }
}
