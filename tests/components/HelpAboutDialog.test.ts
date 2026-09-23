import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import HelpAboutDialog from '../../src/components/HelpAboutDialog.vue'
import { messages } from '../../src/i18n'

describe('HelpAboutDialog', () => {
  it('renders introduction, features, tutorials, and notes', () => {
    const wrapper = mount(HelpAboutDialog, { props: { visible: true, messages: messages.zh.helpAbout }, global: { stubs: { Teleport: true } } })
    expect(wrapper.text()).toContain('网站介绍')
    expect(wrapper.text()).toContain('特色功能')
    expect(wrapper.text()).toContain('使用教程')
    expect(wrapper.text()).toContain('注意事项')
    expect(wrapper.find('.update-log-current').exists()).toBe(false)
  })

  it('closes from the header button', async () => {
    const wrapper = mount(HelpAboutDialog, { props: { visible: true, messages: messages.zh.helpAbout }, global: { stubs: { Teleport: true } } })
    await wrapper.get('.help-about-header button').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })
})
