import { expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import OperationNotice from '../../src/components/OperationNotice.vue'

it('keeps the top notice inside an open native dialog and returns it to body after closing', async () => {
  const dialog = document.createElement('dialog')
  document.body.append(dialog)
  const wrapper = mount(OperationNotice, { props: { visible: true, title: '提示', message: '账号名或密码错误。', tone: 'error', isLoading: false, closeLabel: '关闭' } })
  try {
    dialog.setAttribute('open', '')
    await flushPromises()
    expect(dialog.querySelector('[role=alert]')?.textContent).toContain('账号名或密码错误。')
    dialog.querySelector<HTMLButtonElement>('button')!.click()
    expect(wrapper.emitted('close')).toHaveLength(1)
    dialog.removeAttribute('open')
    await flushPromises()
    expect(document.body.querySelector('.operation-notice')).not.toBeNull()
    expect(dialog.querySelector('.operation-notice')).toBeNull()
  } finally { wrapper.unmount(); dialog.remove() }
})
