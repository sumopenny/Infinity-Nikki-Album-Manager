import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import StoredImage from '../../src/components/StoredImage.vue'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('reads only near the viewport, releases on exit and discards late results after replacement', async () => {
  let intersect!: (entries: Array<{ isIntersecting: boolean }>) => void
  const disconnect = vi.fn()
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: typeof intersect) {
        intersect = callback
      }
      observe() {}
      disconnect = disconnect
    }
  )
  const create = vi.fn(() => 'blob:test'),
    revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const load = vi.fn(async () => new Blob(['image']))
  const wrapper = mount(StoredImage, { props: { sourceKey: 'one', load, alt: 'cover' } })
  expect(load).not.toHaveBeenCalled()
  intersect([{ isIntersecting: true }])
  await flushPromises()
  expect(wrapper.get('img').attributes('src')).toBe('blob:test')
  intersect([{ isIntersecting: false }])
  await flushPromises()
  expect(revoke).toHaveBeenCalledWith('blob:test')
  let finish!: (blob: Blob) => void
  load.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  intersect([{ isIntersecting: true }])
  await wrapper.setProps({ sourceKey: 'two' })
  await flushPromises()
  expect(create).toHaveBeenCalledTimes(2)
  finish(new Blob(['old']))
  await flushPromises()
  expect(create).toHaveBeenCalledTimes(2)
  wrapper.unmount()
  expect(disconnect).toHaveBeenCalledOnce()
  expect(revoke).toHaveBeenCalledTimes(2)
})

it('does not create a URL when unmounted during an image read', async () => {
  let finish!: (blob: Blob) => void
  vi.stubGlobal('IntersectionObserver', undefined)
  // 不支持观察器的环境走首次加载回退。
  delete (window as unknown as Record<string, unknown>).IntersectionObserver
  const create = vi.fn(),
    revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
  const wrapper = mount(StoredImage, {
    props: {
      sourceKey: 'one',
      alt: 'cover',
      load: () =>
        new Promise((resolve) => {
          finish = resolve
        })
    }
  })
  wrapper.unmount()
  finish(new Blob(['late']))
  await flushPromises()
  expect(create).not.toHaveBeenCalled()
})

it('loads visible covers even when the observer never calls back, and keeps distant covers lazy', async () => {
  let frame!: FrameRequestCallback
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((callback) => {
      frame = callback
      return 1
    })
  )
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      disconnect() {}
    }
  )
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:fallback'), revokeObjectURL: vi.fn() })
  let top = 3000
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({
    x: 0,
    y: top,
    top,
    left: 0,
    right: 160,
    bottom: top + 90,
    width: 160,
    height: 90,
    toJSON() {}
  }))
  const load = vi.fn(async () => new Blob(['image'], { type: 'image/png' }))
  const wrapper = mount(StoredImage, { props: { sourceKey: 'saved', load, alt: 'cover' } })
  frame(0)
  await flushPromises()
  expect(load).not.toHaveBeenCalled()
  top = 100
  window.dispatchEvent(new Event('scroll'))
  frame(1)
  await flushPromises()
  expect(load).toHaveBeenCalledOnce()
  expect(wrapper.get('img').attributes('src')).toBe('blob:fallback')
  await wrapper.get('img').trigger('load')
  window.dispatchEvent(new Event('focus'))
  frame(2)
  await flushPromises()
  expect(load).toHaveBeenCalledOnce()
  top = 3000
  window.dispatchEvent(new Event('scroll'))
  frame(3)
  await flushPromises()
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fallback')
  wrapper.unmount()
})

it('shows an error placeholder when saved cover reading fails', async () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const wrapper = mount(StoredImage, {
    props: {
      sourceKey: 'missing',
      alt: 'cover',
      load: async () => {
        throw new Error('missing saved bytes')
      }
    }
  })
  await flushPromises()
  expect(wrapper.get('[role="img"]').text()).toBe('×')
  wrapper.unmount()
})
