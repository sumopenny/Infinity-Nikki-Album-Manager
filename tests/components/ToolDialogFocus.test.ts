import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, expect, it, vi } from 'vitest'
import CleanupDialog from '../../src/components/CleanupDialog.vue'
import FortuneTimeDialog from '../../src/components/FortuneTimeDialog.vue'
import { messages } from '../../src/i18n'

function mountDialog(name: string) {
  const options = { attachTo: document.body, props: { visible: false } }
  return name === 'cleanup'
    ? mount(CleanupDialog, {
        ...options,
        props: {
          ...options.props,
          authorizedName: null,
          busyItem: null,
          disabled: true,
          messages: messages.zh.cleanup
        }
      })
    : mount(FortuneTimeDialog, {
        ...options,
        props: { ...options.props, messages: messages.zh.fortuneTime }
      })
}

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

it.each(['cleanup', 'fortune'])(
  '%s focuses on open, traps Tab and restores focus on close',
  async (name) => {
    const trigger = document.createElement('button')
    document.body.append(trigger)
    trigger.focus()
    const wrapper = mountDialog(name)
    vi.spyOn(HTMLElement.prototype, 'getClientRects').mockReturnValue([
      {} as DOMRect
    ] as unknown as DOMRectList)
    try {
      await wrapper.setProps({ visible: true })
      await flushPromises()
      const panel = document.querySelector<HTMLElement>('.dialog-panel')!
      expect(document.activeElement).toBe(panel)
      const buttons = [...panel.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
      const press = (key: string, shiftKey = false) => {
        const event = new KeyboardEvent('keydown', {
          key,
          shiftKey,
          bubbles: true,
          cancelable: true
        })
        document.activeElement!.dispatchEvent(event)
        expect(event.defaultPrevented).toBe(true)
      }
      press('Tab')
      expect(document.activeElement).toBe(buttons[0])
      press('Tab', true)
      expect(document.activeElement).toBe(buttons.at(-1))
      press('Tab')
      expect(document.activeElement).toBe(buttons[0])
      press('Escape')
      expect(wrapper.emitted('close')).toHaveLength(1)
      await wrapper.setProps({ visible: false })
      await flushPromises()
      expect(document.activeElement).toBe(trigger)
      trigger.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      expect(wrapper.emitted('close')).toHaveLength(1)
    } finally {
      wrapper.unmount()
    }
  }
)
