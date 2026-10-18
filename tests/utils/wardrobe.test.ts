import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllBrowserData, openDb } from '../../src/utils/file-system/database'
import { loadWardrobeCatalog } from '../../src/utils/wardrobe/wardrobeCatalog'
import { parseWardrobePearpal } from '../../src/utils/wardrobe/wardrobeImport'
import {
  createWardrobeBackup,
  emptyWardrobe,
  loadWardrobe,
  parseWardrobeBackup,
  updateWardrobe
} from '../../src/utils/wardrobe/wardrobeStorage'

beforeEach(() => clearAllBrowserData())
describe('wardrobe catalog and notebook import', () => {
  it('keeps variants separate and imports exact suit pieces without requiring gacha', async () => {
    const catalog = await loadWardrobeCatalog()
    const base = catalog.byId.get('10347')!,
      variant = catalog.byId.get('1034702')!
    expect(base.variant).toBe(0)
    expect(variant.variant).toBe(2)
    expect(variant.parts.length).toBeGreaterThan(0)
    const preview = parseWardrobePearpal(
      { info_from_self: { suit_list: ['1034702', '1034702'] } },
      catalog
    )
    expect(Object.keys(preview.snapshot.entries).sort()).toEqual([...variant.parts].sort())
    expect(base.parts.some((id) => preview.snapshot.entries[id])).toBe(false)
    expect(catalog.entries.every((entry) => entry.kind === 'item' || entry.kind === 'outfit')).toBe(
      true
    )
  })
  it('deduplicates suit and pull data, retains unknown clothes and excludes makeup', async () => {
    const catalog = await loadWardrobeCatalog(),
      outfit = catalog.byId.get('10347')!
    const preview = parseWardrobePearpal(
      {
        info_from_gm: { clothes: [{ item_id: '1020199999' }, { item_id: '1020810001' }] },
        info_from_self: {
          suit_list: ['10347', '99999'],
          gacha_list: [{ result: outfit.parts[0] }, { result: 'not-an-id' }]
        }
      },
      catalog
    )
    expect(Object.keys(preview.snapshot.entries)).toHaveLength(outfit.parts.length + 1)
    expect(preview.snapshot.entries['1020810001']).toBeUndefined()
    expect(preview.snapshot.unknownSuitIds).toEqual(['99999'])
    expect(preview.unknownItems).toBe(1)
    expect(() => parseWardrobePearpal({ records: [] }, catalog)).toThrow()
  })
})
describe('wardrobe persistence and backup', () => {
  it('commits manual edits atomically and survives reload', async () => {
    await Promise.all(
      ['1020100347', '1020100399'].map((id) =>
        updateWardrobe((latest) => {
          latest.entries[id] = { owned: true, source: 'manual' }
          return latest
        })
      )
    )
    expect(Object.keys((await loadWardrobe()).entries)).toHaveLength(2)
    const db = await openDb()
    expect(db.objectStoreNames.contains('resonance-records')).toBe(true)
    db.close()
  })
  it('replaces manual data, rejects stale preview and leaves committed data intact', async () => {
    const initial = await updateWardrobe((latest) => {
      latest.entries['1020100347'] = { owned: true, source: 'manual' }
      return latest
    })
    const base = JSON.stringify(initial)
    const imported = {
      ...emptyWardrobe(),
      entries: { '1020100399': { owned: true, source: 'pearpal' as const } }
    }
    await updateWardrobe(() => imported, base)
    expect((await loadWardrobe()).entries['1020100347']).toBeUndefined()
    await expect(updateWardrobe(() => emptyWardrobe(), base)).rejects.toThrow('WARDROBE_CHANGED')
    expect((await loadWardrobe()).entries['1020100399']?.owned).toBe(true)
  })
  it('round trips explicit unowned state and rejects unrelated or malformed JSON', () => {
    const data = {
      ...emptyWardrobe(),
      entries: { '1020100347': { owned: false, source: 'manual' as const } },
      unknownSuitIds: ['99999']
    }
    expect(parseWardrobeBackup(createWardrobeBackup(data))).toEqual(data)
    expect(() => parseWardrobeBackup('{"records":[]}')).toThrow()
    expect(() =>
      parseWardrobeBackup(
        JSON.stringify({
          format: 'nikki-personal-wardrobe',
          version: 1,
          data: { ...data, entries: { '1020100347': { owned: 'yes', source: 'manual' } } }
        })
      )
    ).toThrow()
    expect(createWardrobeBackup({ ...data, token: 'discard-me' } as typeof data)).not.toContain(
      'discard-me'
    )
  })
})

it('maps outfit family/style separately from item categories without persisting catalog metadata', async () => {
  const catalog = await loadWardrobeCatalog()
  const variant = catalog.byId.get('1029402')!
  expect(variant.familyRootId).toBe('10294')
  expect(catalog.byId.get(variant.familyRootId!)!.name.zh).toBe('花影心期')
  expect(variant.style).toBe('sweet')
  expect(variant.name.zh).toBe('花影心期·炽心')
  expect(variant.variant).toBe(2)
  expect(variant.parts).toHaveLength(10)
  const hair = catalog.byId.get(variant.parts[0])!
  expect(hair.kind).toBe('item')
  expect(hair.category).toBe(0)
  expect(hair.style).toBe('sweet')
  const imported = parseWardrobePearpal(
    { info_from_self: { suit_list: ['1029402'] } },
    catalog
  ).snapshot
  expect(Object.keys(imported.entries[variant.parts[0]])).toEqual(['owned', 'source'])
})
