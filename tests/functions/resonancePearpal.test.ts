import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestPost } from '../../functions/api/resonance/pearpal'

const credentials = { token: 'sample-token', openid: 'sample-openid' }

function request(action: string, body = credentials, headers: HeadersInit = { 'content-type': 'application/json' }) {
  return new Request(`https://album.test/api/resonance/pearpal?action=${action}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  })
}

afterEach(() => vi.unstubAllGlobals())

describe('Pearpal Pages Function', () => {
  it('allows only the fixed user-info and notebook actions', async () => {
    const upstream = vi.fn<typeof fetch>(async () => Response.json({ code: 0, data: { role: { uid: '123' } } }))
    vi.stubGlobal('fetch', upstream)

    const response = await onRequestPost({ request: request('verify') })
    const [target, init] = upstream.mock.calls[0]!
    expect(new URL(String(target)).href).toBe('https://myl-api.nuanpaper.com/v1/strategy/user/info/get')
    expect(JSON.parse(String(init?.body))).toEqual({ client_id: 1106, token: 'sample-token', openid: 'sample-openid' })
    expect(new Headers(init?.headers).has('cookie')).toBe(false)
    expect(new Request(target, init).cache).toBe('no-store')
    expect(response.headers.get('cache-control')).toContain('no-store')
    await expect(response.json()).resolves.toMatchObject({ code: 0 })
  })

  it('returns the binary notebook response without enabling caching', async () => {
    const upstream = vi.fn<typeof fetch>(async () => new Response(new Uint8Array([1, 2, 3]), {
      headers: { 'content-type': 'application/octet-stream' }
    }))
    vi.stubGlobal('fetch', upstream)

    const response = await onRequestPost({ request: request('snapshot') })
    expect(new URL(String(upstream.mock.calls[0]?.[0])).pathname).toBe('/v1/strategy/user/note/book/info')
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1, 2, 3])
  })

  it('rejects unlisted actions and malformed credentials before contacting Pearpal', async () => {
    const upstream = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', upstream)

    const invalidAction = await onRequestPost({ request: request('other') })
    const invalidCredentials = await onRequestPost({ request: request('verify', { token: '', openid: '' }) })
    expect(invalidAction.status).toBe(400)
    expect(invalidCredentials.status).toBe(400)
    expect(upstream).not.toHaveBeenCalled()
  })

  it('does not forward an upstream failure body that could contain credentials', async () => {
    const upstream = vi.fn<typeof fetch>(async () => new Response('upstream echoed a secret token', { status: 500 }))
    vi.stubGlobal('fetch', upstream)

    const response = await onRequestPost({ request: request('verify') })
    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'upstream_rejected' })
  })
})
