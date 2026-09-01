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
    messages: messages.zh.topBar,
    fortuneMessages: messages.zh.fortuneTime
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
      '.album-name-button',
      '.view-menu-button',
      '.refresh-album-button',
      '.cleanup-button',
      '.fortune-time-trigger',
      '.more-menu-button'
    ]
    const orderedActions = Array.from(actions.element.querySelectorAll(selectors.join(', ')))

    expect(orderedActions.map((element) => selectors.find((selector) => element.matches(selector)))).toEqual(selectors)
  })
})

