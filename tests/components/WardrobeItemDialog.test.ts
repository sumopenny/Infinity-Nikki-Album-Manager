import { mount, DOMWrapper } from '@vue/test-utils'
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

it('switches between available item forms without claiming unknown ownership', async () => {
  const { loadWardrobeCatalog } = await import('../../src/utils/wardrobe/wardrobeCatalog')
  const catalog = await loadWardrobeCatalog()
  const original = catalog.entries.find(
    (entry) =>
      entry.kind === 'item' &&
      entry.variant === 0 &&
      catalog.entries.some(
        (other) =>
          other.kind === 'item' && other.familyRootId === entry.familyRootId && other.variant > 0
      )
  )!
  const evolved = catalog.entries.find(
    (entry) =>
      entry.kind === 'item' && entry.familyRootId === original.familyRootId && entry.variant > 0
  )!
  const wrapper = mount(WardrobeItemDialog, {
    props: { item: original, outfits: [], catalog, language: 'zh' },
    attachTo: document.body,
    global: { stubs: { Transition: true } }
  })
  try {
    const view = new DOMWrapper(document.body)
    const nav = view.get('.wardrobe-form-nav')
    expect(nav.text()).toContain('未知')
    expect(nav.text()).not.toContain('已拥有')
    const buttons = nav.findAll('button')
    const index = catalog.entries
      .filter((entry) => entry.kind === 'item' && entry.familyRootId === original.familyRootId)
      .sort((a, b) => a.variant - b.variant)
      .findIndex((entry) => entry.id === evolved.id)
    await buttons[index]!.trigger('click')
    expect(wrapper.emitted('selectForm')?.[0]).toEqual([evolved])
    const panel = view.get('.outfit-detail-panel').element
    await wrapper.setProps({ item: evolved })
    expect(view.get('.outfit-detail-panel').element).toBe(panel)
    expect(view.get('.outfit-detail-info').text()).toContain(evolved.name.zh)
    expect(view.get('.outfit-detail-image').attributes('src')).toBe(
      evolved.image.replace('/items/icons/', '/items/')
    )
  } finally {
    wrapper.unmount()
  }
})
