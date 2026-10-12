import { describe, expect, it } from 'vitest'
import { runWithConcurrency } from '../../src/utils/concurrency'

describe('runWithConcurrency', () => {
  it('limits concurrency and preserves input order when tasks finish out of order', async () => {
    const tracker = { active: 0, peak: 0 }
    const completions = new Map<number, () => void>()
    const finished: number[] = []
    let thirdStarted!: () => void
    const thirdReady = new Promise<void>(resolve => { thirdStarted = resolve })
    const running = runWithConcurrency([3, 1, 2], async value => {
      tracker.active += 1
      tracker.peak = Math.max(tracker.peak, tracker.active)
      const pending = new Promise<void>(resolve => completions.set(value, resolve))
      if (value === 2) thirdStarted()
      await pending
      tracker.active -= 1
      finished.push(value)
      return value * 2
    }, { concurrency: 2 })

    expect([...completions.keys()]).toEqual([3, 1])
    completions.get(1)!()
    await thirdReady
    completions.get(2)!()
    completions.get(3)!()

    expect(await running).toEqual([6, 2, 4])
    expect(finished).toEqual([1, 2, 3])
    expect(tracker.peak).toBe(2)
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
