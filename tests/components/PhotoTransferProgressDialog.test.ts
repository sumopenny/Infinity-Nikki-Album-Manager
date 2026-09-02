import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PhotoTransferProgressDialog from '../../src/components/PhotoTransferProgressDialog.vue'

const baseProps = {
  visible: true,
  title: '导出图片',
  completed: 0,
  total: 0,
  initialized: false,
  failedNames: [],
  isRunning: true,
  isCancelled: false,
  canCancel: true,
  cancelLabel: '取消导出',
  closeLabel: '关闭',
  completedLabel: '已完成',
  failedLabel: '失败',
  cancelledLabel: '已取消',
  closeActionLabel: '关闭结果'
}

describe('PhotoTransferProgressDialog', () => {
  it('keeps the first rendered progress at zero until totals are initialized', async () => {
    const wrapper = mount(PhotoTransferProgressDialog, {
      props: baseProps,
      global: { stubs: { Teleport: true, Transition: true } }
    })

    const progress = wrapper.get('.photo-transfer-progress')
    expect(progress.attributes('aria-valuenow')).toBe('0')
    expect(progress.classes()).toContain('is-initializing')
    expect(wrapper.get('.photo-transfer-progress-track span').attributes('style')).toContain('width: 0%')

    await wrapper.setProps({ initialized: true, total: 10, completed: 5 })
    expect(wrapper.get('.photo-transfer-progress').attributes('aria-valuenow')).toBe('50')
    expect(wrapper.get('.photo-transfer-progress').classes()).not.toContain('is-initializing')
    expect(wrapper.get('.photo-transfer-progress-track span').attributes('style')).toContain('width: 50%')

    await wrapper.setProps({ visible: false })
    expect(wrapper.find('.photo-transfer-overlay').exists()).toBe(false)
    wrapper.unmount()
  })
})
