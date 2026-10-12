// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { DB_NAME, HOME_IMAGES_STORE, HOME_SCHEMES_STORE, openDb, runStoreRequest } from '../../src/utils/file-system/database'
import { deleteHomeScheme, deleteHomeSchemeTag, homeTransaction, readHomeSchemeSnapshot, saveHomeScheme, saveHomeSchemeTags } from '../../src/utils/homeBuild/homeSchemeStorage'
import { createEmptyHomeSchemeMetadata } from '../helpers/homeSchemeMetadata'

const input = (code = 'CODE1') => ({ code, name: '花园', schemeType: 'home' as const, tags: ['庭院'], note: '春日', metadata: createEmptyHomeSchemeMetadata() })
const image = () => new File(['RIFF0000WEBPcontent'], 'image.webp', { type: 'image/webp' })
beforeEach(() => { vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1, height: 1, close() {} }))) })
afterEach(async () => {
  vi.restoreAllMocks(); vi.unstubAllGlobals()
  await new Promise<void>((resolve, reject) => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error) })
})

it('upgrades version 6 without replacing existing stores or records', async () => {
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 6)
    r.onupgradeneeded = () => { r.result.createObjectStore('resonance-records').put(['old'], 'current-profile') }
    r.onsuccess = () => { r.result.close(); resolve() }; r.onerror = () => reject(r.error)
  })
  const db = await openDb()
  expect(db.version).toBe(7); db.close()
  expect(await runStoreRequest('resonance-records', 'readonly', store => store.get('current-profile'))).toEqual(['old'])
  expect(await saveHomeScheme({ ...input(), tags: [] })).toMatchObject({ code: 'CODE1', image: null })
})

it('enforces global unique codes across concurrent writers', async () => {
  await saveHomeSchemeTags(['庭院'])
  const results = await Promise.allSettled([saveHomeScheme(input()), saveHomeScheme(input())])
  expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1)
  const failed = results.find(r => r.status === 'rejected') as PromiseRejectedResult
  expect(failed.reason.message).toBe('home_scheme_code_duplicate')
  expect((await readHomeSchemeSnapshot()).records).toHaveLength(1)
})

it('keeps images independent of source files and deletes tags without losing schemes or images', async () => {
  await saveHomeSchemeTags(['庭院'])
  const saved = await saveHomeScheme({ ...input(), imageFile: image() })
  const time = saved.createdAt
  expect(await deleteHomeSchemeTag('庭院')).toEqual({ tags: [], updatedCount: 1 })
  expect((await readHomeSchemeSnapshot()).images.get(saved.id)?.blob.size).toBe(image().size)
  const changed = await saveHomeScheme({ ...input(), tags: [], item: saved, removeImage: true })
  expect(changed.createdAt).toBe(time)
  expect(changed.image).toBeNull()
  expect((await readHomeSchemeSnapshot()).images.size).toBe(0)
  await deleteHomeScheme(changed)
  expect((await readHomeSchemeSnapshot()).records).toHaveLength(0)
})

it('rolls record and image writes back when a successful request is followed by transaction abort', async () => {
  await expect(homeTransaction([HOME_SCHEMES_STORE, HOME_IMAGES_STORE], 'readwrite', async tx => {
    tx.objectStore(HOME_IMAGES_STORE).put({ id: 'one', blob: image() })
    const request = tx.objectStore(HOME_SCHEMES_STORE).put({ id: 'one', code: 'CODE1' })
    request.onsuccess = () => tx.abort()
  })).rejects.toThrow()
  expect(await runStoreRequest(HOME_IMAGES_STORE, 'readonly', store => store.count())).toBe(0)
  expect(await runStoreRequest(HOME_SCHEMES_STORE, 'readonly', store => store.count())).toBe(0)
})
