import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStatusNotice } from '../../src/composables/useStatusNotice'

afterEach(() => vi.useRealTimers())

describe('useStatusNotice', () => {
  it('auto closes and preserves the remaining duration while paused', () => {
    vi.useFakeTimers()
    const notice = useStatusNotice()
    notice.showNotice({ duration: 1000 })
    vi.advanceTimersByTime(400)
    notice.pauseNotice()
    vi.advanceTimersByTime(1000)
    expect(notice.isVisible.value).toBe(true)
    notice.resumeNotice()
    vi.advanceTimersByTime(599)
    expect(notice.isVisible.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(notice.isVisible.value).toBe(false)
  })

  it('keeps loading notices visible until explicitly closed', () => {
    vi.useFakeTimers()
    const notice = useStatusNotice()
    notice.showNotice({ loading: true, duration: 10 })
    vi.advanceTimersByTime(100)
    expect(notice.isVisible.value).toBe(true)
    notice.closeNotice()
    expect(notice.isVisible.value).toBe(false)
  })
})
