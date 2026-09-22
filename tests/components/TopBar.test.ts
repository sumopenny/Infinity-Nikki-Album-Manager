import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { messages } from '../../src/i18n'
import TopBar from '../../src/components/TopBar.vue'

describe('TopBar', () => {
  const baseProps = {
    directoryName: 'NikkiPhotos_HighQuality',
    isLoading: false,
    isRefreshing: false,
    isDeleting: false,
    hasAlbumDirectory: true,
    thumbnailMode: 'default' as const,
    thumbnailModeOptions: [{ value: 'default' as const, label: '默认 1:1' }],
    themeMode: 'light' as const,
    language: 'zh' as const,
    messages: messages.zh.topBar
  }

  function mountTopBar(hasX6GameAuthorization: boolean) {
    return mount(TopBar, {
      props: { ...baseProps, hasX6GameAuthorization },
      global: { stubs: { FortuneTimeDialog: true, Teleport: true } }
    })
  }

  it('shows the authorization label based on X6Game state', async () => {
    const wrapper = mountTopBar(false)
    await wrapper.get('.album-name-button').trigger('click')
    expect(wrapper.get('.header-dropdown').text()).toContain(messages.zh.topBar.authorizeX6Game)
    wrapper.unmount()

    const reauthorized = mountTopBar(true)
    await reauthorized.get('.album-name-button').trigger('click')
    expect(reauthorized.get('.header-dropdown').text()).toContain(messages.zh.topBar.reauthorizeX6Game)
    reauthorized.unmount()
  })

  it('renders the primary actions in the requested order', () => {
    const wrapper = mount(TopBar, {
      props: {
        ...baseProps,
        hasX6GameAuthorization: false
      },
      global: {
        stubs: {
          FortuneTimeDialog: true,
          Teleport: true
        }
      }
    })

    const actions = wrapper.get('.header-actions')
    const selectors = [
      '.header-search',
      '.refresh-album-button',
      '.album-name-button',
      '.view-menu-button',
      '.tools-menu-button',
      '.more-menu-button'
    ]
    const orderedActions = Array.from(actions.element.querySelectorAll(selectors.join(', ')))

    expect(orderedActions.map((element) => selectors.find((selector) => element.matches(selector)))).toEqual(selectors)
  })

  it('rotates header menu chevrons from left to down when opened', async () => {
    const wrapper = mountTopBar(false)
    expect(wrapper.get('.album-name-button .header-menu-chevron').classes()).not.toContain('is-open')
    expect(wrapper.get('.tools-menu-button .header-menu-chevron').classes()).not.toContain('is-open')
    expect(wrapper.get('.view-menu-button .header-menu-chevron').classes()).not.toContain('is-open')
    expect(wrapper.get('.more-menu-button .header-menu-chevron').classes()).not.toContain('is-open')

    await wrapper.get('.album-name-button').trigger('click')
    expect(wrapper.get('.album-name-button .header-menu-chevron').classes()).toContain('is-open')

    await wrapper.get('.tools-menu-button').trigger('click')
    expect(wrapper.get('.album-name-button .header-menu-chevron').classes()).not.toContain('is-open')
    expect(wrapper.get('.tools-menu-button .header-menu-chevron').classes()).toContain('is-open')
    expect(wrapper.get('.view-menu-button .header-menu-chevron').classes()).not.toContain('is-open')

    await wrapper.get('.view-menu-button').trigger('click')
    expect(wrapper.get('.tools-menu-button .header-menu-chevron').classes()).not.toContain('is-open')
    expect(wrapper.get('.view-menu-button .header-menu-chevron').classes()).toContain('is-open')
    await wrapper.get('.more-menu-button').trigger('click')
    expect(wrapper.get('.view-menu-button .header-menu-chevron').classes()).not.toContain('is-open')
    expect(wrapper.get('.more-menu-button .header-menu-chevron').classes()).toContain('is-open')
    wrapper.unmount()
  })

  it('groups cleanup, fortune time, and parsers under the tools menu', async () => {
    const wrapper = mountTopBar(false)
    await wrapper.get('.tools-menu-button').trigger('click')
    const menu = wrapper.get('.header-dropdown')
    expect(menu.text()).toContain(messages.zh.topBar.specialCleanup)
    expect(menu.text()).toContain(messages.zh.topBar.fortuneTime)
    expect(menu.text()).toContain(messages.zh.topBar.parseTools)
    expect(wrapper.find('.cleanup-button').exists()).toBe(false)
    expect(wrapper.find('.fortune-time-trigger').exists()).toBe(false)

    await menu.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('openCleanup')).toHaveLength(1)
    await wrapper.get('.tools-menu-button').trigger('click')
    await wrapper.get('.header-dropdown').findAll('button')[1].trigger('click')
    expect(wrapper.emitted('openFortuneTime')).toHaveLength(1)
    await wrapper.get('.tools-menu-button').trigger('click')
    await wrapper.get('.header-dropdown').findAll('button')[2].trigger('click')
    expect(wrapper.emitted('openParseTools')).toHaveLength(1)
    wrapper.unmount()
  })

  it('removes the parameter parser from the album menu', async () => {
    const wrapper = mountTopBar(false)
    await wrapper.get('.album-name-button').trigger('click')
    expect(wrapper.get('.header-dropdown').text()).not.toContain(messages.zh.topBar.parseTools)
    wrapper.unmount()
  })
})

