import { mount, flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import DateSidebar from '../../src/components/DateSidebar.vue'
import { messages } from '../../src/i18n'

it('keeps action sorting functional with a detached desktop menu and ignores inner scrolling', async () => {
  const wrapper = mount(DateSidebar, {
    attachTo: document.body,
    props: {
      yearGroups: [],
      actionGroups: [],
      mode: 'action',
      actionSort: 'id',
      language: 'zh',
      messages: messages.zh.sidebar
    }
  })
  try {
    const trigger = wrapper.get('.action-sort-select')
    vi.spyOn(trigger.element, 'getBoundingClientRect').mockReturnValue({
      left: 20,
      top: 700,
      bottom: 730,
      width: 160
    } as DOMRect)
    await trigger.trigger('click')
    const menu = document.querySelector<HTMLElement>('[role="listbox"]')!
    expect(document.body.contains(menu)).toBe(true)
    expect(wrapper.element.contains(menu)).toBe(false)
    expect(menu.style.position).toBe('fixed')
    expect(menu.style.bottom).not.toBe('auto')
    menu.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(document.querySelector('[role="listbox"]')).not.toBeNull()
    menu.querySelectorAll<HTMLButtonElement>('button')[1].click()
    await flushPromises()
    expect(wrapper.emitted('changeActionSort')).toEqual([['name']])
    expect(document.activeElement).toBe(trigger.element)
    await trigger.trigger('click')
    window.dispatchEvent(new Event('scroll'))
    await flushPromises()
    expect(document.querySelector('[role="listbox"]')).toBeNull()
    await trigger.trigger('click')
    document
      .querySelector('[role="listbox"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(document.querySelector('[role="listbox"]')).toBeNull()
  } finally {
    wrapper.unmount()
  }
})
