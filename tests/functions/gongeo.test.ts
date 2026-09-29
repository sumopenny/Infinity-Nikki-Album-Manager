import { afterEach, describe, expect, it, vi } from 'vitest'
import { onRequestGet } from '../../functions/api/gongeo/[...path]'

afterEach(() => vi.unstubAllGlobals())

describe('Gongeo Pages proxy', () => {
  it('forwards makeup detail paths and language', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{"id":1}', {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet({
      request: new Request('https://example.test/api/gongeo/makeups/1021850019?lang=zh'),
      params: { path: 'makeups/1021850019' }
    })

    expect(response.status).toBe(200)
    expect(String(fetchMock.mock.calls[0][0])).toBe('https://data.gongeo.us/v1/makeups/1021850019?lang=zh')
    expect(fetchMock.mock.calls[0][1].headers).toEqual({ Accept: 'application/json' })
  })

  it('rejects paths outside the catalog detail endpoints', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await onRequestGet({
      request: new Request('https://example.test/api/gongeo/proxy?url=https://evil.test'),
      params: { path: 'proxy' }
    })

    expect(response.status).toBe(400)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
