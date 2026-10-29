import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import TopBar from '../../src/components/TopBar.vue'
import { messages } from '../../src/i18n'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('opens desktop menus on mouse hover and keeps the menu open across the gap', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  }))
  const wrapper = mount(TopBar, {
    props: {
      directoryName: '',
      isLoading: false,
      isDeleting: false,
      hasAlbumDirectory: false,
      hasX6GameAuthorization: false,
      thumbnailMode: 'default',
      thumbnailModeOptions: [],
      themeMode: 'light',
      language: 'zh',
      messages: messages.zh.topBar
    },
    global: { stubs: { Teleport: true, Transition: true, LikeCounter: true } }
  })
  try {
    const tools = wrapper.get('.tools-menu-button')
    await tools.trigger('pointerenter', { pointerType: 'touch' })
    expect(tools.attributes('aria-expanded')).toBe('false')
    await tools.trigger('pointerenter', { pointerType: 'mouse' })
    await flushPromises()
    expect(tools.attributes('aria-expanded')).toBe('true')
    await tools.trigger('click')
    await tools.trigger('click')
    expect(tools.attributes('aria-expanded')).toBe('true')
    await tools.trigger('pointerleave', { pointerType: 'mouse' })
    await vi.advanceTimersByTimeAsync(80)
    await wrapper.get('.header-dropdown').trigger('pointerenter', { pointerType: 'mouse' })
    await vi.advanceTimersByTimeAsync(120)
    expect(tools.attributes('aria-expanded')).toBe('true')
    await wrapper.get('.more-menu-button').trigger('pointerenter', { pointerType: 'mouse' })
    await flushPromises()
    expect(tools.attributes('aria-expanded')).toBe('false')
    expect(wrapper.get('.more-menu-button').attributes('aria-expanded')).toBe('true')
    await wrapper.get('.header-dropdown').trigger('pointerleave', { pointerType: 'mouse' })
    await vi.advanceTimersByTimeAsync(119)
    expect(wrapper.find('.header-dropdown').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.find('.header-dropdown').exists()).toBe(false)
    await tools.trigger('click')
    await flushPromises()
    expect(tools.attributes('aria-expanded')).toBe('true')
    await tools.trigger('click')
    expect(tools.attributes('aria-expanded')).toBe('false')
  } finally {
    wrapper.unmount()
  }
})
