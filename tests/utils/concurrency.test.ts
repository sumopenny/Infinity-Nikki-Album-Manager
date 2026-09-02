import { describe, expect, it } from 'vitest'
import { runWithConcurrency } from '../../src/utils/concurrency'

describe('runWithConcurrency', () => {
  it('limits concurrency and preserves input order', async () => {
    const tracker = { active: 0, peak: 0 }
    const results = await runWithConcurrency([3, 1, 2], async (value) => {
      tracker.active += 1
      tracker.peak = Math.max(tracker.peak, tracker.active)
      await new Promise((resolve) => window.setTimeout(resolve, value))
      tracker.active -= 1
      return value * 2
    }, { concurrency: 2 })
    expect(tracker.peak).toBe(2)
    expect(results).toEqual([6, 2, 4])
  })

  it('stops assigning new work after cancellation and keeps completed void results', async () => {
    const controller = new AbortController()
    let started = 0
    const completed: number[] = []
    const results = await runWithConcurrency([1, 2, 3], async () => {
      started += 1
      controller.abort()
      return undefined
    }, { concurrency: 1, signal: controller.signal, onItemComplete: (_, index) => completed.push(index) })
    expect(started).toBe(1)
    expect(completed).toEqual([0])
    expect(results).toEqual([undefined])
  })
})
