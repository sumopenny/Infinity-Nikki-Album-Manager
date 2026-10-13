import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { messages } from '../../src/i18n'
import AlbumViewSwitcher from '../../src/components/AlbumViewSwitcher.vue'
import TopBar from '../../src/components/TopBar.vue'
import AdaptiveFilterPanel from '../../src/components/AdaptiveFilterPanel.vue'
import CollectionFilterBar from '../../src/components/CollectionFilterBar.vue'
import OutfitSidebar from '../../src/components/OutfitSidebar.vue'
import SelectionBar from '../../src/components/SelectionBar.vue'

const wrappers: { unmount: () => void }[] = []
beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })))
})
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('mobile navigation and collection controls', () => {
  it('navigates to resonance once even after a compatibility hover event', async () => {
    const wrapper = mount(AlbumViewSwitcher, { props: { activeView: 'outfits', allCount: 0, outfitsCount: 0,
      homeSchemesCount: 0, favoriteCount: 0, trashCount: 0, outfitLabel: '搭配码', disabled: false, messages: messages.zh.viewNav } })
    wrappers.push(wrapper)
    const entry = wrapper.findAll('.album-view-item')[3]!
    await entry.trigger('pointerenter', { pointerType: 'touch' })
    await entry.trigger('mouseenter')
    await entry.get('button').trigger('click')
    expect(wrapper.emitted('changeView')).toEqual([['resonance']])
    expect(wrapper.find('.resonance-nav-menu').exists()).toBe(false)
  })

  it('opens More from the mobile header and omits unsupported album actions', async () => {
    const wrapper = mount(TopBar, { attachTo: document.body, props: { directoryName: '', isLoading: false,
      isDeleting: false, hasAlbumDirectory: false, hasX6GameAuthorization: false, thumbnailMode: 'default',
      thumbnailModeOptions: [], themeMode: 'light', language: 'zh', messages: messages.zh.topBar,
      viewMessages: messages.zh.viewNav, directorySupported: false } })
    wrappers.push(wrapper)
    await wrapper.get('.mobile-header-row button[aria-label="打开更多菜单"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('.mobile-header-row button').map(button => button.attributes('aria-label'))).toEqual(['搜索当前页面', messages.zh.topBar.viewMenuAria, messages.zh.topBar.moreMenuAria])
    expect(wrapper.get('.mobile-header-row button').find('svg.lucide-search').exists()).toBe(true)
    const sheet = document.querySelector('.mobile-menu-sheet')!
    expect(sheet).not.toBeNull()
    expect(sheet.textContent).toContain(messages.zh.topBar.importAllData)
    expect(sheet.textContent).not.toContain('显示、主题与语言')
    expect([...sheet.querySelectorAll('button')].some(button => button.textContent === messages.zh.viewNav.allPhotos)).toBe(false)
    expect(document.body.style.overflow).toBe('hidden')
    wrapper.vm.closeMenus()
    await flushPromises()
    expect(document.querySelector('.mobile-menu-sheet')).toBeNull()
    expect(document.body.style.overflow).not.toBe('hidden')
    await wrapper.get('.mobile-header-row button[aria-label="打开视图菜单"]').trigger('click')
    await flushPromises()
    expect(document.querySelector('.view-dropdown')).not.toBeNull()
    expect(wrapper.get('.mobile-header-row button[aria-label="打开更多菜单"]').attributes('aria-expanded')).toBe('false')
    expect(document.querySelector('.view-dropdown')!.textContent).toContain(messages.zh.topBar.thumbnail)
  })

  it('keeps the full filter slot mounted when switching between the desktop and mobile presentations', async () => {
    const wrapper = mount(AdaptiveFilterPanel, { attachTo: document.body, props: { compact: false, open: false,
      title: '筛选', closeLabel: '关闭', applyLabel: '查看结果' }, slots: { default: '<input value="保留输入" data-filter-input />' } })
    wrappers.push(wrapper)
    const input = document.querySelector('[data-filter-input]')
    await wrapper.setProps({ compact: true, open: true })
    expect(document.querySelector('[data-filter-input]')).toBe(input)
    expect(document.querySelector('[role="dialog"]')).not.toBeNull()
    await wrapper.getComponent(AdaptiveFilterPanel).vm.$nextTick()
    document.querySelector<HTMLButtonElement>('.mobile-filter-panel > footer button')!.click()
    expect(wrapper.emitted('close')).toHaveLength(1)
    await wrapper.setProps({ open: false })
    expect(document.querySelector('[data-filter-input]')).toBe(input)
  })

  it('limits forty quick categories while keeping a selected distant tag visible', async () => {
    const wrapper = mount(CollectionFilterBar, { props: { entries: Array.from({ length: 40 }, (_, i) => ({ key: String(i), label: `标签${i}` })), active: '39', count: 2, language: 'zh' } })
    wrappers.push(wrapper)
    expect(wrapper.findAll('.collection-filter-chips button')).toHaveLength(4)
    expect(wrapper.get('[aria-pressed="true"]').text()).toBe('标签39')
    await wrapper.get('.collection-filter-summary button').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
    await wrapper.get('.collection-filter-open').trigger('click')
    expect(wrapper.emitted('open')).toHaveLength(1)
  })

  it('separates tag management from filtering and supports ordering without drag', async () => {
    const wrapper = mount(OutfitSidebar, { props: { outfits: [], tags: ['甜美', '帅气'], activeFilter: 'all', disabled: false, messages: messages.zh.outfit } })
    wrappers.push(wrapper)
    expect(wrapper.find('.outfit-delete-tag').exists()).toBe(false)
    await wrapper.get('.tag-manage-toggle').trigger('click')
    await wrapper.get('[aria-label="下移标签: 甜美"]').trigger('click')
    expect(wrapper.emitted('reorderTags')).toEqual([[['帅气', '甜美']]])
    expect(wrapper.get('[aria-label="上移标签: 帅气"]').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ disabled: true })
    expect(wrapper.get('[aria-label="下移标签: 帅气"]').attributes('disabled')).toBeDefined()
  })

  it('offers batch actions directly and keeps busy and selection behavior', async () => {
    const wrapper = mount(SelectionBar, { props: { mode: 'album', selectedCount: 2, allSelected: false,
      allItemsSelected: false, allSelectedFavorited: false, isBusy: false, messages: messages.zh.selectionBar } })
    wrappers.push(wrapper)
    expect(wrapper.find('.selection-more').exists()).toBe(false)
    const buttons = wrapper.findAll('button')
    for (const [label, event] of [
      [messages.zh.selectionBar.selectAll, 'toggleAll'],
      [messages.zh.selectionBar.exportPhotos, 'export'],
      [messages.zh.selectionBar.deleteRelated, 'deleteRelated'],
    ]) {
      await buttons.find(button => button.text() === label)!.trigger('click')
      expect(wrapper.emitted(event)).toHaveLength(1)
    }
    await wrapper.setProps({ isBusy: true })
    expect(wrapper.findAll('button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    await wrapper.setProps({ selectedCount: 0 })
    expect(wrapper.find('.selection-bar').exists()).toBe(false)
    await wrapper.setProps({ selectedCount: 1 })
    expect(wrapper.find('.selection-bar').exists()).toBe(true)
  })
})
