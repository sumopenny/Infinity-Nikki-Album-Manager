import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet } from '../../functions/api/home-build/[key]'

const context = () => ({
  params: { key: 'UDB66QH' },
  request: new Request('https://example.test/api/home-build/UDB66QH'),
  data: {} as Record<string, unknown>
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('home build proxy', () => {
  it.each([200, 206])('preserves successful binary content (%s)', async (status) => {
    const bytes = new Uint8Array([0, 255, 123, 10])
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(bytes, { status })))
    const response = await onRequestGet(context())
    expect(response.status).toBe(200)
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes)
    expect(fetch).toHaveBeenCalledOnce()
  })
  it.each([404, 410])(
    'does not report missing resources as server failures (%s)',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('missing', { status })))
      const response = await onRequestGet(context())
      expect(response.status).toBe(404)
      expect(await response.json()).toEqual({ ok: false, errorCode: 'home_build_not_found' })
      expect(fetch).toHaveBeenCalledOnce()
    }
  )
  it.each([502, 503, 504, 'network'])(
    'recovers once from a transient %s failure',
    async (status) => {
      const fetcher = vi.fn()
      if (typeof status === 'number')
        fetcher.mockResolvedValueOnce(new Response('busy', { status }))
      else fetcher.mockRejectedValueOnce(new TypeError('network failed'))
      fetcher.mockResolvedValueOnce(new Response(new Uint8Array([42])))
      vi.stubGlobal('fetch', fetcher)
      const ctx = context()
      const response = await onRequestGet(ctx)
      expect(response.status).toBe(200)
      expect(await response.arrayBuffer()).toEqual(new Uint8Array([42]).buffer)
      expect(fetcher).toHaveBeenCalledTimes(2)
      expect(fetcher.mock.calls[0][1].signal).toBe(fetcher.mock.calls[1][1].signal)
      expect(ctx.data.diagnosticFailure).toBeUndefined()
    }
  )
  it('stops after two attempts and retains safe upstream diagnostics', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(async () => new Response('private body', { status: 503 }))
    )
    const ctx = context()
    expect((await onRequestGet(ctx)).status).toBe(502)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(ctx.data.diagnosticFailure).toMatchObject({
      upstreamStatus: 503,
      attempts: 2,
      stage: 'response',
      timedOut: false
    })
    expect(JSON.stringify(ctx.data)).not.toMatch(/private body|UDB66QH/)
  })
  it('does not retry a rejection such as 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 403 })))
    const ctx = context()
    expect((await onRequestGet(ctx)).status).toBe(502)
    expect(fetch).toHaveBeenCalledOnce()
    expect(ctx.data.diagnosticFailure).toMatchObject({ upstreamStatus: 403, attempts: 1 })
  })
  it.each(['timeout', 'client'] as const)(
    'handles %s interruption while reading the body',
    async (source) => {
      const timeout = new AbortController(),
        client = new AbortController()
      vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
      let ready = false
      vi.stubGlobal(
        'fetch',
        vi.fn(
          async (_url, init) =>
            new Response(
              new ReadableStream({
                start(controller) {
                  init.signal.addEventListener(
                    'abort',
                    () => controller.error(init.signal.reason),
                    { once: true }
                  )
                  ready = true
                }
              })
            )
        )
      )
      const ctx = {
        ...context(),
        request: new Request('https://example.test', { signal: client.signal })
      }
      const pending = onRequestGet(ctx)
      await vi.waitFor(() => expect(ready).toBe(true))
      ;(source === 'timeout' ? timeout : client).abort(new DOMException('stopped', 'AbortError'))
      const response = await pending
      expect(response.status).toBe(source === 'timeout' ? 504 : 499)
      expect(await response.json()).toEqual({
        ok: false,
        errorCode: source === 'timeout' ? 'upstream_timeout' : 'request_aborted'
      })
      expect(fetch).toHaveBeenCalledOnce()
    }
  )
  it('does not retry after the total deadline expires during fetch', async () => {
    const timeout = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        timeout.abort()
        throw new DOMException('timeout', 'TimeoutError')
      })
    )
    expect((await onRequestGet(context())).status).toBe(504)
    expect(fetch).toHaveBeenCalledOnce()
  })
  it('rejects oversized bodies and records interrupted streams', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(new Uint8Array(8 * 1024 * 1024 + 1)))
    )
    expect((await onRequestGet(context())).status).toBe(413)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          new ReadableStream({
            start(c) {
              c.error(new TypeError('private URL'))
            }
          })
        )
      )
    )
    const ctx = context()
    expect((await onRequestGet(ctx)).status).toBe(502)
    expect(ctx.data.diagnosticFailure).toMatchObject({
      stage: 'read-body',
      upstreamErrorName: 'TypeError'
    })
    expect(JSON.stringify(ctx.data)).not.toContain('private URL')
  })
})
