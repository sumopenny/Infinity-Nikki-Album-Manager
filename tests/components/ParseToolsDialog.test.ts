import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ParseToolsDialog from '../../src/components/ParseToolsDialog.vue'

const messages = {
  title: '参数/搭配码解析',
  close: '关闭',
  cameraTitle: '相机参数',
  outfitTitle: '搭配码',
  cameraPlaceholder: '填写相机参数',
  outfitPlaceholder: '填写搭配码',
  cameraSubmit: '解析相机参数',
  outfitSubmit: '解析搭配码',
  busyHint: '请稍候',
  upload: '上传图片解析',
  uploadHint: '选择本地游戏原图'
}

function mountDialog(overrides: Partial<{ visible: boolean; busy: boolean }> = {}) {
  return mount(ParseToolsDialog, {
    props: {
      visible: true,
      cameraParams: '',
      outfitCode: '',
      outfitMaxLength: 64,
      busy: false,
      messages,
      ...overrides
    },
    global: { stubs: { Teleport: true, Transition: false } }
  })
}

describe('ParseToolsDialog', () => {
  it('renders both parser sections and emits their values', async () => {
    const wrapper = mountDialog()
    const inputs = wrapper.findAll('input:not([type="file"])')
    await inputs[0].setValue('camera-raw')
    await inputs[1].setValue('outfit-code')
    await wrapper.setProps({ cameraParams: 'camera-raw', outfitCode: 'outfit-code' })
    await wrapper.findAll('form')[0].trigger('submit')
    await wrapper.findAll('form')[1].trigger('submit')

    expect(wrapper.text()).toContain(messages.cameraTitle)
    expect(wrapper.text()).toContain(messages.outfitTitle)
    expect(wrapper.findAll('.outfit-parse-form')).toHaveLength(2)
    expect(wrapper.findAll('.outfit-parse-submit')).toHaveLength(3)
    expect(wrapper.emitted('parse-camera')).toEqual([['camera-raw']])
    expect(wrapper.emitted('parse-outfit')).toEqual([['outfit-code']])
  })

  it('disables both inputs while busy', () => {
    const busy = mountDialog({ busy: true })
    expect(busy.text()).toContain(messages.busyHint)
    expect(busy.findAll('input').every((input) => input.element.disabled)).toBe(true)
    busy.unmount()
  })

  it('closes from the close button, overlay, and Escape', async () => {
    const wrapper = mountDialog()
    await wrapper.find('header button').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.find('.dialog-overlay').trigger('click.self')
    expect(wrapper.emitted('close')).toHaveLength(2)
    await wrapper.find('.dialog-overlay').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('close')).toHaveLength(3)
  })
})
