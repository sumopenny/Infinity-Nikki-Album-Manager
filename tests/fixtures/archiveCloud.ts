import type { ResonanceRecord } from '../../src/utils/resonance/resonanceTypes'
import { emptyWardrobe } from '../../src/utils/wardrobe/wardrobeSchema'
import { summarizeWardrobe } from '../../src/utils/wardrobe/wardrobeCloudSchema'
import type {
  ArchiveHead,
  ArchiveSnapshot,
  ArchiveWrite
} from '../../src/utils/cloud/archiveSchema'
export const resonanceFixture = (id = 'outfit'): ResonanceRecord => ({
  id: `banner:${id}`,
  bannerId: 'banner',
  outfitId: id,
  bannerName: { zh: '卡池', en: 'Banner' },
  outfitName: { zh: '套装', en: 'Outfit' },
  bannerStartAt: '2026-10-14',
  rarity: 5,
  outfitImageUrl: '',
  sets: [
    { setNumber: 1, totalPulls: 80, parts: [] },
    { setNumber: 2, totalPulls: 0, parts: [] }
  ]
})
export const wardrobeFixture = () => ({
  ...emptyWardrobe(),
  imported: true,
  regionScope: 'global' as const,
  entries: { '123': { owned: true, source: 'manual' as const } }
})
export const archiveHead = (): ArchiveHead => ({
  resonance: { revision: 1, updated_at: 1, active_snapshot: 'r-save', count: 1 },
  wardrobe: {
    revision: 1,
    updated_at: 1,
    active_snapshot: 'w-save',
    summary: summarizeWardrobe(wardrobeFixture())
  }
})
export const archiveSnapshot = (): ArchiveSnapshot => ({
  resonance: { ...archiveHead().resonance, records: [resonanceFixture('cloud')] },
  wardrobe: { ...archiveHead().wardrobe, schemaVersion: 1, data: wardrobeFixture() }
})
export const archiveUpload = (revision = 0): ArchiveWrite => ({
  requestId: crypto.randomUUID(),
  modules: {
    resonance: { revision, records: [resonanceFixture()] },
    wardrobe: { revision, data: wardrobeFixture() }
  }
})
