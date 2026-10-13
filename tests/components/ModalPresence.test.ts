import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { useModalPresence } from '../../src/composables/useModalPresence'
import { useModalFocus } from '../../src/composables/useModalFocus'
import { useBodyScrollLock } from '../../src/utils/bodyScrollLock'

const wrappers: Array<{ unmount: () => void }> = []
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  document.body.innerHTML = ''
})

function mountModal() {
  const open = ref(false), enabled = ref(true), panel = ref<HTMLElement | null>(null)
  const trigger = document.createElement('button')
  document.body.append(trigger)
  trigger.focus()
  let motion!: ReturnType<typeof useModalPresence>
  const wrapper = mount(defineComponent({
    setup() {
      motion = useModalPresence(open, enabled)
      useBodyScrollLock(motion.present)
      useModalFocus(motion.present, panel, () => { open.value = false })
      return () => h('section', { ref: panel, tabindex: -1 })
    }
  }), { attachTo: document.body })
  wrappers.push(wrapper)
  return { open, enabled, panel, trigger, motion, wrapper }
}

describe('mobile modal transition lifecycle', () => {
  it('keeps scrolling locked until exit completes, then restores focus', async () => {
    const { open, panel, trigger, motion } = mountModal()
    open.value = true
    await flushPromises()
    expect(document.activeElement).toBe(panel.value)
    expect(document.body.style.overflow).toBe('hidden')
    open.value = false
    motion.beforeLeave(panel.value!)
    await flushPromises()
    expect(panel.value!.hasAttribute('inert')).toBe(true)
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.activeElement).not.toBe(trigger)
    motion.afterLeave(panel.value!)
    await flushPromises()
    expect(document.body.style.overflow).not.toBe('hidden')
    expect(document.activeElement).toBe(trigger)
  })

  it('does not release a reopened or newer exiting modal when an old exit finishes', async () => {
    const { open, panel, motion } = mountModal()
    open.value = true
    await flushPromises()
    open.value = false
    motion.beforeLeave(panel.value!)
    open.value = true
    motion.beforeEnter(panel.value!)
    expect(panel.value!.hasAttribute('inert')).toBe(false)
    motion.afterLeave(panel.value!)
    expect(motion.present.value).toBe(true)
    const previous = document.createElement('section')
    motion.beforeLeave(previous)
    open.value = false
    motion.beforeLeave(panel.value!)
    motion.afterLeave(previous)
    await flushPromises()
    expect(document.body.style.overflow).toBe('hidden')
    motion.afterLeave(panel.value!)
    await flushPromises()
    expect(document.body.style.overflow).not.toBe('hidden')
  })

  it('does not steal focus from the next dialog after exit', async () => {
    const { open, panel, motion } = mountModal()
    open.value = true
    await flushPromises()
    open.value = false
    motion.beforeLeave(panel.value!)
    const nextInput = document.createElement('input')
    document.body.append(nextInput)
    nextInput.focus()
    motion.afterLeave(panel.value!)
    await flushPromises()
    expect(document.activeElement).toBe(nextInput)
  })

  it('releases on desktop layout changes and component unmount', async () => {
    const { open, enabled, wrapper } = mountModal()
    open.value = true
    await flushPromises()
    enabled.value = false
    await flushPromises()
    expect(document.body.style.overflow).not.toBe('hidden')
    enabled.value = true
    await flushPromises()
    expect(document.body.style.overflow).toBe('hidden')
    wrapper.unmount()
    wrappers.pop()
    expect(document.body.style.overflow).not.toBe('hidden')
  })
})
