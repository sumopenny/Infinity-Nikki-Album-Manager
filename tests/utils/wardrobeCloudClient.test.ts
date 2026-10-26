import { afterEach, describe, expect, it, vi } from 'vitest'
import { writeWardrobeSnapshot } from '../../src/utils/wardrobe/wardrobeCloudClient'

const user = { id: 'account', username: 'nikki' }
const body = { requestId: 'original-request', revision: 1 }
afterEach(() => vi.unstubAllGlobals())

describe('wardrobe cloud write acknowledgements', () => {
  it.each(['<html>Gateway error</html>', 'null', '42'])(
    'keeps an unusable response uncertain: %s',
    async (text) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(
          new Response(text, {
            headers: { 'X-Request-Id': 'test-trace-id' }
          })
        )
      )
      await expect(writeWardrobeSnapshot('delete', user, body)).rejects.toMatchObject({
        message: 'SERVER_ERROR',
        traceId: 'test-trace-id'
      })
    }
  )
  it.each([
    {},
    { revision: 1, replayed: false },
    { revision: 3, replayed: false },
    { revision: 2, replayed: 'false' }
  ])('does not accept an invalid acknowledgement as success: %j', async (result) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(result)))
    await expect(writeWardrobeSnapshot('delete', user, body)).rejects.toThrow('SERVER_ERROR')
  })
  it('accepts an original committed revision and keeps account and request identity', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ revision: 2, replayed: true }))
    vi.stubGlobal('fetch', fetch)
    await expect(writeWardrobeSnapshot('delete', user, body)).resolves.toEqual({
      revision: 2,
      replayed: true
    })
    expect(fetch).toHaveBeenCalledWith(
      '/api/wardrobe/cloud?action=delete',
      expect.objectContaining({
        credentials: 'same-origin',
        headers: expect.objectContaining({ 'X-Resonance-Account': user.id }),
        body: JSON.stringify(body)
      })
    )
  })
})
