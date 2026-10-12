// @vitest-environment node
import { expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { planBackupParts, backupPartBlob, backupPartName, type BackupLimits } from '../../src/utils/backup/zipBackup'
const limits: BackupLimits = { bytes: 4096, entries: 3, records: 20, manifest: 2000, image: 3000 }
const manifest = (records: unknown[]) => ({ tags: ['标签'], records })
it('splits records and their images into independently complete ZIPs', async () => {
  const items = Array.from({ length: 5 }, (_, id) => ({ record: { id, image: 'images/' + id }, files: [{ name: 'images/' + id, blob: new Blob(['data' + id]) }] }))
  const parts = planBackupParts(items, manifest, 'manifest.json', limits)
  expect(parts.map(part => part.count)).toEqual([2, 2, 1])
  const restored: number[] = []
  for (const part of parts) {
    const blob = await backupPartBlob(part, 'manifest.json', limits)
    expect(blob.size).toBeLessThanOrEqual(limits.bytes)
    const files = unzipSync(new Uint8Array(await blob.arrayBuffer()))
    const data = JSON.parse(strFromU8(files['manifest.json']))
    expect(data.tags).toEqual(['标签'])
    for (const row of data.records) { expect(strFromU8(files[row.image])).toBe('data' + row.id); restored.push(row.id) }
  }
  expect(restored).toEqual([0, 1, 2, 3, 4])
  expect(backupPartName('backup', 1, 3)).toBe('backup_part-002-of-003.zip')
})
it('splits on ZIP byte limits, UTF-8 manifest size and record limits', () => {
  const rows = Array.from({ length: 4 }, (_, id) => ({ record: { id, name: '暖'.repeat(40) }, files: [{ name: 'images/' + id, blob: new Blob([new Uint8Array(700)]) }] }))
  for (const constraints of [{ ...limits, bytes: 1400 }, { ...limits, manifest: 240 }, { ...limits, records: 1 }]) {
    expect(planBackupParts(rows, manifest, 'manifest.json', constraints).map(part => part.count)).toEqual([1, 1, 1, 1])
  }
})
it('rejects an oversized single record before creating any archive', () => {
  expect(() => planBackupParts([{ record: { id: 1 }, files: [{ name: 'cover', blob: new Blob([new Uint8Array(4000)]) }] }], manifest, 'manifest.json', limits)).toThrow('图片')
})
