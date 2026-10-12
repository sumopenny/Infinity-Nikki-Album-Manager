import { expect, it, vi } from 'vitest'
import { cacheGeneration, invalidateCacheWrites, persistCacheIfCurrent } from '../../src/utils/cacheLifecycle'
it('waits for active writes and prevents old producers from restoring cleared cache', async () => {
  const generation = cacheGeneration()
  let finish!: () => void
  const write = persistCacheIfCurrent(generation, () => new Promise(resolve => { finish = resolve }))
  let cleared = false
  const clearing = invalidateCacheWrites().then(() => { cleared = true })
  await Promise.resolve()
  expect(cleared).toBe(false)
  const late = vi.fn()
  await persistCacheIfCurrent(generation, late)
  expect(late).not.toHaveBeenCalled()
  finish()
  await Promise.all([write, clearing])
  expect(cleared).toBe(true)
  const next = vi.fn().mockResolvedValue(undefined)
  await persistCacheIfCurrent(cacheGeneration(), next)
  expect(next).toHaveBeenCalledOnce()
})
