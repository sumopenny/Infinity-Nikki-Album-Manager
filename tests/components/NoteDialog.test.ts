import { mount, flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import NoteDialog from '../../src/components/NoteDialog.vue'
it('keeps editing keys inside the dialog and consumes Escape', async () => {
  const wrapper = mount(NoteDialog, {
    attachTo: document.body,
    props: {
      visible: false,
      title: '备注',
      label: '备注',
      placeholder: '',
      initialValue: '原备注',
      saveLabel: '保存',
      cancelLabel: '取消',
      closeLabel: '关闭',
      maxLength: 100,
      busy: false
    }
  })
  await wrapper.setProps({ visible: true })
  await flushPromises()
  const input = document.querySelector<HTMLInputElement>('#photo-note-input')!
  expect(document.activeElement).toBe(document.querySelector('.note-dialog-panel'))
  const rects = vi
    .spyOn(HTMLElement.prototype, 'getClientRects')
    .mockReturnValue([{} as DOMRect] as unknown as DOMRectList)
  const buttons = document.querySelectorAll<HTMLButtonElement>('.note-dialog-panel button')
  buttons[buttons.length - 1]!.focus()
  buttons[buttons.length - 1]!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
  )
  expect(document.activeElement).toBe(buttons[0])
  buttons[0]!.dispatchEvent(
    new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })
  )
  expect(document.activeElement).toBe(buttons[buttons.length - 1])
  rects.mockRestore()
  input.focus()
  const handler = vi.fn()
  window.addEventListener('keydown', handler)
  try {
    for (const key of ['ArrowLeft', 'ArrowRight', 'Delete'])
      input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    expect(handler).not.toHaveBeenCalled()
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    input.dispatchEvent(escape)
    expect(escape.defaultPrevented).toBe(true)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  } finally {
    window.removeEventListener('keydown', handler)
    wrapper.unmount()
  }
})
