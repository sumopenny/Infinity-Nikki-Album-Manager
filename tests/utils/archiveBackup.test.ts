import { describe, expect, it, vi } from 'vitest'
import { unzipSync, strFromU8 } from 'fflate'
import { exportArchiveBackup } from '../../src/utils/cloud/archiveBackup'
import { retainDownload } from '../../src/utils/backup/downloadFallback'
import { parseWardrobeBackup } from '../../src/utils/wardrobe/wardrobeStorage'
import { resonanceFixture, wardrobeFixture } from '../fixtures/archiveCloud'
vi.mock('../../src/utils/backup/zipBackup', () => ({
  downloadBackupBlob: vi.fn((name, blob, module) => retainDownload(name, blob, module))
}))
describe('selected archive backups', () => {
  it('exports one ZIP containing compatible module JSON files', async () => {
    const local = { resonance: [resonanceFixture()], wardrobe: wardrobeFixture() }
    const [file] = exportArchiveBackup(local, ['resonance', 'wardrobe'])
    expect(file.name).toMatch(/\.zip$/)
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
    expect(Object.keys(files)).toEqual(['resonance.json', 'wardrobe.json'])
    expect(parseWardrobeBackup(strFromU8(files['wardrobe.json']))).toEqual(local.wardrobe)
    const resonance = JSON.parse(strFromU8(files['resonance.json']))
    expect(resonance).toMatchObject({
      format: 'infinity-nikki-album-manager/resonance',
      version: 1,
      records: local.resonance
    })
  })
  it('exports only the chosen module as JSON', async () => {
    const local = { resonance: [resonanceFixture()], wardrobe: wardrobeFixture() }
    const [file] = exportArchiveBackup(local, ['wardrobe'])
    expect(file.name).toMatch(/\.json$/)
    expect(parseWardrobeBackup(await file.text())).toEqual(local.wardrobe)
  })
})
