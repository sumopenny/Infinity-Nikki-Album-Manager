import { afterEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick } from 'vue'
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

  it('uses the shared success, warning, and error lifetimes for status notifications', async () => {
    vi.useFakeTimers()
    const notice = useOperationNotice(computed(() => messages.zh))

    notice.showStatus({ message: 'Saved', tone: 'success', source: 'resonance' })
    await nextTick()
    vi.advanceTimersByTime(5199)
    expect(notice.isVisible.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(notice.isVisible.value).toBe(false)

    notice.showStatus({ message: 'Check UID', tone: 'warning', source: 'resonance' })
    await nextTick()
    vi.advanceTimersByTime(7199)
    expect(notice.isVisible.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(notice.isVisible.value).toBe(false)

    notice.showStatus({ message: 'Save failed', tone: 'error', source: 'resonance' })
    await nextTick()
    vi.advanceTimersByTime(7199)
    expect(notice.isVisible.value).toBe(true)
    vi.advanceTimersByTime(1)
    expect(notice.isVisible.value).toBe(false)
  })

  it('clears a status only when its source matches', async () => {
    const notice = useOperationNotice(computed(() => messages.zh))
    notice.showStatus({ message: 'Save failed', tone: 'error', source: 'resonance' })
    await nextTick()

    notice.clearStatus('other')
    await nextTick()
    expect(notice.isVisible.value).toBe(true)

    notice.clearStatus('resonance')
    await nextTick()
    expect(notice.isVisible.value).toBe(false)
  })
})
