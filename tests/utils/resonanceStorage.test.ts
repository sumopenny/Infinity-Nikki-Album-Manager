import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { loadResonanceRecords, saveResonanceRecords } from '../../src/utils/resonance/resonanceStorage'
import type { ResonanceRecord } from '../../src/utils/resonance/resonanceTypes'

const dbName = 'infinity-nikki-album-manager'

afterEach(async () => {
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(dbName)
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
})

const record: ResonanceRecord = {
  id: 'record-1',
  bannerId: 'banner-1',
  bannerName: { zh: 'Dream Banner', en: 'Dream Banner' },
  bannerStartAt: '2026-10-01T00:00:00.000Z',
  outfitId: 'outfit-1',
  outfitName: { zh: 'Example Outfit', en: 'Example Outfit' },
  rarity: 5,
  outfitImageUrl: '/outfit.png',
  sets: [
    { setNumber: 1, totalPulls: 20, parts: [{ id: 'part-1', name: { zh: 'Piece', en: 'Piece' }, imageUrl: '/part.png', pullNumber: 20 }] },
    { setNumber: 2, totalPulls: 0, parts: [{ id: 'part-1', name: { zh: 'Piece', en: 'Piece' }, imageUrl: '/part.png', pullNumber: 0 }] }
  ]
}

describe('resonanceStorage', () => {
  it('adds the resonance store to the shared database without replacing the album handle store', async () => {
    const albumDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, 3)
      request.onupgradeneeded = () => request.result.createObjectStore('album-handles')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    albumDb.close()

    await saveResonanceRecords([record])
    await expect(loadResonanceRecords()).resolves.toEqual([record])

    const upgradedDb = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(dbName, 4)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    expect([...upgradedDb.objectStoreNames]).toEqual(['album-handles', 'resonance-records'])
    upgradedDb.close()
  })

  it('preserves a complete bilingual profile snapshot including both sets', async () => {
    await saveResonanceRecords([record])
    await expect(loadResonanceRecords()).resolves.toEqual([record])
  })

  it('returns an empty list before a snapshot exists', async () => {
    await expect(loadResonanceRecords()).resolves.toEqual([])
  })
})
