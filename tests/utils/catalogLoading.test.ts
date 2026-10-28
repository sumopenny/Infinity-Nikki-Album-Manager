import { afterEach, expect, it, vi } from 'vitest'
import type { ResonanceRecord } from '../../src/utils/resonance/resonanceTypes'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

it('shares raw resource requests and keeps languages independently accessible', async () => {
  const { catalogResources, loadCatalogNames } =
    await import('../../src/utils/gongeo/catalogResources')
  const first = catalogResources.outfitItems()
  expect(catalogResources.outfitItems()).toBe(first)
  const parts = await first
  expect(parts.length).toBeGreaterThan(0)
  const [zh, en] = await Promise.all([
    loadCatalogNames('item', 'zh'),
    loadCatalogNames('item', 'en')
  ])
  expect(zh['item.1020100347.name']).toBeTruthy()
  expect(en['item.1020100347.name']).toBeTruthy()
  expect(zh['item.1020100347.name']).not.toBe(en['item.1020100347.name'])
})

it('retries a failed resonance catalog build and deduplicates concurrent construction', async () => {
  const { catalogResources } = await import('../../src/utils/gongeo/catalogResources')
  const original = catalogResources.outfits
  const load = vi
    .spyOn(catalogResources, 'outfits')
    .mockRejectedValueOnce(new Error('offline'))
    .mockImplementation(original)
  const { loadResonanceCatalog } = await import('../../src/utils/resonance/resonanceCatalog')
  const failed = loadResonanceCatalog()
  expect(loadResonanceCatalog()).toBe(failed)
  await expect(failed).rejects.toThrow('offline')
  const next = loadResonanceCatalog()
  expect(loadResonanceCatalog()).toBe(next)
  expect((await next).loadResonanceBanners().length).toBeGreaterThan(0)
  expect(load).toHaveBeenCalledTimes(2)
})

it('round trips a standard resonance backup without importing its full catalog', async () => {
  const catalogImport = vi.fn(() => {
    throw new Error('Catalog must remain unloaded')
  })
  vi.doMock('../../src/utils/resonance/resonanceCatalog', catalogImport)
  try {
    const { createResonanceExport, parseResonanceFile } =
      await import('../../src/utils/resonance/resonanceFile')
    const records: ResonanceRecord[] = [
      {
        id: '77:10347',
        bannerId: '77',
        bannerName: { zh: '卡池', en: 'Banner' },
        bannerStartAt: '',
        outfitId: '10347',
        outfitName: { zh: '套装', en: 'Outfit' },
        rarity: 5 as const,
        outfitImageUrl: '',
        sets: [
          { setNumber: 1 as const, totalPulls: 0, parts: [] },
          { setNumber: 2 as const, totalPulls: 0, parts: [] }
        ]
      }
    ]
    expect((await parseResonanceFile(createResonanceExport(records))).records).toEqual(records)
    expect(catalogImport).not.toHaveBeenCalled()
  } finally {
    vi.doUnmock('../../src/utils/resonance/resonanceCatalog')
  }
})
