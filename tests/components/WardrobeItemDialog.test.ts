import { mount } from '@vue/test-utils'
import { expect, it } from 'vitest'
import WardrobeItemDialog from '../../src/components/WardrobeItemDialog.vue'
import type { WardrobeEntry } from '../../src/utils/wardrobe/wardrobeCatalog'

it('衣橱详情在加载、失败、重试和切换部件时保留展示框', async () => {
  const item: WardrobeEntry = {
    id: '1020100001',
    kind: 'item',
    name: { zh: '测试发型', en: 'Test hair' },
    quality: 5,
    variant: 0,
    category: 10,
    familyRootId: null,
    style: null,
    labels: [],
    obtainType: null,
    version: null,
    sourceDetails: [],
    parts: [],
    image: 'https://example.test/items/icons/1020100001.png'
  }
  const wrapper = mount(WardrobeItemDialog, {
    props: { item, outfits: [], language: 'zh' },
    global: { stubs: { Teleport: true, Transition: true } }
  })
  try {
    const frame = wrapper.get('.outfit-detail-image-frame').element
    expect(wrapper.get('.outfit-detail-image-frame').attributes('aria-busy')).toBe('true')
    await wrapper.get('img').trigger('error')
    expect(wrapper.get('.outfit-detail-image-frame').element).toBe(frame)
    expect(wrapper.get('img').attributes('data-image-failed')).toBe('true')
    await wrapper.get('img').trigger('click')
    expect(wrapper.get('.outfit-detail-image-frame').attributes('aria-busy')).toBe('true')
    await wrapper.get('img').trigger('load')
    expect(wrapper.get('.outfit-detail-image-frame').element).toBe(frame)
    expect(wrapper.find('.outfit-detail-image-placeholder').exists()).toBe(false)
    await wrapper.setProps({
      item: { ...item, id: '1020100002', image: 'https://example.test/items/icons/1020100002.png' }
    })
    expect(wrapper.get('.outfit-detail-image-frame').attributes('aria-busy')).toBe('true')
    expect(wrapper.get('img').attributes('src')).toContain('/items/1020100002.png')
  } finally {
    wrapper.unmount()
  }
})
