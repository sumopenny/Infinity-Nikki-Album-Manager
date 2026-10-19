// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { defineComponent, nextTick, ref } from 'vue'
import { useAppPreferences } from '../../src/composables/useAppPreferences'

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

function setup() {
  const compact = ref(false)
  let persist = true
  const onStatus = vi.fn()
  let preferences!: ReturnType<typeof useAppPreferences>
  const wrapper = mount(
    defineComponent({
      setup() {
        preferences = useAppPreferences({
          compactLayout: compact,
          canPersist: () => persist,
          onStatus
        })
        return () => null
      }
    })
  )
  return {
    preferences,
    compact,
    onStatus,
    wrapper,
    pause: () => {
      persist = false
    }
  }
}

it('keeps desktop thumbnail preferences while compact layout falls back', () => {
  localStorage.setItem('infinity-nikki-thumbnail-mode', 'half')
  const { preferences, compact, wrapper } = setup()
  expect(preferences.effectivePhotoThumbnailMode.value).toBe('half')
  compact.value = true
  expect(preferences.effectivePhotoThumbnailMode.value).toBe('default')
  expect(localStorage.getItem('infinity-nikki-thumbnail-mode')).toBe('half')
  compact.value = false
  expect(preferences.effectivePhotoThumbnailMode.value).toBe('half')
  wrapper.unmount()
})

it('does not repopulate storage while website reset suppresses persistence', async () => {
  const { preferences, pause, wrapper } = setup()
  pause()
  localStorage.clear()
  preferences.language.value = 'en'
  preferences.autoParseActionsEnabled.value = true
  preferences.saveThumbnailMode('home', 'default')
  const switching = preferences.toggleTheme()
  await vi.advanceTimersByTimeAsync(280)
  await switching
  await nextTick()
  expect(localStorage.length).toBe(0)
  expect(document.documentElement.lang).toBe('en')
  expect(preferences.homeThumbnailMode.value).toBe('default')
  wrapper.unmount()
})

it('serializes preference changes and stops persistence watchers on unmount', async () => {
  const { preferences, onStatus, wrapper } = setup()
  const initial = preferences.language.value
  const switching = preferences.toggleLanguage()
  await preferences.toggleLanguage()
  await vi.advanceTimersByTimeAsync(280)
  await switching
  expect(preferences.language.value).not.toBe(initial)
  expect(onStatus).toHaveBeenCalledTimes(2)
  const stored = localStorage.getItem('infinity-nikki-language')
  wrapper.unmount()
  preferences.language.value = initial
  await nextTick()
  expect(localStorage.getItem('infinity-nikki-language')).toBe(stored)
  expect(document.documentElement.classList.contains('is-theme-switching')).toBe(false)
})
