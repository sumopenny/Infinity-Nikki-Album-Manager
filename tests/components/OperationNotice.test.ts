import { expect, it } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import OperationNotice from '../../src/components/OperationNotice.vue'

it('keeps the top notice inside an open native dialog and returns it to body after closing', async () => {
  const dialog = document.createElement('dialog')
  document.body.append(dialog)
  const wrapper = mount(OperationNotice, {
    props: {
      title: '提示',
      notices: [{ id: 1, loading: false, tone: 'error', message: '账号名或密码错误。' }],
      closeLabel: '关闭'
    }
  })
  try {
    dialog.setAttribute('open', '')
    await flushPromises()
    expect(dialog.querySelector('[role=alert]')?.textContent).toContain('账号名或密码错误。')
    dialog.querySelector<HTMLButtonElement>('button')!.click()
    expect(wrapper.emitted('close')).toEqual([[1]])
    dialog.removeAttribute('open')
    await flushPromises()
    expect(document.body.querySelector('.operation-notice')).not.toBeNull()
    expect(dialog.querySelector('.operation-notice')).toBeNull()
  } finally {
    wrapper.unmount()
    dialog.remove()
  }
})

it('renders notices in arrival order and targets each control independently', async () => {
  const wrapper = mount(OperationNotice, {
    props: {
      title: 'Notice',
      closeLabel: 'Close',
      notices: [
        { id: 1, message: 'First', tone: 'success', loading: false },
        { id: 2, message: 'Second', tone: 'error', loading: false }
      ]
    },
    global: { stubs: { Teleport: true } }
  })
  const cards = wrapper.findAll('.operation-notice')
  expect(cards.map((card) => card.find('.operation-notice-message').text())).toEqual([
    'First',
    'Second'
  ])
  await cards[0]!.trigger('mouseenter')
  await cards[0]!.trigger('mouseleave')
  await cards[1]!.get('button').trigger('click')
  expect(wrapper.emitted('pause')).toEqual([[1]])
  expect(wrapper.emitted('resume')).toEqual([[1]])
  expect(wrapper.emitted('close')).toEqual([[2]])
  await wrapper.setProps({ notices: [{ id: 2, message: 'Second', tone: 'error', loading: false }] })
  expect(wrapper.findAll('.operation-notice')).toHaveLength(1)
  wrapper.unmount()
})
