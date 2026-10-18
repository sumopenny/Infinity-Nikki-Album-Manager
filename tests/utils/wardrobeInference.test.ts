import { describe, expect, it } from 'vitest'
import { loadWardrobeCatalog } from '../../src/utils/wardrobe/wardrobeCatalog'
import { parseWardrobePearpal } from '../../src/utils/wardrobe/wardrobeImport'
import banners from '../../src/data/gongeo/banners.json'
import { matchesWardrobeSource } from '../../src/utils/wardrobe/wardrobeFilters'
import items from '../../src/data/gongeo/items.json'
import metadata from '../../src/data/gongeo/filterMetadata.json'

describe('wardrobe reward and evolution inference', () => {
  it.each([4, 5, 14, 15])('infers only unlocked rewards at %i pulls', async (total) => {
    const catalog = await loadWardrobeCatalog()
    const snapshot = parseWardrobePearpal(
      {
        info_from_self: {
          suit_list: [],
          gacha_list: [{ card_pool_id: 79, pool_cnt: total - 1, result: 1 }]
        }
      },
      catalog
    ).snapshot
    const rewards = banners.find((b) => b.bannerId === 79)!.rewardIds!
    for (const [index, id] of rewards.entries()) {
      if (catalog.byId.get(id)?.kind === 'item')
        expect(!!snapshot.entries[id]?.owned).toBe(index < Math.floor(total / 5))
    }
  })
  it.each([179, 180, 229, 230])(
    'matches Pearpal completion and evolution boundaries at %i pulls',
    async (total) => {
      const catalog = await loadWardrobeCatalog()
      const banner = banners.find(
        (b) => b.bannerType === 2 && (b.outfit5StarId as string[]).includes('10347')
      )!
      const outfit = catalog.byId.get('10347')!
      const rows = outfit.parts.map((result, index) => ({
        result,
        card_pool_id: banner.bannerId,
        pool_cnt: index === 0 ? total - 1 : index
      }))
      const imported = parseWardrobePearpal(
        { info_from_self: { suit_list: [], gacha_list: rows } },
        catalog
      ).snapshot
      for (const [suffix, owned] of [
        ['01', true],
        ['02', total >= 180],
        ['03', total >= 230],
        ['04', false]
      ] as const) {
        for (const id of catalog.byId.get('10347' + suffix)!.parts)
          expect(!!imported.entries[id]?.owned).toBe(owned)
      }
      const partial = parseWardrobePearpal(
        { info_from_self: { suit_list: [], gacha_list: rows.slice(0, -1) } },
        catalog
      ).snapshot
      expect(catalog.byId.get('1034702')!.parts.some((id) => partial.entries[id]?.owned)).toBe(
        false
      )
    }
  )
  it('matches every reward family like the upstream listing, without including outfits', async () => {
    const catalog = await loadWardrobeCatalog()
    const rewards = new Set(metadata.deepEchoRewardIds)
    const expected = new Set(
      (items as unknown as unknown[][]).flatMap((row) => {
        const ids = (Array.isArray(row[0]) ? row[0] : [row[0]]).map(String)
        return ids.some((id) => rewards.has(id)) ? ids : []
      })
    )
    const limited = new Set(metadata.sources.find((s) => s.key === 'limited')!.ids)
    for (const entry of catalog.entries)
      expect(matchesWardrobeSource(entry, 'limited-reward'), entry.id).toBe(
        entry.kind === 'item' && expected.has(entry.id) && limited.has(entry.obtainType!)
      )
  })
  it('never infers permanent evolutions or rewards from malformed counts', async () => {
    const catalog = await loadWardrobeCatalog()
    const outfit = catalog.byId.get('10093')!
    const snapshot = parseWardrobePearpal(
      {
        info_from_self: {
          suit_list: [],
          gacha_list: [
            ...outfit.parts.map((result, index) => ({
              result,
              card_pool_id: 1,
              pool_cnt: 300 + index
            })),
            { result: 1, card_pool_id: 79, pool_cnt: null }
          ]
        }
      },
      catalog
    ).snapshot
    expect(Object.keys(snapshot.entries).sort()).toEqual([...outfit.parts].sort())
  })
})
