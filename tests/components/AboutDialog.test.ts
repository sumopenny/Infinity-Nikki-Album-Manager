import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import AboutDialog from '../../src/components/AboutDialog.vue'
import { messages } from '../../src/i18n'

const topBarMessages = messages.zh.topBar

function mountDialog() {
  return mount(AboutDialog, {
    props: {
      visible: true,
      dismissed: false,
      messages: messages.zh.about,
      topBarMessages
    },
    attachTo: document.body
  })
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('AboutDialog release history', () => {
  it('opens older release history and returns to about', async () => {
    const wrapper = mountDialog()

    expect(document.body.textContent).toContain('更新记录')
    const historyLink = document.body.querySelector('.about-history-link') as HTMLButtonElement
    expect(historyLink.parentElement?.classList.contains('about-history-actions')).toBe(true)
    expect(historyLink.parentElement?.nextElementSibling?.classList.contains('about-current-version-title')).toBe(true)
    expect(document.body.querySelector('.about-section-heading')).toBeNull()
    historyLink.click()
    await wrapper.vm.$nextTick()

    expect(document.body.textContent).toContain('历史版本记录')
    expect(document.body.querySelector('.about-history-list .about-changelog-entry')?.textContent).toContain('v1.3.2')
    expect(document.body.querySelector('.about-history-list')?.textContent).toContain('v1.3.1')
    expect(document.body.querySelector('.about-history-actions + .about-history-title')?.textContent).toBe('历史版本记录')
    ;(document.body.querySelector('.about-history-back') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    expect(document.body.textContent).toContain('当前版本')
    expect(document.body.querySelector('.about-history-link')).not.toBeNull()
  })

  it('closes from history with the top-right button', async () => {
    const wrapper = mountDialog()
    ;(document.body.querySelector('.about-history-link') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    ;(document.body.querySelector('.about-dialog-close') as HTMLButtonElement).click()

    expect(wrapper.emitted('close')).toEqual([[false]])
  })

  it('closes from history when Escape is pressed', async () => {
    const wrapper = mountDialog()
    ;(document.body.querySelector('.about-history-link') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    document.body.querySelector('.about-dialog')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toEqual([[false]])
  })
})

