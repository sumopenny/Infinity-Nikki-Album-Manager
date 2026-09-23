import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import UpdateLogDialog from '../../src/components/UpdateLogDialog.vue'
import { messages } from '../../src/i18n'

describe('UpdateLogDialog', () => {
  it('shows current release bullets followed by history', () => {
    const wrapper = mount(UpdateLogDialog, { props: { visible: true, dismissed: false, messages: messages.zh.updateLog }, global: { stubs: { Teleport: true } } })
    expect(wrapper.find('.update-log-current').classes()).toContain('is-current')
    expect(wrapper.findAll('.update-log-current li')).toHaveLength(messages.zh.updateLog.currentItems.length)
    expect(wrapper.find('.update-log-history').text()).toContain('v1.4.1')
    expect(wrapper.find('.help-about-intro').exists()).toBe(false)
  })

  it('emits dismissal state when closed', async () => {
    const wrapper = mount(UpdateLogDialog, { props: { visible: true, dismissed: false, messages: messages.zh.updateLog }, global: { stubs: { Teleport: true } } })
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('.update-log-close-button').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[true]])
  })
})
