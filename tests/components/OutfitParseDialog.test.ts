import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OutfitParseDialog from '../../src/components/OutfitParseDialog.vue'
import { getOutfitMessages } from '../../src/i18n/messages/outfit'

const { parseOutfitCodeMock, loadItemCatalogMock, loadOutfitDetailMock } = vi.hoisted(() => ({
  parseOutfitCodeMock: vi.fn(),
  loadItemCatalogMock: vi.fn(),
  loadOutfitDetailMock: vi.fn()
}))

vi.mock('../../src/utils/outfit/outfitCodeParser', async () => {
  const actual = await vi.importActual<typeof import('../../src/utils/outfit/outfitCodeParser')>('../../src/utils/outfit/outfitCodeParser')
  return { ...actual, parseOutfitCode: parseOutfitCodeMock }
})

vi.mock('../../src/utils/outfit/itemCatalog', () => ({
  loadItemCatalog: loadItemCatalogMock,
  getCatalogEntryName: (entry: { zh: string; en: string }, language: 'zh' | 'en') => entry[language],
  getCatalogImageUrl: (entry: { id: number }) => `https://example.test/${entry.id}.png`
}))

vi.mock('../../src/utils/outfit/outfitDetails', () => ({
  loadOutfitDetail: loadOutfitDetailMock
}))

const detail = {
  itemId: 1020100001,
  outfitId: 1001,
  itemName: '时光讯号-发型',
  outfitName: '绽响黎明前',
  outfitImageUrl: 'https://example.test/outfit.png',
  detailImageUrl: 'https://example.test/outfit.png',
  evolution: '原套',
  dyeCondition: '进化后可染 / 焕新可染',
  dyes: [{ area: '区域 01', paletteId: 18, paletteName: '名流鸦盛宴', slot: 2, color: '#ff0000' }],
  loadError: false
}

describe('OutfitParseDialog', () => {
  it('opens item details from a focused image button and returns focus on close', async () => {
    parseOutfitCodeMock.mockResolvedValue({
      code: 'a1B2c3D4e5F#',
      wearingClothes: [{ itemId: 1020100001, clothType: 10, outfitId: 1001 }],
      dyeItems: [{ itemId: 1020100001, clothType: 10, outfitId: 1001, dyes: detail.dyes.map((dye) => ({ ...dye, targetGroupId: 1, featureTag: 1 })) }]
    })
    loadItemCatalogMock.mockResolvedValue(new Map([[1020100001, { id: 1020100001, zh: '时光讯号', en: 'Signal of Time', makeup: false }]]))
    loadOutfitDetailMock.mockResolvedValue(detail)

    const wrapper = mount(OutfitParseDialog, {
      props: { visible: false, code: 'a1B2c3D4e5F', language: 'zh', messages: getOutfitMessages('zh') },
      attachTo: document.body,
      global: { stubs: { Teleport: true, Transition: { template: '<div><slot /></div>' } } }
    })
    await wrapper.setProps({ visible: true })
    await flushPromises()

    const itemButton = wrapper.get('.outfit-parse-item-button')
    const itemImage = wrapper.get('.outfit-parse-item-icon')
    expect(itemImage.classes()).toContain('is-loading')
    await itemImage.trigger('load')
    expect(itemImage.classes()).not.toContain('is-loading')
    await itemButton.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('时光讯号(发型)')
    expect(wrapper.find('.outfit-detail-panel').exists()).toBe(true)
    const detailImage = wrapper.get('.outfit-detail-image')
    expect(detailImage.classes()).toContain('is-loading')
    await detailImage.trigger('load')
    expect(detailImage.classes()).not.toContain('is-loading')
    expect(wrapper.text()).toContain('绽响黎明前')
    expect(wrapper.findAll('.outfit-detail-table-wrap tbody tr')).toHaveLength(1)

    await wrapper.get('.outfit-detail-panel header button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.outfit-detail-panel').exists()).toBe(false)
    expect(document.activeElement).toBe(itemButton.element)
    wrapper.unmount()
  })

  it('passes the decoded special-effect flag through to item details', async () => {
    const dyes = [
      { targetGroupId: 1, featureTag: 1, paletteId: 11, slot: 1, color: '#2c646a' },
      { targetGroupId: 2, featureTag: 1, paletteId: 16, slot: 8, color: '#f7b3dc' }
    ]
    parseOutfitCodeMock.mockResolvedValue({
      code: '13Zb1zKZgf1#',
      wearingClothes: [{ itemId: 1025740294, clothType: null, outfitId: null }],
      dyeItems: [{ itemId: 1025740294, clothType: null, outfitId: null, dyes, hasSpecialEffect: true }]
    })
    loadItemCatalogMock.mockResolvedValue(new Map([[1025740294, { id: 1025740294, zh: '童话终章', en: 'Fairytale Finale', makeup: false }]]))
    loadOutfitDetailMock.mockResolvedValue({ ...detail, itemId: 1025740294, itemName: '童话终章', dyeCondition: '满进可染' })

    const wrapper = mount(OutfitParseDialog, {
      props: { visible: false, code: '13Zb1zKZgf1#', language: 'zh', messages: getOutfitMessages('zh') },
      attachTo: document.body,
      global: { stubs: { Teleport: true, Transition: { template: '<div><slot /></div>' } } }
    })
    await wrapper.setProps({ visible: true })
    await flushPromises()
    await wrapper.get('.outfit-parse-item-button').trigger('click')
    await flushPromises()

    expect(loadOutfitDetailMock).toHaveBeenCalledWith(1025740294, null, 'zh', '童话终章(颈饰)', dyes, 74, true)
    expect(wrapper.text()).toContain('童话终章(颈饰)')
    expect(wrapper.text()).toContain('满进可染')
    wrapper.unmount()
  })

  it('closes the detail layer with Escape and hides an empty dye table', async () => {
    parseOutfitCodeMock.mockResolvedValue({
      code: 'a1B2c3D4e5F#',
      wearingClothes: [{ itemId: 1020100001, clothType: 10, outfitId: null }],
      dyeItems: []
    })
    loadItemCatalogMock.mockResolvedValue(new Map([[1020100001, { id: 1020100001, zh: '时光讯号', en: 'Signal of Time', makeup: false }]]))
    loadOutfitDetailMock.mockResolvedValue({ ...detail, outfitName: '', dyes: [], outfitId: null, outfitImageUrl: null })

    const wrapper = mount(OutfitParseDialog, {
      props: { visible: false, code: 'a1B2c3D4e5F', language: 'zh', messages: getOutfitMessages('zh') },
      attachTo: document.body,
      global: { stubs: { Teleport: true, Transition: { template: '<div><slot /></div>' } } }
    })
    await wrapper.setProps({ visible: true })
    await flushPromises()
    await wrapper.get('.outfit-parse-item-button').trigger('click')
    await flushPromises()
    expect(wrapper.find('.outfit-detail-dyes').exists()).toBe(false)
    expect(wrapper.text()).toContain('无')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(wrapper.find('.outfit-detail-panel').exists()).toBe(false)
    wrapper.unmount()
  })
})
