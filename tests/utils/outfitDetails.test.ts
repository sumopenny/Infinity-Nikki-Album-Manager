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
    expect(detail.dyes).toHaveLength(3)
    expect(detail.dyes[0]).toMatchObject({ area: '区域 01', paletteName: '名流鸦盛宴', slot: 3 })
    expect(detail.dyes[2].area).toBe('区域 02')
  })

  it('keeps the parsed item on the matching evolution outfit when the payload outfit is the base ID', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 1022100347 }))
      .mockResolvedValueOnce(jsonResponse({ id: 1034701 }))
    vi.stubGlobal('fetch', fetchMock)

    const detail = await loadOutfitDetail(1022100347, 10347, 'zh', '如果爱上一朵花-发型', [])

    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/gongeo/outfits/1034701?lang=zh')
    expect(detail.outfitId).toBe(1034701)
    expect(detail.outfitName).toBe('如果爱上一朵花·青涩')
    expect(detail.evolution).toBe('焕新')
    expect(detail.outfitItemIds).toContain(1022100347)
  })

  it('labels negative dye palettes as sliders', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 1020100001 })))

    const detail = await loadOutfitDetail(
      1020100001,
      null,
      'zh',
      '时光讯号-发型',
      [{ targetGroupId: 1, featureTag: 3, paletteId: -1, slot: null, color: '#bcbcbc' }]
    )

    expect(detail.dyes[0]).toMatchObject({ paletteId: -1, paletteName: '拉条' })
  })

  it('keeps non-primary dye feature tags on their upstream target group area', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 1020100250 })))

    const detail = await loadOutfitDetail(
      1020100250,
      null,
      'zh',
      '测试部件',
      [{ targetGroupId: 3, featureTag: 6, paletteId: 18, slot: 3, color: '#9e463e' }]
    )

    expect(detail.dyes[0].area).toBe('区域 03')
  })

  it('uses the exact flower-part area catalog so primary and secondary regions do not overlap', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 1025900347 })))

    const dyes = [
      ...Array.from({ length: 12 }, (_, index) => ({
        targetGroupId: index + 1,
        featureTag: 1,
        paletteId: 18,
        slot: null,
        color: `#${String(index + 1).padStart(2, '0')}0000`
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        targetGroupId: index + 1,
        featureTag: 3,
        paletteId: 17,
        slot: null,
        color: `#00${String(index + 1).padStart(2, '0')}00`
      }))
    ]

    const detail = await loadOutfitDetail(1025900347, null, 'zh', '如果有朵花', dyes)
    const areas = detail.dyes.map((dye) => dye.area)

    expect(new Set(areas).size).toBe(areas.length)
    expect(areas).toEqual(Array.from({ length: 20 }, (_, index) => `区域 ${String(index + 1).padStart(2, '0')}`))
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

  it('loads makeup detail through the makeup API and keeps the part image without an outfit relation', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      return url.includes('/makeups/')
        ? jsonResponse({ id: 1021850019 })
        : jsonResponse({ id: 10015002 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const detail = await loadOutfitDetail(1021850019, null, 'zh', '妆容-唇妆', [], null)

    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/gongeo/makeups/1021850019?lang=zh')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/gongeo/items/'))).toBe(false)
    expect(detail.outfitName).toBe('')
    expect(detail.detailImageUrl).toContain('/images/items/1021850019.png')
    expect(detail.loadError).toBe(false)
  })

  it('resolves a makeup outfit through makeup item and makeup outfit relations', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      return url.includes('/outfits/')
        ? jsonResponse({ id: 10001 })
        : jsonResponse({ id: 1021810001 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const detail = await loadOutfitDetail(1020810001, null, 'zh', '妆容-全妆', [], null)

    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      expect.stringContaining('/api/gongeo/makeups/1020810001?lang=zh'),
      expect.stringContaining('/api/gongeo/outfits/10001?lang=zh')
    ])
    expect(detail.outfitId).toBe(10001)
    expect(detail.outfitImageUrl).toContain('/images/outfits/10001.png')
    expect(detail.dyeCondition).toBe('无')
    expect(detail.loadError).toBe(false)
  })

  it('routes the reported makeup component IDs through the makeup API without cloth types', async () => {
    const itemIds = [1021850019, 1021810010, 1025820301, 1020830355, 1020840239]
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input)
      const id = Number(url.match(/\/(?:makeups|outfits)\/(\d+)/)?.[1])
      return jsonResponse({ id })
    })
    vi.stubGlobal('fetch', fetchMock)

    await Promise.all(itemIds.map((itemId) => (
      loadOutfitDetail(itemId, null, 'zh', String(itemId), [], null)
    )))

    const requests = fetchMock.mock.calls.map(([url]) => String(url))
    expect(itemIds.every((itemId) => requests.includes(`/api/gongeo/makeups/${itemId}?lang=zh`))).toBe(true)
    expect(requests.some((url) => url.includes('/api/gongeo/items/'))).toBe(false)
  })
})
