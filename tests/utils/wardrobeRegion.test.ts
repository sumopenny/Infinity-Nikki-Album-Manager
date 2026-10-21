import 'fake-indexeddb/auto'
import { beforeEach, expect, it } from 'vitest'
import { clearAllBrowserData } from '../../src/utils/file-system/database'
import { loadWardrobeCatalog } from '../../src/utils/wardrobe/wardrobeCatalog'
import {
  wardrobeCatalogForRegion,
  wardrobeRegionScope
} from '../../src/utils/wardrobe/wardrobeRegion'
import {
  createWardrobeBackup,
  emptyWardrobe,
  loadWardrobe,
  mergeWardrobe,
  parseWardrobeBackup,
  validateWardrobe
} from '../../src/utils/wardrobe/wardrobeStorage'
import { parseDataPreview, saveDataImport } from '../../src/utils/unifiedDataImport'

beforeEach(() => clearAllBrowserData())
it.each(['cn', 'global'] as const)(
  'filters the two regional pairs consistently for %s without changing the source catalog',
  async (scope) => {
    const catalog = await loadWardrobeCatalog()
    const view = wardrobeCatalogForRegion(catalog, scope)
    for (const [cn, global] of [
      ['1021720039', '1021720040'],
      ['1021780027', '1028780027']
    ]) {
      const included = scope === 'cn' ? cn : global
      const excluded = scope === 'cn' ? global : cn
      expect(view.byId.has(included)).toBe(true)
      expect(view.byId.has(excluded)).toBe(false)
      expect(
        view.entries.some((entry) => entry.id === excluded || entry.parts.includes(excluded))
      ).toBe(false)
      expect(catalog.byId.has(excluded)).toBe(true)
    }
  }
)
it('saves scope only with confirmed wardrobe data and preserves it in backups and empty-store restores', async () => {
  const preview = await parseDataPreview(
    { info_from_gm: { clothes: [{ item_id: '1020100347' }] } },
    { regionScope: 'global' }
  )
  expect(preview.wardrobe!.regionScope).toBe('global')
  expect((await loadWardrobe()).regionScope).toBeUndefined()
  await saveDataImport(
    preview,
    { resonance: false, wardrobe: true },
    { resonance: '', wardrobe: JSON.stringify(await loadWardrobe()) }
  )
  expect((await loadWardrobe()).regionScope).toBe('global')
  const backup = parseWardrobeBackup(createWardrobeBackup(await loadWardrobe()))
  await clearAllBrowserData()
  await mergeWardrobe(backup)
  expect((await loadWardrobe()).regionScope).toBe('global')
})
it('supports old snapshots and rejects invalid explicit scopes', () => {
  expect(wardrobeRegionScope(emptyWardrobe())).toBe('cn')
  const legacy = {
    ...emptyWardrobe(),
    entries: { '1028780027': { owned: true, source: 'pearpal' as const } }
  }
  expect(wardrobeRegionScope(legacy)).toBe('global')
  expect(wardrobeRegionScope({ ...legacy, regionScope: 'cn' })).toBe('cn')
  expect(() => validateWardrobe({ ...legacy, regionScope: 'invalid' })).toThrow('INVALID_WARDROBE')
  expect(parseWardrobeBackup(createWardrobeBackup(legacy))).toEqual(legacy)
})
