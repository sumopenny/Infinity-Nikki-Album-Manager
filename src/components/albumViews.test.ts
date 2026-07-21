import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { messages } from '../i18n'
import AlbumViewNav from './AlbumViewNav.vue'
import RecentlyDeletedGrid from './RecentlyDeletedGrid.vue'

describe('album view controls', () => {
  it('renders the three separate entries in the required order', async () => {
    const wrapper = mount(AlbumViewNav, {
      props: {
        activeView: 'all',
        allCount: 12,
        favoriteCount: 3,
        trashCount: 2,
        disabled: false,
        messages: messages.zh.viewNav
      }
    })

    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      '全部照片12 张',
      '收藏夹3 张',
      '最近删除2 张'
    ])
    await wrapper.findAll('button')[2].trigger('click')
    expect(wrapper.emitted('changeView')).toEqual([['trash']])
  })

  it('shows total size and exposes the empty recently deleted actions safely', () => {
    const wrapper = mount(RecentlyDeletedGrid, {
      props: {
        photos: [],
        selectedIds: new Set<string>(),
        allSelected: false,
        totalSizeText: '0 B',
        thumbnailMode: 'default',
        isBusy: false,
        language: 'zh',
        messages: messages.zh.trash
      },
      global: { stubs: { LazyPhotoImage: true } }
    })

    expect(wrapper.text()).toContain('共 0 张照片，合计 0 B')
    expect(wrapper.text()).toContain('最近删除为空')
    expect(wrapper.findAll('button').every((button) => button.attributes('disabled') !== undefined)).toBe(true)
  })

  it('uses the exact irreversible deletion impact wording', () => {
    expect(messages.zh.trash.confirmPermanentDelete(6)).toBe('将从电脑中永久删除这 6 张照片，无法恢复。')
  })
})
