// @vitest-environment node
import { expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { setupOutfitDatabaseTests, webp, resetOutfitDatabase } from '../helpers/outfitDatabase'
import { saveOutfit, deleteOutfit, readOutfitSnapshot } from '../../src/utils/outfit/outfitStorage'
import { exportOutfitBackup, importOutfitBackup } from '../../src/utils/outfit/outfitBackup'
import { OUTFIT_BACKUP_LIMITS } from '../../src/utils/backup/zipBackup'
setupOutfitDatabaseTests()
const input = (code: string) => ({ imageFile: webp(), code, tag: null, note: '备注' })
function archive(records: unknown[], images: Record<string, Uint8Array>, version = 1) {
  return new File(
    [
      zipSync({
        'manifest.json': strToU8(
          JSON.stringify({
            format: 'infinity-nikki-outfit-backup',
            version,
            tags: ['甜美'],
            outfits: records,
            ...(version === 2 ? { ignoredCodes: ['DELETED'] } : {})
          })
        ),
        ...images
      })
    ],
    'backup.zip'
  )
}
const raw = (id = 'one', code = 'CODE1') => ({
  id,
  image: `images/${id}.webp`,
  code,
  tags: ['甜美'],
  note: '旧备注',
  createdAt: '2026-07-31T00:00:00.000Z'
})

it('imports existing version 1 backups into the global database and keeps code deduplication', async () => {
  const file = archive([raw()], { 'images/one.webp': new Uint8Array(await webp().arrayBuffer()) })
  expect(await importOutfitBackup(file)).toMatchObject({ addedCount: 1, failedCount: 0 })
  expect((await readOutfitSnapshot()).records[0]).toMatchObject({ note: '旧备注', tags: ['甜美'] })
  expect(await importOutfitBackup(file)).toMatchObject({
    addedCount: 0,
    duplicateCount: 1,
    failedCount: 0
  })
})
it('exports and restores version 2 records, pending records, images and persistent ignores', async () => {
  await saveOutfit(input('CODE1'))
  await saveOutfit(input(''))
  await deleteOutfit(await saveOutfit(input('DELETED')))
  let backup: File | undefined
  await exportOutfitBackup(async (name, blob) => {
    backup = new File([blob], name)
  })
  const manifest = JSON.parse(
    strFromU8(unzipSync(new Uint8Array(await backup!.arrayBuffer()))['manifest.json'])
  )
  expect(manifest.version).toBe(2)
  expect(manifest.ignoredCodes).toContain('DELETED')
  expect(
    manifest.outfits.every((record: Record<string, unknown>) => !('gameSourceId' in record))
  ).toBe(true)
  await resetOutfitDatabase()
  expect(await importOutfitBackup(backup!)).toMatchObject({ addedCount: 2, failedCount: 0 })
  const restored = await readOutfitSnapshot()
  expect(restored.records).toHaveLength(2)
  expect(restored.images.size).toBe(2)
  expect(restored.ignoredCodes).toContain('DELETED')
  expect(await importOutfitBackup(backup!)).toMatchObject({ addedCount: 0, duplicateCount: 2 })
})
it('rejects missing images, unsafe paths and invalid WebP data before saving any records', async () => {
  const valid = new Uint8Array(await webp().arrayBuffer())
  for (const file of [
    archive([raw()], {}),
    archive([raw()], { '../one.webp': valid }),
    archive([raw(), raw('two', 'CODE2')], {
      'images/one.webp': valid,
      'images/two.webp': strToU8('invalid')
    })
  ]) {
    await expect(importOutfitBackup(file)).rejects.toThrow()
    expect((await readOutfitSnapshot()).records).toHaveLength(0)
  }
})
it('explicit backup restoration lifts the restored code without clearing unrelated ignores', async () => {
  await deleteOutfit(await saveOutfit(input('CODE1')))
  await deleteOutfit(await saveOutfit(input('OTHER')))
  const file = archive([raw()], { 'images/one.webp': new Uint8Array(await webp().arrayBuffer()) })
  await importOutfitBackup(file)
  expect((await readOutfitSnapshot()).ignoredCodes).toEqual(['OTHER'])
})
it('exports complete independently importable parts', async () => {
  for (let i = 0; i < 5; i++) await saveOutfit(input('CODE' + i))
  const old = OUTFIT_BACKUP_LIMITS.records,
    files: File[] = []
  OUTFIT_BACKUP_LIMITS.records = 2
  try {
    const result = await exportOutfitBackup(async (name, blob) => {
      files.push(new File([blob], name))
    })
    expect(result.fileNames).toHaveLength(3)
    await resetOutfitDatabase()
    let added = 0
    for (const file of files) {
      const result = await importOutfitBackup(file)
      expect(result.failedCount).toBe(0)
      added += result.addedCount
    }
    expect(added).toBe(5)
    expect((await readOutfitSnapshot()).records).toHaveLength(5)
  } finally {
    OUTFIT_BACKUP_LIMITS.records = old
  }
})
