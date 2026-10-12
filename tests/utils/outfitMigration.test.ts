// @vitest-environment node
import { expect, it, vi } from 'vitest'
import { setupOutfitDatabaseTests, legacyAlbum, OutfitDirectory, directoryHandle, webp } from '../helpers/outfitDatabase'
import { migrateOutfitLibrary } from '../../src/utils/outfit/outfitMigration'
import { readOutfitCollection, readOutfitSnapshot, saveOutfit, deleteOutfit, deleteOutfitTag, saveOutfitTags } from '../../src/utils/outfit/outfitStorage'
import { OUTFITS_STORE, OUTFIT_MIGRATION_ENTRIES_STORE, runStoreRequest } from '../../src/utils/file-system/database'
setupOutfitDatabaseTests()

it('migrates metadata, images, tags and ignores before deleting the entire clothe folder', async () => {
  const { album, clothe } = legacyAlbum()
  clothe.json('ignored-sharecodes.json', ['DELETED'])
  const remove = vi.spyOn(album, 'removeEntry')
  expect(await migrateOutfitLibrary(directoryHandle(album))).toMatchObject({ addedCount: 1, failedCount: 0, clotheDirectoryRemoved: true })
  const snapshot = await readOutfitSnapshot()
  expect(snapshot.records[0]).toMatchObject({ code: 'CODE1', note: '保留备注', tags: ['自定义'], createdAt: '2026-07-31T00:00:00.000Z', updatedAt: '2026-07-31T00:00:00.000Z' })
  expect(await snapshot.images.get(snapshot.records[0].id)!.blob.text()).toBe('RIFF0000WEBPoriginal')
  expect(snapshot.tags).toContain('自定义'); expect(snapshot.ignoredCodes).toEqual(['DELETED'])
  expect(remove).toHaveBeenCalledWith('clothe', { recursive: true }); expect(album.directories.has('clothe')).toBe(false)
})
it('does not resurrect deleted records or tags and does not overwrite edits on repeat migration', async () => {
  const { album, clothe } = legacyAlbum()
  clothe.files.set('keep.txt', new File(['unknown'], 'keep.txt'))
  await migrateOutfitLibrary(directoryHandle(album))
  let item = (await readOutfitCollection()).outfits[0]
  await saveOutfit({ outfit: item, code: item.code, tag: item.tags[0], note: '新备注' })
  await migrateOutfitLibrary(directoryHandle(album)); expect((await readOutfitSnapshot()).records[0].note).toBe('新备注')
  await deleteOutfitTag('自定义'); item = (await readOutfitCollection()).outfits[0]
  await deleteOutfit(item)
  await migrateOutfitLibrary(directoryHandle(album))
  const snapshot = await readOutfitSnapshot(); expect(snapshot.records).toEqual([]); expect(snapshot.tags).not.toContain('自定义'); expect(snapshot.ignoredCodes).toContain('CODE1')
})
it('replaces same codes from another source but keeps independent pending records', async () => {
  const first = legacyAlbum('one'), second = legacyAlbum('two', 'CODE1', 'replacement')
  await migrateOutfitLibrary(directoryHandle(first.album))
  expect(await migrateOutfitLibrary(directoryHandle(second.album))).toMatchObject({ replacedCount: 1, failedCount: 0 })
  expect((await readOutfitSnapshot()).records).toHaveLength(1)
  for (const id of ['pending1', 'pending2']) {
    const source = legacyAlbum(id, '')
    expect(await migrateOutfitLibrary(directoryHandle(source.album))).toMatchObject({ addedCount: 1, failedCount: 0 })
  }
  expect((await readOutfitSnapshot()).records.filter(record => !record.code)).toHaveLength(2)
})
it('skips identical content across albums and allocates new IDs for conflicting records', async () => {
  const first = legacyAlbum('one'), same = legacyAlbum('two'), conflict = legacyAlbum('one', 'OTHER')
  await migrateOutfitLibrary(directoryHandle(first.album))
  expect(await migrateOutfitLibrary(directoryHandle(same.album))).toMatchObject({ skippedCount: 1 })
  await migrateOutfitLibrary(directoryHandle(conflict.album))
  expect(new Set((await readOutfitSnapshot()).records.map(record => record.id)).size).toBe(2)
})
it('retries invalid JSON and missing images but never marks a failed record migrated', async () => {
  const { album, clothe } = legacyAlbum()
  const savedImage = clothe.files.get('one.webp')!; clothe.files.delete('one.webp')
  clothe.files.set('bad.json', new File(['invalid'], 'bad.json'))
  expect(await migrateOutfitLibrary(directoryHandle(album))).toMatchObject({ failedCount: 2 })
  expect(await runStoreRequest(OUTFIT_MIGRATION_ENTRIES_STORE, 'readonly', store => store.count())).toBe(0)
  clothe.files.set('one.webp', savedImage); clothe.files.delete('bad.json')
  expect(await migrateOutfitLibrary(directoryHandle(album))).toMatchObject({ addedCount: 1, failedCount: 0 })
})
it('reports changed migrated files without overwriting database edits', async () => {
  const { album, clothe } = legacyAlbum()
  clothe.files.set('keep.txt', new File(['unknown'], 'keep.txt'))
  await migrateOutfitLibrary(directoryHandle(album))
  clothe.files.set('one.webp', webp('one.webp', 'external change'))
  const result = await migrateOutfitLibrary(directoryHandle(album))
  expect(result.failedCount).toBe(1); expect(result.failures[0].message).toBe('outfit_migration_source_changed')
  expect(await (await readOutfitSnapshot()).images.get('one')!.blob.text()).toBe('RIFF0000WEBPoriginal')
})
it('retains retryable tag overflow without reintroducing previously migrated tags', async () => {
  await saveOutfitTags(Array.from({ length: 40 }, (_, i) => `T${i}`))
  const { album } = legacyAlbum()
  expect(await migrateOutfitLibrary(directoryHandle(album))).toMatchObject({ addedCount: 0, failedCount: 2 })
  await deleteOutfitTag('T0'); await deleteOutfitTag('T1')
  expect(await migrateOutfitLibrary(directoryHandle(album))).toMatchObject({ addedCount: 1, failedCount: 0 })
})
it('rolls replacement and its migration marker back on transaction failure', async () => {
  const first = legacyAlbum('one'), next = legacyAlbum('two', 'CODE1', 'replacement')
  await migrateOutfitLibrary(directoryHandle(first.album))
  const originalPut = IDBObjectStore.prototype.put
  const spy = vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
    const request = originalPut.apply(this, args)
    if (this.name === OUTFITS_STORE) request.addEventListener('success', () => this.transaction.abort())
    return request
  })
  expect(await migrateOutfitLibrary(directoryHandle(next.album))).toMatchObject({ failedCount: 1, replacedCount: 0 })
  spy.mockRestore()
  expect(await (await readOutfitSnapshot()).images.get('one')!.blob.text()).toBe('RIFF0000WEBPoriginal')
  expect(await migrateOutfitLibrary(directoryHandle(next.album))).toMatchObject({ replacedCount: 1 })
})
it('does not create clothe or tags files when absent', async () => {
  const album = new OutfitDirectory()
  expect(await migrateOutfitLibrary(directoryHandle(album))).toMatchObject({ addedCount: 0, failedCount: 0 })
  expect(album.directories.size).toBe(0); expect(album.files.size).toBe(0)
})

