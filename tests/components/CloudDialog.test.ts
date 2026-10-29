import { mount, flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import CloudDialog from '../../src/components/CloudDialog.vue'

it('opens the native dialog when lazy mounted already visible', async () => {
  const originalShow = HTMLDialogElement.prototype.showModal
  const originalClose = HTMLDialogElement.prototype.close
  const show = vi.fn(function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
  })
  const close = vi.fn(function (this: HTMLDialogElement) {
    this.removeAttribute('open')
  })
  HTMLDialogElement.prototype.showModal = show
  HTMLDialogElement.prototype.close = close
  const wrapper = mount(CloudDialog, {
    props: { visible: true, busy: false, title: '登录', cancelLabel: '取消' }
  })
  try {
    await flushPromises()
    expect(document.body.querySelector('dialog')?.hasAttribute('open')).toBe(true)
    expect(show).toHaveBeenCalledTimes(1)
  } finally {
    wrapper.unmount()
    HTMLDialogElement.prototype.showModal = originalShow
    HTMLDialogElement.prototype.close = originalClose
  }
})
