import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import WindowedPhotoBatch from '../../src/components/WindowedPhotoBatch.vue'
afterEach(() => vi.unstubAllGlobals())
it('mounts only nearby cards and keeps a measured placeholder after leaving', async () => {
  let notify!: IntersectionObserverCallback
  const disconnect = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: IntersectionObserverCallback) { notify = callback }
    observe() {} disconnect = disconnect
  })
  const wrapper = mount(WindowedPhotoBatch, { props: { count: 36 }, slots: { default: '<article>photo</article>' } })
  expect(wrapper.find('article').exists()).toBe(false)
  const visible = async (value: boolean) => {
    notify([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver)
    await nextTick()
  }
  await visible(true)
  expect(wrapper.find('article').exists()).toBe(true)
  vi.spyOn(wrapper.element, 'getBoundingClientRect').mockReturnValue({ height: 640 } as DOMRect)
  await visible(false)
  expect(wrapper.find('article').exists()).toBe(false)
  expect((wrapper.element as HTMLElement).style.height).toBe('640px')
  wrapper.unmount()
  expect(disconnect).toHaveBeenCalled()
})
