import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePhotoActionParsing } from '../../src/composables/usePhotoActionParsing'
import { getSavedPhotoActionCache, savePhotoActionCache } from '../../src/utils/file-system/directoryStorage'
import { parsePhotoAction, photoActionFingerprint, PHOTO_ACTION_PARSER_VERSION } from '../../src/utils/photo-params/photoActionParser'
import { PHOTO_ACTION_CATALOG_VERSION } from '../../src/utils/photo-params/resourceManifest'
import type { PhotoItem } from '../../src/utils/photoGrouping'

vi.mock('../../src/utils/file-system/directoryStorage', () => ({
  getSavedPhotoActionCache: vi.fn(),
  savePhotoActionCache: vi.fn().mockResolvedValue(undefined)
}))
vi.mock('../../src/utils/photo-params/photoActionParser', async (importOriginal) => ({
  ...await importOriginal<typeof import('../../src/utils/photo-params/photoActionParser')>(),
  parsePhotoAction: vi.fn()
}))

const photo = (name: string) => ({ id: name, name, fileSize: 100, lastModified: 1 } as PhotoItem)
const cached = photo('cached.jpg')
const missing = photo('missing.jpg')
const cache = (album: string, status: 'action' | 'none' = 'action') => ({
  fingerprint: photoActionFingerprint(album, cached),
  parserVersion: PHOTO_ACTION_PARSER_VERSION,
  catalogVersion: PHOTO_ACTION_CATALOG_VERSION,
  status, actionId: status === 'action' ? '123' : undefined, parsedAt: 1
})

describe('photo action cache with automatic parsing disabled', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it.each(['action', 'none'] as const)('loads a saved %s result without resolving UID or decoding', async (status) => {
    vi.mocked(getSavedPhotoActionCache).mockImplementation(async (_album, name) => name === cached.name ? cache('album', status) : null)
    const resolveUid = vi.fn()
    const parser = usePhotoActionParsing({ language: ref('zh') })
    await parser.start([cached, missing], 'album', resolveUid, false)
    expect(parser.actionInfo.value.get(cached.id)?.status).toBe(status)
    expect(parser.actionInfo.value.get(missing.id)?.status).toBe('unparsed')
    expect(parser.progress.value.running).toBe(false)
    expect(resolveUid).not.toHaveBeenCalled()
    expect(parsePhotoAction).not.toHaveBeenCalled()
    expect(savePhotoActionCache).not.toHaveBeenCalled()
  })

  it('does not use stale cache and parses it only after enabling', async () => {
    vi.mocked(getSavedPhotoActionCache).mockResolvedValue(cache('old-album'))
    vi.mocked(parsePhotoAction).mockResolvedValue({ status: 'none', parsedAt: 2 })
    const resolveUid = vi.fn().mockResolvedValue(['123'])
    const parser = usePhotoActionParsing({ language: ref('zh') })
    await parser.start([cached], 'new-album', resolveUid, false)
    expect(parser.actionInfo.value.get(cached.id)?.status).toBe('unparsed')
    expect(resolveUid).not.toHaveBeenCalled()
    expect(parsePhotoAction).not.toHaveBeenCalled()
    await parser.start([cached], 'new-album', resolveUid, true)
    expect(parsePhotoAction).toHaveBeenCalledTimes(1)
    expect(parser.actionInfo.value.get(cached.id)?.status).toBe('none')
  })

  it('discards an old album cache read when the album changes', async () => {
    let finishOld!: (value: ReturnType<typeof cache>) => void
    vi.mocked(getSavedPhotoActionCache).mockImplementation((album) => album === 'old'
      ? new Promise((resolve) => { finishOld = resolve })
      : Promise.resolve(null))
    const parser = usePhotoActionParsing({ language: ref('zh') })
    const oldRun = parser.start([cached], 'old', vi.fn(), false)
    await parser.start([missing], 'new', vi.fn(), false)
    finishOld(cache('old'))
    await oldRun
    expect([...parser.actionInfo.value.keys()]).toEqual([missing.id])
  })
})
