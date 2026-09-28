import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearOutfitDetailCache, loadOutfitDetail } from '../../src/utils/outfit/outfitDetails'

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

const sampleDyes = [
  { targetGroupId: 1, featureTag: 1, paletteId: 18, slot: 3, color: '#9e463e' },
  { targetGroupId: 1, featureTag: 1, paletteId: 18, slot: 3, color: '#9e463e' },
  { targetGroupId: 1, featureTag: 3, paletteId: 18, slot: 3, color: '#553322' }
]

afterEach(() => {
  clearOutfitDetailCache()
  vi.unstubAllGlobals()
})

describe('loadOutfitDetail', () => {
  it('uses the part-to-outfit relation and maps palette, area, dye stage, and variant', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 1020100001 }))
      .mockResolvedValueOnce(jsonResponse({ id: 10001 }))
    vi.stubGlobal('fetch', fetchMock)

    const detail = await loadOutfitDetail(1020100001, 10347, 'zh', '时光讯号-发型', sampleDyes)

    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/gongeo/outfits/10001?lang=zh')
    expect(detail.outfitId).toBe(10001)
    expect(detail.outfitName).toBe('绽响黎明前')
    expect(detail.outfitImageUrl).toContain('/images/outfits/10001.png')
    expect(detail.outfitItemIds).toContain(1020100001)
    expect(detail.evolution).toBe('原套')
    expect(detail.dyeCondition).toBe('1进可染')
    expect(detail.dyes).toHaveLength(2)
    expect(detail.dyes[0]).toMatchObject({ area: '区域 01', paletteName: '名流鸦盛宴', slot: 3 })
    expect(detail.dyes[1].area).toBe('区域 02')
  })

  it('caches the same detail request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 1020100001 }))
      .mockResolvedValueOnce(jsonResponse({ id: 10001 }))
    vi.stubGlobal('fetch', fetchMock)
    const first = loadOutfitDetail(1020100001, 10001, 'en', 'Signal of Time-Hair', [])
    const second = loadOutfitDetail(1020100001, 10001, 'en', 'Signal of Time-Hair', [])
    expect(await first).toBe(await second)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('keeps item details readable and marks failed API requests', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    const detail = await loadOutfitDetail(1020720412, null, 'zh', '兽耳轻探-帽子', [])
    expect(detail.loadError).toBe(true)
    expect(detail.itemName).toBe('兽耳轻探-帽子')
    expect(detail.dyes).toEqual([])
  })

  it('does not present an item name as an outfit when no catalog relation exists', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 1020200490 })))
    const detail = await loadOutfitDetail(1020200490, 10490, 'zh', '暮巷赤影-披肩', [])
    expect(detail.outfitId).toBeNull()
    expect(detail.outfitName).toBe('')
    expect(detail.outfitImageUrl).toBeNull()
  })

  it('uses the current makeup part image when no outfit relation exists', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const detail = await loadOutfitDetail(1021810010, null, 'zh', '妆容-睫毛', [], 85)

    expect(fetchMock).not.toHaveBeenCalled()
    expect(detail.outfitName).toBe('')
    expect(detail.detailImageUrl).toContain('/images/items/1021810010.png')
    expect(detail.loadError).toBe(false)
  })
})
