import { webcrypto } from 'node:crypto'
import { afterEach, expect, it, vi } from 'vitest'
import { createUuid } from '../../src/utils/uuid'

afterEach(() => vi.unstubAllGlobals())

it('uses native UUID when available', () => {
  const randomUUID = vi.fn(() => 'native-id')
  vi.stubGlobal('crypto', { randomUUID })
  expect(createUuid()).toBe('native-id')
  expect(randomUUID).toHaveBeenCalledOnce()
})

it('generates distinct UUID v4 IDs without randomUUID or subtle', () => {
  vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) })
  const ids = Array.from({ length: 100 }, createUuid)
  expect(new Set(ids).size).toBe(100)
  for (const id of ids)
    expect(id).toMatch(/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
})
