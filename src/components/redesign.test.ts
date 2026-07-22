import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { messages } from '../i18n'
import type { DateGroup, PhotoItem, YearGroup } from '../utils/dateGrouping'
import DateSidebar from './DateSidebar.vue'
import PhotoGrid from './PhotoGrid.vue'
import SelectionBar from './SelectionBar.vue'
import TopBar from './TopBar.vue'

/** 创建组件测试需要的最小照片。参数：fileSizeText 为已读取或未读取的大小文本。 */
function createPhoto(fileSizeText = '--'): PhotoItem {
  return {
    id: 'photo-1',
    name: '2026_07_04_10_07_00.jpeg',
    url: null,
    fileSizeText,
    fileHandle: {} as FileSystemFileHandle,
    directoryHandle: {} as FileSystemDirectoryHandle,
    dateKey: '2026-07-04',
    year: '2026',
    monthDay: '7月4日',
    displayDate: '2026年7月4日',
    timeText: '10:07',
    timestamp: 1
  }
}

describe('redesigned album controls', () => {
  it('keeps top menus mutually exclusive and opens help from More', async () => {
    const wrapper = mount(TopBar, {
      props: {
        directoryName: 'NikkiPhotos_HighQuality',
        isLoading: false,
        isRefreshing: false,
        isDeleting: false,
        isCleaningRelatedPhotos: false,
        hasAlbumDirectory: true,
        thumbnailMode: 'default',
        thumbnailModeOptions: [{ value: 'default', label: '默认 1:1' }],
        themeMode: 'light',
        language: 'zh',
        messages: messages.zh.topBar
      },
      global: { stubs: { Teleport: true } }
    })

    await wrapper.get(`[aria-label="${messages.zh.topBar.albumMenuAria}"]`).trigger('click')
    expect(wrapper.findAll('.header-dropdown')).toHaveLength(1)
    expect(wrapper.text()).toContain(messages.zh.topBar.cleanRelatedPhotos)

    await wrapper.get(`[aria-label="${messages.zh.topBar.viewMenuAria}"]`).trigger('click')
    expect(wrapper.findAll('.header-dropdown')).toHaveLength(1)
    expect(wrapper.text()).toContain(messages.zh.topBar.thumbnail)

    await wrapper.get(`[aria-label="${messages.zh.topBar.moreMenuAria}"]`).trigger('click')
    expect(wrapper.get('.xiaohongshu-link').attributes('href')).toBe('https://xhslink.com/m/3IEU0XhZ6e')
    expect(wrapper.get('.douyin-link').attributes('href')).toBe('https://v.douyin.com/VdLd5oOXz8I/')
    await wrapper.findAll('.header-dropdown button').find((button) => button.text() === messages.zh.topBar.help)?.trigger('click')
    expect(wrapper.find('.help-dialog').exists()).toBe(true)
    expect(wrapper.text()).toContain(messages.zh.topBar.helpSafetyText)
    expect(wrapper.get('.header-star-hint').text()).toBe(messages.zh.topBar.starHint)
    expect(wrapper.find('.header-star-hint[href]').exists()).toBe(false)
    expect(wrapper.get(`[aria-label="${messages.zh.topBar.refreshAlbum}"]`).text()).toContain(messages.zh.topBar.refreshAlbum)
    expect(wrapper.get(`[aria-label="${messages.zh.topBar.moreMenuAria}"]`).text()).toContain(messages.zh.topBar.more)
  })

  it('expands only the newest year and newest month by default', () => {
    const date = (dateKey: string): DateGroup => ({
      dateKey,
      year: dateKey.slice(0, 4),
      monthDay: dateKey,
      displayDate: dateKey,
      photos: [createPhoto()]
    })
    const groups: YearGroup[] = [
      {
        year: '2026',
        photoCount: 2,
        months: [
          { monthKey: '2026-07', month: '07', photoCount: 1, dates: [date('2026-07-04')] },
          { monthKey: '2026-06', month: '06', photoCount: 1, dates: [date('2026-06-02')] }
        ]
      },
      { year: '2025', photoCount: 1, months: [{ monthKey: '2025-12', month: '12', photoCount: 1, dates: [date('2025-12-01')] }] }
    ]

    const wrapper = mount(DateSidebar, { props: { yearGroups: groups, language: 'zh', messages: messages.zh.sidebar } })
    expect(wrapper.findAll('.timeline-months')).toHaveLength(1)
    expect(wrapper.findAll('.timeline-dates')).toHaveLength(1)
    expect(wrapper.text()).toContain('2026-07-04')
    expect(wrapper.text()).not.toContain('2025-12-01')
  })

  it('shows the dynamic bottom actions only with a selection', async () => {
    const wrapper = mount(SelectionBar, {
      props: {
        mode: 'trash',
        selectedCount: 0,
        allSelected: false,
        allItemsSelected: false,
        isBusy: false,
        messages: messages.zh.selectionBar
      }
    })
    expect(wrapper.find('.selection-bar').exists()).toBe(false)
    await wrapper.setProps({ selectedCount: 2, allSelected: true, allItemsSelected: true })
    expect(wrapper.text()).toContain('已选择 2 张')
    expect(wrapper.text()).toContain('永久清空全部')
  })

  it('shows and emits remove favorite in the favorites selection mode', async () => {
    const wrapper = mount(SelectionBar, {
      props: {
        mode: 'favorites',
        selectedCount: 2,
        allSelected: false,
        allItemsSelected: false,
        isBusy: false,
        messages: messages.zh.selectionBar
      }
    })

    expect(wrapper.text()).toContain('取消收藏')
    expect(wrapper.text()).not.toContain('永久删除')
    await wrapper.findAll('button').find((button) => button.text().includes('取消收藏'))?.trigger('click')
    expect(wrapper.emitted('unfavorite')).toHaveLength(1)
  })

  it('omits the unknown size from photo metadata while keeping the capture time', () => {
    const photo = createPhoto()
    const wrapper = mount(PhotoGrid, {
      props: {
        dateGroups: [{ dateKey: photo.dateKey, year: photo.year, monthDay: photo.monthDay, displayDate: photo.displayDate, photos: [photo] }],
        selectedIds: new Set<string>(),
        favoriteIds: new Set<string>(),
        thumbnailMode: 'default',
        isFavoritesView: false,
        messages: messages.zh.grid
      },
      global: { stubs: { LazyPhotoImage: true } }
    })
    expect(wrapper.get('.photo-overlay').text()).toBe('10:07')
    expect(wrapper.get('.photo-overlay').text()).not.toContain('--')
  })

  it('shows only time in half mode and releases focus after toggling favorite', async () => {
    const photo = createPhoto('1.2 MB')
    const wrapper = mount(PhotoGrid, {
      attachTo: document.body,
      props: {
        dateGroups: [{ dateKey: photo.dateKey, year: photo.year, monthDay: photo.monthDay, displayDate: photo.displayDate, photos: [photo] }],
        selectedIds: new Set<string>(),
        favoriteIds: new Set<string>([photo.id]),
        thumbnailMode: 'half',
        isFavoritesView: false,
        messages: messages.zh.grid
      },
      global: { stubs: { LazyPhotoImage: true } }
    })

    expect(wrapper.get('.photo-overlay').text()).toBe('10:07')
    await wrapper.setProps({ thumbnailMode: 'default' })
    expect(wrapper.get('.photo-overlay').text()).toBe('10:07 · 1.2 MB')

    const favoriteButton = wrapper.get<HTMLButtonElement>('.favorite-heart')
    favoriteButton.element.focus()
    expect(document.activeElement).toBe(favoriteButton.element)
    await favoriteButton.trigger('click')
    expect(document.activeElement).not.toBe(favoriteButton.element)
    expect(wrapper.emitted('toggleFavorite')).toEqual([[photo.id]])
    wrapper.unmount()
  })
})
