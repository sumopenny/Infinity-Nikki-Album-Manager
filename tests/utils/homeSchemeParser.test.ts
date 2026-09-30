import { beforeEach, describe, expect, it, vi } from 'vitest'

const { decodeCode, parseResponse, getCache, saveCache } = vi.hoisted(() => ({
  decodeCode: vi.fn(),
  parseResponse: vi.fn(),
  getCache: vi.fn(),
  saveCache: vi.fn()
}))

vi.mock('../../src/utils/homeBuild/homeBuildWasmClient', () => ({
  decodeHomeBuildShareCode: decodeCode,
  parseHomeBuildResponse: parseResponse
}))
vi.mock('../../src/utils/file-system/directoryStorage', () => ({
  getSavedHomeSchemeParseResult: getCache,
  saveHomeSchemeParseResult: saveCache
}))

import { parseHomeScheme } from '../../src/utils/homeBuild/homeSchemeParser'

describe('home scheme parser service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    decodeCode.mockResolvedValue({
      ok: true,
      value: { code: '1UDB66QH', serverId: 49, resourceKey: 'resource', requestPath: '/resource' }
    })
    getCache.mockResolvedValue(undefined)
    saveCache.mockResolvedValue(undefined)
    parseResponse.mockResolvedValue({
      ok: true,
      value: {
        Name: '方案', TemplateType: 0, CoverImage: '', version: '1.0',
        PlaceInfo: [{}, {}], LastModifyTime: 12
      }
    })
    vi.mocked(fetch).mockResolvedValue(new Response(new Uint8Array([1, 2]), { status: 200 }))
  })

  it('uses a parser-version cache hit without requesting the CDN proxy', async () => {
    const result = {
      code: '1UDB66QH', name: '缓存名', templateType: 1 as const, server: 49,
      coverImage: null, version: 'cached', furnitureCount: 4, lastModifyTime: 7
    }
    getCache.mockResolvedValue({ code: result.code, result, cachedAt: 1, parserVersion: 'wire-v1' })

    await expect(parseHomeScheme('1UDB66QH')).resolves.toEqual(result)
    expect(fetch).not.toHaveBeenCalled()
    expect(saveCache).not.toHaveBeenCalled()
  })

  it('rejects an unverified server before making a request', async () => {
    decodeCode.mockResolvedValue({ ok: true, value: { code: '1UDB66QH', serverId: 50, resourceKey: 'x' } })

    await expect(parseHomeScheme('17TLJ1EW')).rejects.toThrow('home_build_server_unsupported')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('maps parsed fields and stores a cache entry for a fresh response', async () => {
    const result = await parseHomeScheme('1UDB66QH')

    expect(result).toMatchObject({
      code: '1UDB66QH', name: '方案', templateType: 0, server: 49,
      furnitureCount: 2, lastModifyTime: 12, coverImage: null
    })
    expect(fetch).toHaveBeenCalledWith('/api/home-build/resource', expect.objectContaining({
      headers: { Accept: 'application/octet-stream' }
    }))
    expect(saveCache).toHaveBeenCalledWith('1UDB66QH', expect.objectContaining({
      code: '1UDB66QH', parserVersion: 'wire-v1', result
    }))
  })
})
