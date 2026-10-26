import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearAllBrowserData, runStoreRequest } from '../../src/utils/file-system/database'
import {
  emptyWardrobe,
  wardrobeBaseline,
  hasWardrobeSnapshot
} from '../../src/utils/wardrobe/wardrobeSchema'
import {
  normalizeCloudWardrobe,
  summarizeWardrobe,
  validateWardrobeCloudSnapshot
} from '../../src/utils/wardrobe/wardrobeCloudSchema'
import {
  readWardrobeSnapshot,
  updateWardrobe,
  replaceWardrobeIfUnchanged
} from '../../src/utils/wardrobe/wardrobeStorage'
import { performance } from 'node:perf_hooks'
import items from '../../src/data/gongeo/items.json'

beforeEach(() => clearAllBrowserData())
describe('wardrobe cloud data boundaries', () => {
  it('preserves empty imports and rejects cleared data, strips arbitrary credentials', () => {
    expect(() => normalizeCloudWardrobe(emptyWardrobe())).toThrow('EMPTY_LOCAL')
    const valid = { ...emptyWardrobe(), imported: true, token: 'private' }
    expect(hasWardrobeSnapshot(valid)).toBe(true)
    expect(normalizeCloudWardrobe(valid)).toEqual({
      ...emptyWardrobe(),
      imported: true,
      regionScope: 'cn'
    })
    expect(JSON.stringify(normalizeCloudWardrobe(valid))).not.toContain('private')
  })
  it('normalizes IDs and legacy region without mutating the local baseline', () => {
    const local = {
      ...emptyWardrobe(),
      entries: { '1021720040': { owned: true, source: 'manual' as const } },
      unknownSuitIds: ['9', '8', '9']
    }
    const before = wardrobeBaseline(local)
    const cloud = normalizeCloudWardrobe(local)
    expect(cloud.regionScope).toBe('global')
    expect(cloud.unknownSuitIds).toEqual(['8', '9'])
    expect(wardrobeBaseline(local)).toBe(before)
    expect(local).not.toHaveProperty('regionScope')
    expect(wardrobeBaseline({ ...local, unknownSuitIds: ['8', '9'] })).toBe(before)
  })
  it('rejects corrupt, unsupported, and mismatched snapshots rather than returning empty data', () => {
    expect(() =>
      validateWardrobeCloudSnapshot({
        revision: 0,
        updated_at: 0,
        active_snapshot: null,
        summary: null,
        schemaVersion: 1,
        data: {}
      })
    ).toThrow('INVALID_DATA')
    const data = normalizeCloudWardrobe({ ...emptyWardrobe(), imported: true })
    const cloud = {
      revision: 1,
      updated_at: 1,
      active_snapshot: 'id',
      summary: summarizeWardrobe(data),
      schemaVersion: 1,
      data
    }
    expect(validateWardrobeCloudSnapshot(cloud).data).toEqual(data)
    expect(() => validateWardrobeCloudSnapshot({ ...cloud, schemaVersion: 2 })).toThrow(
      'UNSUPPORTED_SCHEMA'
    )
    expect(() =>
      validateWardrobeCloudSnapshot({ ...cloud, summary: { ...cloud.summary, entryCount: 1 } })
    ).toThrow('INVALID_DATA')
  })
  it('pure reads leave resolvable unknown suits and timestamps untouched', async () => {
    const stored = {
      ...emptyWardrobe(),
      imported: true,
      unknownSuitIds: ['10347'],
      updatedAt: '2026-01-01T00:00:00Z'
    }
    await runStoreRequest('wardrobe', 'readwrite', (store) => store.put(stored, 'current'))
    expect(await readWardrobeSnapshot()).toEqual(stored)
    expect(await runStoreRequest('wardrobe', 'readonly', (store) => store.get('current'))).toEqual(
      stored
    )
  })
  it('rejects a changed local baseline atomically and restores valid empty data with its region', async () => {
    const initial = await updateWardrobe(() => ({ ...emptyWardrobe(), imported: true }))
    await updateWardrobe(() => ({ ...initial, unknownSuitIds: ['777777'] }))
    await expect(
      replaceWardrobeIfUnchanged(wardrobeBaseline(initial), { ...initial, regionScope: 'global' })
    ).rejects.toThrow('LOCAL_CHANGED')
    const latest = await readWardrobeSnapshot()
    expect(latest.unknownSuitIds).toEqual(['777777'])
    await replaceWardrobeIfUnchanged(wardrobeBaseline(latest), {
      ...initial,
      regionScope: 'global'
    })
    expect(await readWardrobeSnapshot()).toMatchObject({
      entries: {},
      unknownSuitIds: [],
      imported: true,
      regionScope: 'global'
    })
  })
  it('normalizes the current catalog fixture without quadratic work', () => {
    const ids = items.flatMap((row) => (Array.isArray(row[0]) ? row[0] : [row[0]]))
    const data = {
      ...emptyWardrobe(),
      imported: true,
      entries: Object.fromEntries(ids.map((id) => [String(id), { owned: true, source: 'pearpal' }]))
    }
    const start = performance.now()
    const normalized = normalizeCloudWardrobe(data)
    expect(Object.keys(normalized.entries)).toHaveLength(new Set(ids).size)
    console.info('wardrobe catalog normalization ms', Math.round(performance.now() - start))
  })
})
