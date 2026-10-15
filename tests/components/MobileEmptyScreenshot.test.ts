import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import MobileEmptyScreenshot from '../../src/components/MobileEmptyScreenshot.vue'

enableAutoUnmount(afterEach)
afterEach(() => vi.unstubAllGlobals())

it('uses the requested asset, translates alt text, and hides failed images', async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn()
  }))
  const wrapper = mount(MobileEmptyScreenshot, { props: { page: 'outfits' } })
  expect(wrapper.get('img').attributes('src')).toBe('/img/page/outfits.webp')
  expect(wrapper.get('img').attributes('alt')).toBe('搭配码使用截图')
  await wrapper.get('img').trigger('load')
  expect(wrapper.find('img').exists()).toBe(true)
  await wrapper.get('img').trigger('error')
  expect(wrapper.find('img').exists()).toBe(false)
  await wrapper.setProps({ page: 'camera', language: 'en' })
  expect(wrapper.get('img').attributes('src')).toBe('/img/page/camera.webp')
  expect(wrapper.get('img').attributes('alt')).toBe('Camera parameters usage screenshot')
})

it('only mounts images on mobile and follows breakpoint changes', async () => {
  let onChange!: () => void
  const query = {
    matches: false,
    addEventListener: vi.fn((_event, listener) => {
      onChange = listener
    }),
    removeEventListener: vi.fn()
  }
  vi.stubGlobal('matchMedia', () => query)
  const wrapper = mount(MobileEmptyScreenshot, { props: { page: 'home' } })
  expect(wrapper.find('img').exists()).toBe(false)
  query.matches = true
  onChange()
  await wrapper.vm.$nextTick()
  expect(wrapper.get('img').attributes('src')).toBe('/img/page/home.webp')
  query.matches = false
  onChange()
  await wrapper.vm.$nextTick()
  expect(wrapper.find('img').exists()).toBe(false)
})
