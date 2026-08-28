import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { messages } from '../i18n'
import TopBar from './TopBar.vue'

describe('TopBar', () => {
  it('renders the primary actions in the requested order', () => {
    const wrapper = mount(TopBar, {
      props: {
        directoryName: 'NikkiPhotos_HighQuality',
        isLoading: false,
        isRefreshing: false,
        isDeleting: false,
        hasAlbumDirectory: true,
        thumbnailMode: 'default',
        thumbnailModeOptions: [{ value: 'default', label: '默认 1:1' }],
        themeMode: 'light',
        language: 'zh',
        messages: messages.zh.topBar,
        fortuneMessages: messages.zh.fortuneTime
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
