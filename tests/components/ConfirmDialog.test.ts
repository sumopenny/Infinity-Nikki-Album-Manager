import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ConfirmDialog from '../../src/components/ConfirmDialog.vue'

const wrappers: Array<{ unmount: () => void }> = []

afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function createDialog(tone: 'danger' | 'warning' | 'info' = 'danger', cancelLabel = '取消') {
  const trigger = document.createElement('button')
  trigger.textContent = '打开确认框'
  document.body.append(trigger)
  trigger.focus()
  const wrapper = mount(ConfirmDialog, {
    props: {
      visible: false,
      title: '确认操作',
      message: '操作说明',
      tone,
      confirmLabel: '确认',
      cancelLabel,
      closeLabel: '关闭'
    },
    attachTo: document.body
  })
  wrappers.push(wrapper)
  return { wrapper, trigger }
}

function getButton(selector: string) {
  return document.querySelector<HTMLButtonElement>(selector)!
}

describe('ConfirmDialog keyboard focus', () => {
  it('keeps cancellation as the default when a backup action is available', async () => {
    const { wrapper } = createDialog()
    await wrapper.setProps({
      visible: true,
      sections: [
        { title: '将清除', items: ['本地收藏'] },
        { title: '会保留', text: '原始照片' }
      ],
      consequence: '页面将刷新',
      secondaryLabel: '先导出备份'
    })
    await flushPromises()
    expect(document.activeElement).toBe(getButton('.confirm-dialog-button.ghost'))
    expect(document.body.textContent).toContain('原始照片')
    expect(document.body.textContent).toContain('页面将刷新')
    getButton('.confirm-dialog-button.secondary').click()
    expect(wrapper.emitted('secondary')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it.each(['danger', 'warning', 'info'] as const)(
    'chooses the safe initial focus for %s and returns to its trigger',
    async (tone) => {
      const { wrapper, trigger } = createDialog(tone)
      await wrapper.setProps({ visible: true })
      await flushPromises()
      expect(document.activeElement).toBe(
        getButton(
          tone === 'danger' ? '.confirm-dialog-button.ghost' : '.confirm-dialog-button.primary'
        )
      )
      await wrapper.setProps({ visible: false })
      await flushPromises()
      expect(document.activeElement).toBe(trigger)
    }
  )

  it('focuses close instead of confirm when a danger dialog has no cancel button', async () => {
    const { wrapper } = createDialog('danger', '')
    await wrapper.setProps({ visible: true })
    await flushPromises()
    expect(document.activeElement).toBe(getButton('.confirm-dialog-close'))
  })

  it('wraps Tab and Shift+Tab at the dialog boundaries', async () => {
    const { wrapper } = createDialog()
    await wrapper.setProps({ visible: true })
    await flushPromises()
    const first = getButton('.confirm-dialog-close')
    const last = getButton('.confirm-dialog-button.primary')
    document.querySelectorAll<HTMLElement>('.confirm-dialog-panel button').forEach((button) => {
      vi.spyOn(button, 'getClientRects').mockReturnValue([{}] as unknown as DOMRectList)
    })
    last.focus()
    const forward = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
    last.dispatchEvent(forward)
    expect(forward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(first)
    const backward = new KeyboardEvent('keydown', {
      key: 'Tab',
      shiftKey: true,
      bubbles: true,
      cancelable: true
    })
    first.dispatchEvent(backward)
    expect(backward.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(last)
  })

  it('cancels once on Escape and never confirms', async () => {
    const { wrapper } = createDialog()
    await wrapper.setProps({ visible: true })
    await flushPromises()
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    )
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('confirm')).toBeUndefined()
  })

  it('does not take focus back from a newer dialog', async () => {
    const { wrapper } = createDialog()
    await wrapper.setProps({ visible: true })
    await flushPromises()
    const nextInput = document.createElement('input')
    document.body.append(nextInput)
    nextInput.focus()
    await wrapper.setProps({ visible: false })
    await flushPromises()
    expect(document.activeElement).toBe(nextInput)
  })

  it('supports mounting an already visible dialog', async () => {
    const wrapper = mount(ConfirmDialog, {
      props: {
        visible: true,
        title: '确认操作',
        message: '操作说明',
        tone: 'danger',
        confirmLabel: '确认',
        cancelLabel: '取消',
        closeLabel: '关闭'
      },
      attachTo: document.body
    })
    wrappers.push(wrapper)
    await flushPromises()
    expect(document.activeElement).toBe(getButton('.confirm-dialog-button.ghost'))
  })
})
