import type { ResonanceRecord } from './resonanceTypes'

export interface CloudUser { id: string; username: string }
export interface CloudSnapshot { revision: number; updated_at: number; active_snapshot: string | null; records: ResonanceRecord[] }

/** 同源 Cookie 鉴权；账户头防止其他标签页切换登录后误写入另一人的存档。 */
export async function cloudRequest<T>(action: string, user?: CloudUser | null, body?: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 90000)
  try {
    const response = await fetch(`/api/resonance/cloud?action=${action}`, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      headers: { 'X-Resonance-Request': '1', ...(user ? { 'X-Resonance-Account': user.id } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    })
    const result = await response.json().catch(() => { throw new Error('NOT_CONFIGURED') })
    if (!response.ok) throw new Error(result.error || 'SERVER_ERROR')
    return result as T
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('NETWORK')
    throw error
  } finally { clearTimeout(timer) }
}
