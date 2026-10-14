import { webcrypto, createHash } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { sha256Hex } from '../../src/utils/sha256'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it.each([
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad']
])('matches standard SHA-256 vectors without subtle: %s', async (value, expected) => {
  vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) })
  expect(await sha256Hex(new TextEncoder().encode(value).buffer)).toBe(expected)
})

it('uses native digest when available and matches fallback for binary and multi-block inputs', async () => {
  const digest = vi.fn(webcrypto.subtle.digest.bind(webcrypto.subtle))
  const bytes = Uint8Array.from({ length: 1025 }, (_, index) => index % 256)
  vi.stubGlobal('crypto', { subtle: { digest } })
  const native = await sha256Hex(bytes.buffer)
  expect(digest).toHaveBeenCalledWith('SHA-256', bytes.buffer)
  vi.stubGlobal('crypto', undefined)
  expect(await sha256Hex(bytes.buffer)).toBe(native)
  expect(native).toBe(createHash('sha256').update(bytes).digest('hex'))
})

it('propagates native digest errors instead of hiding them', async () => {
  vi.stubGlobal('crypto', {
    subtle: { digest: vi.fn().mockRejectedValue(new Error('digest failed')) }
  })
  await expect(sha256Hex(new ArrayBuffer(0))).rejects.toThrow('digest failed')
})
