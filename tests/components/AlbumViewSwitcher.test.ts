import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { messages } from '../../src/i18n'
import AlbumViewSwitcher from '../../src/components/AlbumViewSwitcher.vue'
import RecentlyDeletedGrid from '../../src/components/RecentlyDeletedGrid.vue'

describe('album view controls', () => {
  it('renders the four separate entries in the required order', async () => {
    const wrapper = mount(AlbumViewSwitcher, {
      props: {
        activeView: 'all',
        allCount: 12,
        outfitsCount: 4,
        favoriteCount: 3,
        trashCount: 2,
        outfitLabel: '搭配码',
        disabled: false,
        messages: messages.zh.viewNav
      }
    })

    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([
      '全部照片12 张',
      '搭配码4 张',
      '收藏夹3 张',
      '最近删除2 张'
    ])
    await wrapper.findAll('button')[3].trigger('click')
    expect(wrapper.emitted('changeView')).toEqual([['trash']])
  })

  it('keeps recently deleted cards free of names, sizes, and per-card actions', () => {
    const wrapper = mount(RecentlyDeletedGrid, {
      props: {
        photos: [],
        selectedIds: new Set<string>(),
        thumbnailMode: 'default',
        language: 'zh',
        messages: messages.zh.trash
      },
      global: { stubs: { LazyPhotoImage: true } }
    })

    expect(wrapper.text()).toContain('最近删除为空')
    expect(wrapper.findAll('.restore-button')).toHaveLength(0)
    expect(wrapper.findAll('.danger-button')).toHaveLength(0)
  })

  it('uses the exact irreversible deletion impact wording', () => {
    expect(messages.zh.trash.confirmPermanentDelete(6)).toBe('将从电脑中永久删除这 6 张照片，无法恢复。')
  })
})

