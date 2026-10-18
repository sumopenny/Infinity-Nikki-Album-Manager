import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestCatalogEntity, clearCatalogApiCache } from '../../src/utils/gongeo/catalogApi'
import { clearOutfitDetailCache } from '../../src/utils/outfit/outfitDetails'

const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })
afterEach(() => {
  clearCatalogApiCache()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('shared catalog requests', () => {
  it('separates entity, variant and language, expires successful responses, and shares cache clearing', async () => {
    vi.useFakeTimers()
    const fetcher = vi.fn(async () => response({ description: 'Real description' }))
    vi.stubGlobal('fetch', fetcher)
    const first = await requestCatalogEntity('/outfits/1029402', 'zh')
    expect(await requestCatalogEntity('/outfits/1029402', 'zh')).toBe(first)
    await requestCatalogEntity('/outfits/10294', 'zh')
    await requestCatalogEntity('/outfits/1029402', 'en')
    expect(fetcher).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(300001)
    await requestCatalogEntity('/outfits/1029402', 'zh')
    expect(fetcher).toHaveBeenCalledTimes(4)
    clearOutfitDetailCache()
    await requestCatalogEntity('/outfits/1029402', 'zh')
    expect(fetcher).toHaveBeenCalledTimes(5)
  })

  it('does not cache network, HTTP, JSON or shape failures', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(new Response('invalid json'))
      .mockResolvedValueOnce(response([]))
      .mockImplementation(async () => response({ description: 'Recovered' }))
    vi.stubGlobal('fetch', fetcher)
    for (let n = 0; n < 4; n++)
      await expect(requestCatalogEntity('/outfits/1029402', 'zh')).rejects.toThrow()
    expect(await requestCatalogEntity('/outfits/1029402', 'zh')).toMatchObject({
      description: 'Recovered'
    })
    await requestCatalogEntity('/outfits/1029402', 'zh')
    expect(fetcher).toHaveBeenCalledTimes(5)
  })

  it('propagates cancellation through the response body and never caches an aborted response', async () => {
    let finish!: (value: unknown) => void
    let networkSignal!: AbortSignal
    const fetcher = vi.fn(async (_url, init) => {
      networkSignal = init.signal
      return {
        ok: true,
        json: () =>
          new Promise((resolve) => {
            finish = resolve
          })
      }
    })
    vi.stubGlobal('fetch', fetcher)
    const controller = new AbortController()
    const pending = requestCatalogEntity('/outfits/1029402', 'zh', controller.signal)
    const check = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    await Promise.resolve()
    controller.abort()
    expect(networkSignal.aborted).toBe(true)
    finish({ description: 'Late' })
    await check
    fetcher.mockImplementation(async () => response({ description: 'Retry' }))
    expect(await requestCatalogEntity('/outfits/1029402', 'zh')).toMatchObject({
      description: 'Retry'
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('times out stalled requests and removes its timer', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url, init) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener('abort', () =>
              reject(new DOMException('Aborted', 'AbortError'))
            )
          })
      )
    )
    const check = expect(requestCatalogEntity('/outfits/1029402', 'zh')).rejects.toThrow()
    await vi.advanceTimersByTimeAsync(8001)
    await check
    expect(vi.getTimerCount()).toBe(0)
  })

  it('prevents an in-flight request from repopulating a cleared cache', async () => {
    let finish!: (value: Response) => void
    const fetcher = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
      .mockImplementation(async () => response({ description: 'New' }))
    vi.stubGlobal('fetch', fetcher)
    const pending = requestCatalogEntity('/outfits/1029402', 'zh')
    clearCatalogApiCache()
    finish(response({ description: 'Old' }))
    await pending
    expect(await requestCatalogEntity('/outfits/1029402', 'zh')).toMatchObject({
      description: 'New'
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('rejects invalid paths and pre-aborted callers without sending requests', async () => {
    const fetcher = vi.fn()
    vi.stubGlobal('fetch', fetcher)
    await expect(requestCatalogEntity('/outfits/1/../../private', 'zh')).rejects.toThrow()
    const controller = new AbortController()
    controller.abort()
    await expect(requestCatalogEntity('/outfits/10294', 'zh', controller.signal)).rejects.toThrow()
    expect(fetcher).not.toHaveBeenCalled()
  })
})
