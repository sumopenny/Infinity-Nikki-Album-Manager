import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet } from '../../functions/api/outfit-code/[id]'

const makeContext = (id: string) => {
  const request = new Request(`https://example.test/api/outfit-code/${id}`)
  return { request, params: { id } }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('outfit-code Pages Function', () => {
  it('fetches only the matching object and forwards its body and content type', async () => {
    const upstream = new Response('{"clothes":[]}', {
      status: 200,
      headers: { 'content-type': 'application/octet-stream' }
    })
    const fetchMock = vi.fn().mockResolvedValue(upstream)
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet(makeContext('488547348102388135'))

    expect(fetchMock).toHaveBeenCalledWith(
      'https://x6cn-clothdiydata.nuanpaper.com/default/488547348102388135.json',
      { signal: expect.any(AbortSignal) }
    )
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/octet-stream')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-outfit-proxy-upstream-ms')).toMatch(/^\d+$/)
    await expect(response.text()).resolves.toBe('{"clothes":[]}')
  })

  it.each(['12345678901234567', '1234567890123456789', 'not-an-id'])(
    'rejects an invalid object path %s without fetching',
    async (id) => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)

      const response = await onRequestGet(makeContext(id))

      expect(response.status).toBe(400)
      await expect(response.json()).resolves.toEqual({ error: 'invalid_path_id' })
      expect(fetchMock).not.toHaveBeenCalled()
    }
  )

  it('preserves an upstream 404 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not found', { status: 404 })))

    const response = await onRequestGet(makeContext('488547348102388135'))

    expect(response.status).toBe(404)
    await expect(response.text()).resolves.toBe('not found')
  })

  it('returns 502 when the upstream request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network unavailable')))

    const response = await onRequestGet(makeContext('488547348102388135'))

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({ error: 'upstream_unavailable' })
  })

  it('returns 504 when the fixed upstream request times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Timed out', 'TimeoutError')))
    const timeoutMock = vi
      .spyOn(AbortSignal, 'timeout')
      .mockImplementation(() => AbortSignal.abort(new DOMException('Timed out', 'TimeoutError')))

    const response = await onRequestGet(makeContext('488547348102388135'))

    expect(response.status).toBe(504)
    expect(timeoutMock).toHaveBeenCalledWith(8_000)
    expect(response.headers.get('x-outfit-proxy-upstream-ms')).toMatch(/^\d+$/)
    await expect(response.json()).resolves.toEqual({ error: 'upstream_timeout' })
  })
})

it.each(['timeout', 'request'] as const)(
  'keeps %s protection active after response headers',
  async (source) => {
    const timeout = new AbortController(),
      client = new AbortController()
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(timeout.signal)
    let signal!: AbortSignal
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_url, init) => {
        signal = init.signal
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              signal.addEventListener('abort', () => controller.error(signal.reason), {
                once: true
              })
            }
          })
        )
      })
    )
    const response = await onRequestGet({
      request: new Request('https://example.test', { signal: client.signal }),
      params: { id: '488547348102388135' }
    })
    expect(signal.aborted).toBe(false)
    const text = response.text()
    const reason = new Error('body interrupted')
    ;(source === 'timeout' ? timeout : client).abort(reason)
    await expect(text).rejects.toThrow('body interrupted')
    expect(signal.aborted).toBe(true)
  }
)
it('cancels the upstream body when the downstream reader cancels', async () => {
  const cancel = vi.fn()
  let signal!: AbortSignal
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url, init) => {
      signal = init.signal
      return new Response(new ReadableStream({ cancel }))
    })
  )
  const response = await onRequestGet(makeContext('488547348102388135'))
  await response.body!.cancel('reader stopped')
  expect(signal.aborted).toBe(true)
  expect(cancel).toHaveBeenCalled()
})
