import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { usePhotoActionParsing } from '../../src/composables/usePhotoActionParsing'
import { getSavedPhotoActionCaches, savePhotoActionCache } from '../../src/utils/file-system/directoryStorage'
import { parsePhotoAction, photoActionFingerprint, PHOTO_ACTION_PARSER_VERSION } from '../../src/utils/photo-params/photoActionParser'
import { PHOTO_ACTION_CATALOG_VERSION } from '../../src/utils/photo-params/resourceManifest'
import type { PhotoItem } from '../../src/utils/photoGrouping'

vi.mock('../../src/utils/file-system/directoryStorage', () => ({
  getSavedPhotoActionCaches: vi.fn(),
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
    vi.mocked(getSavedPhotoActionCaches).mockResolvedValue(new Map([[cached.name, cache('album', status)]]))
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
    vi.mocked(getSavedPhotoActionCaches).mockResolvedValue(new Map([[cached.name, cache('old-album')]]))
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
    let finishOld!: (value: Map<string, ReturnType<typeof cache>>) => void
    vi.mocked(getSavedPhotoActionCaches).mockImplementation((album) => album === 'old'
      ? new Promise((resolve) => { finishOld = resolve })
      : Promise.resolve(new Map()))
    const parser = usePhotoActionParsing({ language: ref('zh') })
    const oldRun = parser.start([cached], 'old', vi.fn(), false)
    await parser.start([missing], 'new', vi.fn(), false)
    finishOld(new Map([[cached.name, cache('old')]]))
    await oldRun
    expect([...parser.actionInfo.value.keys()]).toEqual([missing.id])
  })
})


it('cancels queued tasks and discards all late results without saving cache', async () => {
  vi.clearAllMocks()
  vi.mocked(getSavedPhotoActionCaches).mockResolvedValue(new Map())
  let finish!: () => void
  const gate = new Promise<void>(resolve => { finish = resolve })
  vi.mocked(parsePhotoAction).mockImplementation(async () => { await gate; return { status: 'none' } })
  const parser = usePhotoActionParsing({ language: ref('zh') })
  const run = parser.start(Array.from({ length: 40 }, (_, i) => photo(i + '.jpg')), 'album', async () => ['123'])
  await vi.waitFor(() => expect(parsePhotoAction).toHaveBeenCalledTimes(15))
  parser.cancel()
  finish()
  await run
  expect(parsePhotoAction).toHaveBeenCalledTimes(15)
  expect(savePhotoActionCache).not.toHaveBeenCalled()
  expect(parser.progress.value.running).toBe(false)
  parser.reset()
  expect(parser.actionInfo.value.size).toBe(0)
  await parser.start([missing], 'album', async () => ['123'])
  expect(parser.actionInfo.value.get(missing.id)?.status).toBe('none')
})
