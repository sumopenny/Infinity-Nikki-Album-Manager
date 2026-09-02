import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { messages } from '../../src/i18n'
import { useOperationNotice } from '../../src/composables/useOperationNotice'

afterEach(() => vi.useRealTimers())

describe('useOperationNotice', () => {
  it('auto closes and preserves the remaining duration while paused', () => {
    vi.useFakeTimers()
    const notice = useOperationNotice(computed(() => messages.zh))
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
    const notice = useOperationNotice(computed(() => messages.zh))
    notice.showNotice({ loading: true, duration: 10 })
    vi.advanceTimersByTime(100)
    expect(notice.isVisible.value).toBe(true)
    notice.closeNotice()
    expect(notice.isVisible.value).toBe(false)
  })
})
