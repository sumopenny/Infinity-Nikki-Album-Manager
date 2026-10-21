import { mount, flushPromises } from '@vue/test-utils'
import { expect, it } from 'vitest'
import PearpalRegionPicker from '../../src/components/PearpalRegionPicker.vue'

it('uses the shared menu, supports keyboard selection and consumes Escape before the dialog', async () => {
  const wrapper = mount(PearpalRegionPicker, {
    props: { modelValue: 'cn', language: 'zh' },
    attachTo: document.body
  })
  try {
    const trigger = wrapper.get('.cleanup-account-select')
    await trigger.trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.cleanup-account-menu [role="menuitemradio"]')).toHaveLength(5)
    expect(document.activeElement?.getAttribute('data-region')).toBe('cn')
    await wrapper.get('[data-region="cn"]').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement?.getAttribute('data-region')).toBe('asia')
    await wrapper.get('[data-region="asia"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['asia']])
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    await trigger.trigger('click')
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.activeElement!.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
    expect(document.activeElement).toBe(trigger.element)
    await trigger.trigger('click')
    document.body.click()
    await flushPromises()
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  } finally {
    wrapper.unmount()
  }
})
