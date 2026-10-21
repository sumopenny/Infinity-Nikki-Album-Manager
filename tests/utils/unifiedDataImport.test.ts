import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearAllBrowserData } from '../../src/utils/file-system/database'
import { parseDataPreview, saveDataImport } from '../../src/utils/unifiedDataImport'
import {
  loadResonanceRecords,
  saveResonanceRecords
} from '../../src/utils/resonance/resonanceStorage'
import { createResonanceExport } from '../../src/utils/resonance/resonanceFile'
import {
  createWardrobeBackup,
  emptyWardrobe,
  loadWardrobe,
  updateWardrobe
} from '../../src/utils/wardrobe/wardrobeStorage'

export const notebook = {
  info_from_self: {
    suit_list: ['10347'],
    gacha_list: [
      {
        card_pool_id: 77,
        pool_cnt: 1,
        result: '1020100347',
        rarity: 5,
        times_from_last_five_stars: 16
      }
    ]
  }
}
beforeEach(() => clearAllBrowserData())
const baseline = async () => ({
  resonance: JSON.stringify(await loadResonanceRecords()),
  wardrobe: JSON.stringify(await loadWardrobe())
})

describe('unified import', () => {
  it.each(['cn', 'global'] as const)(
    'preserves explicit %s backup scope over the opposite selection',
    async (scope) => {
      const backup = JSON.parse(createWardrobeBackup({ ...emptyWardrobe(), regionScope: scope }))
      const preview = await parseDataPreview(backup, {
        regionScope: scope === 'cn' ? 'global' : 'cn'
      })
      expect(preview.wardrobe?.regionScope).toBe(scope)
      expect(backup.data.regionScope).toBe(scope)
    }
  )
  it('uses the selected scope for legacy backups without metadata and leaves unselected legacy parsing unchanged', async () => {
    const backup = JSON.parse(createWardrobeBackup(emptyWardrobe()))
    expect((await parseDataPreview(backup, { regionScope: 'global' })).wardrobe?.regionScope).toBe(
      'global'
    )
    expect((await parseDataPreview(backup)).wardrobe?.regionScope).toBeUndefined()
    expect(backup.data.regionScope).toBeUndefined()
  })
  it('imports direct wardrobe pieces without requiring suits or resonance records', async () => {
    const preview = await parseDataPreview({
      info_from_gm: { clothes: [{ item_id: 1020100347 }, { item_id: '1020100347' }] }
    })
    expect(preview.resonance).toBeNull()
    expect(preview.wardrobe?.entries).toEqual({
      '1020100347': { owned: true, source: 'pearpal' }
    })
    expect(preview.wardrobe?.unknownSuitIds).toEqual([])
  })
  it('reports only actual parsing stages for each data type', async () => {
    const report = vi.fn()
    const result = await parseDataPreview(notebook, { onProgress: report })
    expect(report.mock.calls.map(([stage]) => stage)).toEqual(['check', 'wardrobe', 'resonance'])
    expect(
      report.mock.calls.every(([, stages]) => stages.join(',') === 'check,wardrobe,resonance')
    ).toBe(true)
    report.mockClear()
    await parseDataPreview(createResonanceExport(result.resonance!), { onProgress: report })
    expect(report.mock.calls.map(([stage]) => stage)).toEqual(['check', 'resonance'])
    report.mockClear()
    await parseDataPreview(JSON.parse(createWardrobeBackup(result.wardrobe!)), {
      onProgress: report
    })
    expect(report.mock.calls.map(([stage]) => stage)).toEqual(['check', 'wardrobe'])
  })

  it('stops before parsing when the progress callback cancels the task', async () => {
    const controller = new AbortController()
    const report = vi.fn(() => controller.abort())
    await expect(
      parseDataPreview(notebook, { signal: controller.signal, onProgress: report })
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect(report).toHaveBeenCalledOnce()
    expect(await loadResonanceRecords()).toEqual([])
    expect((await loadWardrobe()).entries).toEqual({})
  })
  it('parses both notebook sections and enables only the supported type in dedicated backups', async () => {
    const preview = await parseDataPreview(notebook)
    expect(preview.resonance).toHaveLength(1)
    expect(Object.keys(preview.wardrobe!.entries)).toHaveLength(10)
    expect((await parseDataPreview(createResonanceExport(preview.resonance!))).wardrobe).toBeNull()
    expect(
      (await parseDataPreview(JSON.parse(createWardrobeBackup(preview.wardrobe!)))).resonance
    ).toBeNull()
    expect(
      (
        await parseDataPreview({
          info_from_self: { gacha_list: notebook.info_from_self.gacha_list }
        })
      ).wardrobe
    ).toBeNull()
    expect(
      (await parseDataPreview({ info_from_self: { suit_list: [], gacha_list: [] } })).resonance
    ).toBeNull()
    await expect(parseDataPreview({ info_from_self: {} })).rejects.toThrow('NO_IMPORT_DATA')
    expect((await parseDataPreview(createResonanceExport([]))).resonance).toEqual([])
  })
  it.each([
    [true, true],
    [true, false],
    [false, true]
  ])('replaces only selected modules: resonance=%s wardrobe=%s', async (resonance, wardrobe) => {
    const preview = await parseDataPreview(notebook)
    const oldRecords = preview.resonance!.map((record) => ({
      ...record,
      id: '76:10347',
      bannerId: '76'
    }))
    await saveResonanceRecords(oldRecords)
    await updateWardrobe(() => ({
      ...emptyWardrobe(),
      entries: { '1020100399': { owned: true, source: 'pearpal' } }
    }))
    const oldWardrobe = await loadWardrobe()
    await saveDataImport(preview, { resonance, wardrobe }, await baseline())
    expect(await loadResonanceRecords()).toEqual(resonance ? preview.resonance : oldRecords)
    expect((await loadWardrobe()).entries).toEqual(
      wardrobe ? preview.wardrobe!.entries : oldWardrobe.entries
    )
    if (!wardrobe) expect(await loadWardrobe()).toEqual(oldWardrobe)
  })
  it('rolls back both stores when wardrobe changes after preview', async () => {
    const preview = await parseDataPreview(notebook),
      base = await baseline()
    await updateWardrobe(() => ({
      ...emptyWardrobe(),
      entries: { '1020100399': { owned: true, source: 'pearpal' } }
    }))
    const changed = await loadWardrobe()
    await expect(
      saveDataImport(preview, { resonance: true, wardrobe: true }, base)
    ).rejects.toThrow('LOCAL_CHANGED')
    expect(await loadResonanceRecords()).toEqual([])
    expect(await loadWardrobe()).toEqual(changed)
  })
  it('rolls back the first store if writing the second store fails', async () => {
    const preview = await parseDataPreview(notebook),
      base = await baseline()
    const put = IDBObjectStore.prototype.put
    const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
      this: IDBObjectStore,
      value,
      key
    ) {
      if (this.name === 'wardrobe') throw new Error('write failed')
      return put.call(this, value, key)
    })
    try {
      await expect(
        saveDataImport(preview, { resonance: true, wardrobe: true }, base)
      ).rejects.toThrow('write failed')
      expect(await loadResonanceRecords()).toEqual([])
      expect(await loadWardrobe()).toEqual(emptyWardrobe())
    } finally {
      spy.mockRestore()
    }
  })
  it('rejects no selection without modifying either module', async () => {
    await expect(
      saveDataImport(
        await parseDataPreview(notebook),
        { resonance: false, wardrobe: false },
        await baseline()
      )
    ).rejects.toThrow('NO_SELECTION')
    expect(await loadResonanceRecords()).toEqual([])
    expect(await loadWardrobe()).toEqual(emptyWardrobe())
  })
})
