import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PhotoParamsDialog from '../../src/components/PhotoParamsDialog.vue'
import { photoParamsZh as messages } from '../../src/i18n/messages/photoParams'

describe('PhotoParamsDialog', () => {
  it('shows a fixed placeholder when a resource image fails', async () => {
    const wrapper = mount(PhotoParamsDialog, { props: { visible: true, photo: null, uidRequired: false, progress: { stage: 'ready', percent: 100, message: '' }, result: { environmentFields: [], cameraFields: [], imageFields: [], resourceGroups: [{ kind: 'light', title: '灯光', name: 'unknown', imageUrl: 'https://invalid.example/image.webp' }], rawCameraParams: 'raw' }, error: null, messages }, global: { stubs: { Teleport: true } } })
    await wrapper.find('.photo-params-resource-row img').trigger('error')
    expect(wrapper.find('.photo-params-resource-image-placeholder').exists()).toBe(true)
    wrapper.unmount()
  })

  it('does not render a numeric value when an action only provides its name', () => {
    const wrapper = mount(PhotoParamsDialog, { props: { visible: true, photo: null, uidRequired: false, progress: { stage: 'ready', percent: 100, message: '' }, result: { environmentFields: [], cameraFields: [], imageFields: [], resourceGroups: [{ kind: 'pose', title: '动作', name: '我生气啦！', imageUrl: '/pose.png' }], rawCameraParams: 'raw' }, error: null, messages }, global: { stubs: { Teleport: true } } })
    const row = wrapper.get('.photo-params-resource-row')
    expect(row.get('.photo-params-resource-placeholder').text()).toBe('我生气啦！')
    expect(row.find('strong').exists()).toBe(false)
    wrapper.unmount()
  })

  it('renders capture information before the camera section', () => {
    const wrapper = mount(PhotoParamsDialog, { props: { visible: true, photo: null, uidRequired: false, progress: { stage: 'ready', percent: 100, message: '' }, result: { environmentFields: [{ label: '拍摄时间', value: '12:34:56' }, { label: '天气', value: '2' }], cameraFields: [{ label: '焦距', value: '50 mm' }], imageFields: [], resourceGroups: [], rawCameraParams: 'raw' }, error: null, messages }, global: { stubs: { Teleport: true } } })
    const sections = wrapper.findAll('.photo-params-section')
    expect(sections[0].find('h3').text()).toBe('环境')
    expect(sections[0].text()).toContain('12:34:56')
    expect(sections[1].find('h3').text()).toBe('相机')
    wrapper.unmount()
  })

  it('passes normalized slider ratios to the thumb track', () => {
    const wrapper = mount(PhotoParamsDialog, { props: { visible: true, photo: null, uidRequired: false, progress: { stage: 'ready', percent: 100, message: '' }, result: { environmentFields: [], cameraFields: [{ label: '焦距', value: '10mm', position: 0 }], imageFields: [{ label: '曝光', value: '1.0', position: 100 }], resourceGroups: [], rawCameraParams: 'raw' }, error: null, messages }, global: { stubs: { Teleport: true } } })
    const sliders = wrapper.findAll('.photo-params-slider')
    expect(sliders[0].attributes('style')).toContain('--photo-params-slider-ratio: 0')
    expect(sliders[1].attributes('style')).toContain('--photo-params-slider-ratio: 1')
    wrapper.unmount()
  })

  it('shows the UID form only when a valid UID account is required', () => {
    const props = { visible: true, photo: null, progress: { stage: 'error' as const, percent: 100, message: '' }, result: null, error: '未找到有效UID账号', messages }
    const required = mount(PhotoParamsDialog, { props: { ...props, uidRequired: true }, global: { stubs: { Teleport: true } } })
    expect(required.find('.photo-params-uid-form').exists()).toBe(true)
    required.unmount()

    const optional = mount(PhotoParamsDialog, { props: { ...props, uidRequired: false }, global: { stubs: { Teleport: true } } })
    expect(optional.find('.photo-params-uid-form').exists()).toBe(false)
    expect(optional.find('.photo-params-error').text()).toContain('未找到有效UID账号')
    optional.unmount()
  })

  it('uses a spinner and stage text while parsing without a percentage', () => {
    const wrapper = mount(PhotoParamsDialog, { props: { visible: true, photo: null, uidRequired: false, progress: { stage: 'decryptingPhoto', percent: 70, message: '正在解密照片参数…' }, result: null, error: null, messages }, global: { stubs: { Teleport: true } } })
    expect(wrapper.find('.photo-params-spinner').exists()).toBe(true)
    expect(wrapper.find('.photo-params-loading').text()).toContain('正在解密照片参数…')
    expect(wrapper.find('.photo-params-loading').text()).not.toContain('70%')
    expect(wrapper.findAll('.photo-params-stage')).toHaveLength(0)
    expect(wrapper.find('.photo-params-progress').exists()).toBe(false)
    wrapper.unmount()
  })
})


it('locks scrolling, cycles focus, closes with Escape and returns focus to its trigger', async () => {
  const { nextTick } = await import('vue')
  const trigger = document.createElement('button'); document.body.append(trigger); trigger.focus()
  document.body.style.overflow = 'scroll'
  const wrapper = mount(PhotoParamsDialog, { attachTo: document.body, props: {
    visible: false, photo: null, uidRequired: true, progress: { stage: 'error', percent: 100, message: '' }, result: null, error: 'UID', messages
  } })
  await wrapper.setProps({ visible: true }); await nextTick()
  const panel = document.querySelector<HTMLElement>('.photo-params-dialog')!
  expect(document.activeElement).toBe(panel)
  expect(document.body.style.overflow).toBe('hidden')
  const buttons = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled),input')]
  for (const element of buttons) Object.defineProperty(element, 'getClientRects', { value: () => [{}] })
  buttons.at(-1)!.focus()
  buttons.at(-1)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  expect(document.activeElement).toBe(buttons[0])
  buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  expect(wrapper.emitted('close')).toHaveLength(1)
  await wrapper.setProps({ visible: false }); await nextTick()
  expect(document.activeElement).toBe(trigger)
  expect(document.body.style.overflow).toBe('scroll')
  wrapper.unmount(); trigger.remove(); document.body.style.overflow = ''
})
