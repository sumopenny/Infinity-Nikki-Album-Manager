import { mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import DesktopMenuTransition from '../../src/components/DesktopMenuTransition.vue'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

it.each([false, true])(
  'blocks interaction during exit, supports reopening, and removes the closed menu (mobile=%s)',
  async (compact) => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: compact, addEventListener() {}, removeEventListener() {} }))
    )
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
      setTimeout(() => callback(0), 16)
    )
    const style = document.createElement('style')
    style.textContent =
      '.desktop-menu-leave-active, .mobile-dropdown-leave-active { transition-duration: 0.14s; transition-delay: 0s; transition-property: opacity; }'
    document.head.append(style)
    const open = ref(true)
    const wrapper = mount(
      defineComponent({
        setup: () => () =>
          h(DesktopMenuTransition, null, {
            default: () => (open.value ? h('button', { class: 'test-menu' }, 'Menu') : null)
          })
      }),
      { attachTo: document.body, global: { stubs: { transition: false } } }
    )
    try {
      open.value = false
      await nextTick()
      expect(document.querySelector('.test-menu')?.getAttribute('inert')).toBe('')
      open.value = true
      await nextTick()
      expect(document.querySelector('.test-menu')?.hasAttribute('inert')).toBe(false)
      await vi.advanceTimersByTimeAsync(200)
      expect(document.querySelector('.test-menu')).not.toBeNull()
      open.value = false
      await nextTick()
      await vi.advanceTimersByTimeAsync(250)
      expect(document.querySelector('.test-menu')).toBeNull()
    } finally {
      wrapper.unmount()
      style.remove()
    }
  }
)
