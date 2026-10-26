import { describe, expect, it, vi } from 'vitest'
import { createCloudSession } from '../../src/composables/useCloudSession'
import type { cloudRequest } from '../../src/utils/resonance/cloudClient'

describe('shared cloud session races', () => {
  it.each([
    {},
    [],
    null,
    { user: null },
    { user: {} },
    { user: { id: '', username: 'nikki' } },
    { user: { id: 'a', username: 42 } }
  ])('rejects malformed authentication responses: %j', async (result) => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ user: { id: 'a', username: 'nikki' } })
      .mockResolvedValue(result)
    const session = createCloudSession(request as typeof cloudRequest)
    await session.refresh()
    await expect(session.authenticate('login', 'nikki', 'abcdef', '')).rejects.toThrow(
      'SERVER_ERROR'
    )
    expect(session.user.value).toEqual({ id: 'a', username: 'nikki' })
  })
  it('requires an explicit null session and confirms uncertain logout', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ user: { id: 'a', username: 'nikki' } })
      .mockResolvedValue({})
    const session = createCloudSession(request as typeof cloudRequest)
    await session.refresh()
    await expect(session.refresh()).rejects.toThrow('SERVER_ERROR')
    await expect(session.logout()).rejects.toThrow('SERVER_ERROR')
    expect(session.user.value?.id).toBe('a')
    request.mockResolvedValue({ user: null })
    await session.refresh()
    expect(session.user.value).toBeNull()
  })
  it('coalesces concurrent reads and ignores an old session after login', async () => {
    let finish!: (value: unknown) => void
    const request = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
      .mockResolvedValue({ user: { id: 'new', username: 'new_user' } })
    const session = createCloudSession(request as typeof cloudRequest)
    const first = session.refresh(),
      second = session.refresh()
    expect(first).toBe(second)
    await session.authenticate('login', 'new_user', 'abcdef', '')
    finish({ user: { id: 'old', username: 'old_user' } })
    await first
    expect(session.user.value?.id).toBe('new')
    expect(request).toHaveBeenCalledTimes(2)
  })
  it('invalidates pending reads on logout and resolves uncertain logout by querying the session', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ user: { id: 'a', username: 'nikki' } })
      .mockRejectedValueOnce(new Error('NETWORK'))
      .mockResolvedValueOnce({ user: null })
    const session = createCloudSession(request as typeof cloudRequest)
    await session.refresh()
    await session.logout()
    expect(session.user.value).toBeNull()
  })
})
