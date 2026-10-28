import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getArchiveHead,
  getArchiveSnapshot,
  writeArchive
} from '../../src/utils/cloud/archiveClient'
import { archiveHead, archiveSnapshot, archiveUpload } from '../fixtures/archiveCloud'
const user = { id: 'account', username: 'nikki' }
afterEach(() => vi.unstubAllGlobals())
describe('unified archive transport', () => {
  it('reads the summary through the unified endpoint', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(archiveHead()))
    vi.stubGlobal('fetch', fetch)
    expect(await getArchiveHead(user)).toEqual(archiveHead())
    expect(fetch).toHaveBeenCalledWith(
      '/api/archive/cloud?action=summary',
      expect.objectContaining({
        headers: { 'X-Resonance-Request': '1', 'X-Resonance-Account': 'account' }
      })
    )
  })
  it('adds the selected-module query without losing the action parameter', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(archiveSnapshot()))
    vi.stubGlobal('fetch', fetch)
    await getArchiveSnapshot(user, ['resonance', 'wardrobe'])
    const url = new URL(fetch.mock.calls[0][0], 'https://example.test')
    expect(url.searchParams.get('modules')).toBe('resonance,wardrobe')
    expect(url.searchParams.get('action')).toBe('snapshot')
    expect(url.searchParams.getAll('action')).toHaveLength(1)
  })
  it.each([{}, null, { ...archiveHead(), wardrobe: { revision: 1, summary: {} } }])(
    'rejects malformed summary %j',
    async (response) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(response)))
      await expect(getArchiveHead(user)).rejects.toThrow()
    }
  )
  it('requires a receipt for every selected module before reporting success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ revisions: { resonance: 1 }, replayed: false }))
    )
    await expect(writeArchive('upload', user, archiveUpload())).rejects.toThrow('SERVER_ERROR')
  })
  it.each(['<html>Gateway error</html>', 'null', '42'])(
    'keeps an unusable write response uncertain and preserves its trace: %s',
    async (text) => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(new Response(text, { headers: { 'X-Request-Id': 'test-trace-id' } }))
      )
      await expect(writeArchive('upload', user, archiveUpload())).rejects.toMatchObject({
        message: 'SERVER_ERROR',
        traceId: 'test-trace-id'
      })
    }
  )
  it.each([
    { revisions: { resonance: 0, wardrobe: 1 }, replayed: false },
    { revisions: { resonance: 1, wardrobe: 1 }, replayed: 'false' }
  ])('rejects invalid write acknowledgements %j', async (result) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(result)))
    await expect(writeArchive('upload', user, archiveUpload())).rejects.toThrow('SERVER_ERROR')
  })
  it('accepts a replayed joint receipt and preserves the account and original request identity', async () => {
    const body = archiveUpload()
    const outcome = { revisions: { resonance: 1, wardrobe: 1 }, replayed: true }
    const fetch = vi.fn().mockResolvedValue(Response.json(outcome))
    vi.stubGlobal('fetch', fetch)
    await expect(writeArchive('upload', user, body)).resolves.toEqual(outcome)
    expect(fetch).toHaveBeenCalledWith(
      '/api/archive/cloud?action=upload',
      expect.objectContaining({
        credentials: 'same-origin',
        headers: expect.objectContaining({ 'X-Resonance-Account': user.id }),
        body: JSON.stringify(body)
      })
    )
  })
})