it.each(['loose.webp', 'notes.txt', 'subfolder'])('retains unprocessed content %s instead of importing it or deleting clothe', async name => {
  const { album, clothe } = legacyAlbum()
  if (name === 'subfolder') clothe.child(name)
  else clothe.files.set(name, name.endsWith('.webp') ? webp(name) : new File(['unknown'], name))
  const remove = vi.spyOn(album, 'removeEntry')
  const result = await migrateOutfitLibrary(directoryHandle(album))
  expect(result).toMatchObject({ addedCount: 1, failedCount: 1, clotheDirectoryRemoved: false })
  expect(result.failures[0].message).toBe('outfit_cleanup_unmigrated_content')
  expect(remove).not.toHaveBeenCalled(); expect(album.directories.get('clothe')).toBe(clothe)
  expect((await readOutfitSnapshot()).records).toHaveLength(1)
})
it('retries denied cleanup using committed markers without restoring deleted records', async () => {
  const { album } = legacyAlbum()
  const remove = vi.spyOn(album, 'removeEntry').mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
  expect(await migrateOutfitLibrary(directoryHandle(album))).toMatchObject({ addedCount: 1, failedCount: 1, clotheDirectoryRemoved: false })
  await deleteOutfit((await readOutfitCollection()).outfits[0])
  expect(await migrateOutfitLibrary(directoryHandle(album))).toMatchObject({ addedCount: 0, failedCount: 0, clotheDirectoryRemoved: true })
  expect(remove).toHaveBeenCalledTimes(2); expect((await readOutfitSnapshot()).records).toHaveLength(0)
  expect((await readOutfitSnapshot()).ignoredCodes).toContain('CODE1')
})
it.each(['tags.json', 'ignored-sharecodes.json', 'new.webp', 'directory'])('preserves clothe when %s changes during migration', async name => {
  const { album, clothe } = legacyAlbum()
  const get = album.getDirectoryHandle.bind(album)
  vi.spyOn(album, 'getDirectoryHandle').mockImplementation(async key => {
    // The second lookup is the final cleanup check, after all database writes.
    if (name === 'directory') album.child('clothe')
    else if (name === 'tags.json') clothe.json(name, ['新标签'])
    else if (name === 'ignored-sharecodes.json') clothe.json(name, ['NEW'])
    else clothe.files.set(name, webp(name))
    return get(key)
  }).mockImplementationOnce(get)
  const remove = vi.spyOn(album, 'removeEntry')
  const result = await migrateOutfitLibrary(directoryHandle(album))
  expect(result).toMatchObject({ addedCount: 1, failedCount: 1, clotheDirectoryRemoved: false })
  expect(result.failures[0].message).toBe('outfit_cleanup_directory_changed')
  expect(remove).not.toHaveBeenCalled(); expect(album.directories.has('clothe')).toBe(true)
})
it.each(['tags.json', 'ignored-sharecodes.json'])('never discards changed %s on a later cleanup retry', async name => {
  const { album, clothe } = legacyAlbum()
  vi.spyOn(album, 'removeEntry').mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
  await migrateOutfitLibrary(directoryHandle(album))
  clothe.json(name, name === 'tags.json' ? ['新标签'] : ['NEW'])
  const result = await migrateOutfitLibrary(directoryHandle(album))
  expect(result).toMatchObject({ addedCount: 0, failedCount: 1, clotheDirectoryRemoved: false })
  expect(result.failures[0].message).toBe('outfit_migration_source_changed')
  expect(album.directories.get('clothe')).toBe(clothe)
})
it('serializes concurrent migrations and cleans up only once', async () => {
  const { album } = legacyAlbum()
  const remove = vi.spyOn(album, 'removeEntry')
  const results = await Promise.all([migrateOutfitLibrary(directoryHandle(album)), migrateOutfitLibrary(directoryHandle(album))])
  expect(results.reduce((count, result) => count + result.addedCount, 0)).toBe(1)
  expect(remove).toHaveBeenCalledTimes(1)
  expect((await readOutfitSnapshot()).records).toHaveLength(1)
})
