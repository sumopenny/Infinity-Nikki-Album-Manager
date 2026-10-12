// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, expect, it } from 'vitest'
import { DB_NAME, openDb, runStoreRequest, clearBrowserSessionData } from '../../src/utils/file-system/database'
import { getSavedPhotoActionCaches, savePhotoActionCache, clearSavedHomeSchemeParseResults, clearSavedOutfitParseResults, clearSavedPhotoActionCache } from '../../src/utils/file-system/directoryStorage'
import { loadResonanceRecords, saveResonanceRecords } from '../../src/utils/resonance/resonanceStorage'
afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
})
it('rejects a write whose request succeeds but whose transaction aborts', async () => {
  await expect(runStoreRequest('album-handles', 'readwrite', store => {
    const request = store.put('new', 'value')
    request.addEventListener('success', () => store.transaction.abort())
    return request
  })).rejects.toThrow()
  expect(await runStoreRequest('album-handles', 'readonly', store => store.get('value'))).toBeUndefined()
})
it('propagates failed or malformed resonance reads instead of returning an empty profile', async () => {
  expect(await loadResonanceRecords()).toEqual([])
  await runStoreRequest('resonance-records', 'readwrite', store => store.put({ damaged: true }, 'current-profile'))
  await expect(loadResonanceRecords()).rejects.toThrow('Invalid resonance storage')
})
it('clears session data while preserving every user collection store', async () => {
  const db = await openDb()
  const names = [...db.objectStoreNames]
  db.close()
  for (const name of names) {
    await runStoreRequest(name, 'readwrite', store => Array.isArray(store.keyPath) ? store.put({ sourceId: 'one', fileName: 'one' }) : store.keyPath ? store.put({ id: 'one' }) : store.put('data', 'one'))
  }
  await clearBrowserSessionData()
  for (const name of names) {
    const values = await runStoreRequest(name, 'readonly', store => store.getAll())
    expect(values).toEqual(name === 'album-handles' ? [] : name === 'home-scheme-migration-entries' ? [{ sourceId: 'one', fileName: 'one' }] : ['camera-favorites', 'home-schemes', 'home-scheme-images', 'home-scheme-migration-sources'].includes(name) ? [{ id: 'one' }] : ['data'])
  }
})
it('cache clearing preserves UID, directory authorization, favorites and resonance records', async () => {
  const entries = [
    ['outfit-code-parse:v1:old', 'cache'], ['outfit-code-parse:v2:new', 'cache'],
    ['home-scheme-parse:code', 'cache'], ['photo-action-parse:v1:album:name', 'cache'],
    ['current-camera-param-uids', ['123']], ['current-album-directory', { name: 'album' }]
  ] as const
  for (const [key, value] of entries) await runStoreRequest('album-handles', 'readwrite', store => store.put(value, key))
  await saveResonanceRecords([])
  await runStoreRequest('camera-favorites', 'readwrite', store => store.put({ id: 'saved' }))
  await Promise.all([clearSavedHomeSchemeParseResults(), clearSavedOutfitParseResults(), clearSavedPhotoActionCache()])
  expect(await runStoreRequest('album-handles', 'readonly', store => store.getAllKeys())).toEqual(['current-album-directory', 'current-camera-param-uids'])
  expect(await runStoreRequest('camera-favorites', 'readonly', store => store.count())).toBe(1)
  expect(await runStoreRequest('resonance-records', 'readonly', store => store.count())).toBe(1)
})


it('loads one album cache in a single transaction with encoded names', async () => {
  const entry = { fingerprint: 'f', parserVersion: 'v', catalogVersion: 'c', status: 'none' as const, parsedAt: 1 }
  await savePhotoActionCache('album:中文', 'a:b.jpg', entry)
  await savePhotoActionCache('album:中文', 'c.jpg', entry)
  await savePhotoActionCache('another', 'a:b.jpg', entry)
  const result = await getSavedPhotoActionCaches('album:中文')
  expect([...result.keys()]).toEqual(['a:b.jpg', 'c.jpg'])
  expect(result.get('a:b.jpg')).toEqual(entry)
})