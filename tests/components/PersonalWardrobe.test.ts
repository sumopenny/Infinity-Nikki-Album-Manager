import 'fake-indexeddb/auto'
import { mount, flushPromises, DOMWrapper, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PersonalWardrobe from '../../src/components/PersonalWardrobe.vue'
import { clearAllBrowserData, runStoreRequest } from '../../src/utils/file-system/database'
import { messages } from '../../src/i18n'
import { loadWardrobe } from '../../src/utils/wardrobe/wardrobeStorage'
import * as storage from '../../src/utils/wardrobe/wardrobeStorage'
import * as pearpal from '../../src/utils/resonance/resonanceImport'

let wrapper: VueWrapper
const button = (label: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('button')].find(
    (node) => node.textContent?.trim() === label
  )!
beforeEach(async () => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  }))
  await clearAllBrowserData()
  wrapper = mount(PersonalWardrobe, { attachTo: document.body })
  await vi.waitFor(() => expect(wrapper.find('.wardrobe-grid').exists()).toBe(true))
})
afterEach(() => {
  wrapper.unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

describe('personal wardrobe interactions', () => {
  it('resets every filter and top-bar search when switching categories in either direction', async () => {
    const choose = async (key: string, label: string) => {
      await wrapper.get('#wardrobe-filter-' + key).trigger('click')
      await [...document.querySelectorAll('[role="menuitemradio"]')]
        .map((node) => new DOMWrapper(node))
        .find((node) => node.text() === label)!
        .trigger('click')
    }
    for (const target of ['单品', '套装']) {
      await wrapper.setProps({ searchQuery: '花' })
      await choose('ownership', '已拥有')
      await choose('rarity', '5 ★')
      await choose('variant', '焕新')
      await choose('sort', '名称')
      if (target === '套装') await choose('category', '发型')
      button(target).click()
      await flushPromises()
      for (const key of ['ownership', 'rarity', 'variant'])
        expect(wrapper.get('#wardrobe-filter-' + key).text()).toBe('全部')
      expect(wrapper.get('#wardrobe-filter-sort').text()).toBe('图鉴顺序')
      if (target === '单品') expect(wrapper.get('#wardrobe-filter-category').text()).toBe('全部')
      expect(wrapper.emitted('update-search')?.at(-1)).toEqual([''])
      await wrapper.setProps({ searchQuery: '' })
      expect(wrapper.findAll('.wardrobe-card').length).toBeGreaterThan(0)
    }
  })
  it('uses the shared menu styling and applies a variant before closing the menu', async () => {
    expect(wrapper.find('select').exists()).toBe(false)
    await wrapper.get('#wardrobe-filter-variant').trigger('click')
    expect(new DOMWrapper(document.querySelector('[role="menu"]')!).classes()).toContain(
      'cleanup-account-menu'
    )
    const option = [...document.querySelectorAll('[role="menuitemradio"]')]
      .map((node) => new DOMWrapper(node))
      .find((node) => node.text() === '焕新')!
    await option.trigger('click')
    expect(!!document.querySelector('[role="menu"]')).toBe(false)
    expect(wrapper.get('#wardrobe-filter-variant').text()).toBe('焕新')
    expect(wrapper.findAll('.wardrobe-variant').every((node) => node.text() === '焕新')).toBe(true)
    await wrapper.get('#wardrobe-filter-variant').trigger('click')
    await wrapper.get('#wardrobe-filter-variant').trigger('keydown', { key: 'Escape' })
    expect(!!document.querySelector('[role="menu"]')).toBe(false)
  })
  it('uses the supplied top-bar query and places desktop filters in the sidebar', async () => {
    const host = document.createElement('aside')
    host.id = 'wardrobe-test-sidebar'
    document.body.append(host)
    await wrapper.setProps({
      sidebarTarget: '#wardrobe-test-sidebar',
      searchQuery: '如果爱上一朵花'
    })
    expect(host.querySelector('.sidebar-mode-switch')).not.toBeNull()
    expect(host.querySelector('.wardrobe-filters')).not.toBeNull()
    expect(wrapper.find('input[type="search"]').exists()).toBe(false)
    expect(wrapper.findAll('.wardrobe-card').length).toBeGreaterThan(0)
    expect(
      wrapper.findAll('.wardrobe-card h3').every((node) => node.text().includes('如果爱上一朵花'))
    ).toBe(true)
    await wrapper.setProps({ searchQuery: 'no-such-clothing-xyz' })
    expect(wrapper.find('.wardrobe-empty').exists()).toBe(true)
    await wrapper.find('.wardrobe-empty button').trigger('click')
    expect(wrapper.emitted('update-search')?.at(-1)).toEqual([''])
    await wrapper.setProps({ searchQuery: '' })
    expect(wrapper.find('.wardrobe-grid').exists()).toBe(true)
  })
  it('mounts mobile actions after the asynchronous wardrobe toolbar becomes available', async () => {
    wrapper.unmount()
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {}
    }))
    wrapper = mount(PersonalWardrobe, { attachTo: document.body })
    await vi.waitFor(() =>
      expect(
        document.querySelector('#wardrobe-filter-actions [aria-label="添加数据"]')
      ).not.toBeNull()
    )
    document
      .querySelector<HTMLButtonElement>('#wardrobe-filter-actions [aria-label="添加数据"]')!
      .click()
    await flushPromises()
    expect(document.querySelector('.resonance-import-dialog')).not.toBeNull()
  })
  it('uses the shared file picker but only previews after the preview action', async () => {
    button('添加数据').click()
    await flushPromises()
    button(messages.zh.resonance.fromFile).click()
    await flushPromises()
    const file = {
      name: 'wardrobe.json',
      size: 100,
      text: vi.fn().mockResolvedValue(
        storage.createWardrobeBackup({
          ...storage.emptyWardrobe(),
          entries: { '1020100347': { owned: true, source: 'manual' } }
        })
      )
    }
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { value: [file], configurable: true })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    expect(file.text).toHaveBeenCalledOnce()
    expect(document.querySelector('.resonance-file-name')?.textContent).toContain('wardrobe.json')
    expect(document.querySelector('.resonance-preview')).toBeNull()
    button('获取预览').click()
    await vi.waitFor(() => expect(document.querySelector('.resonance-preview')).not.toBeNull())
    expect(Object.keys((await loadWardrobe()).entries)).toHaveLength(0)
  })
  it('cancels clearing without loss and confirms clearing only wardrobe data', async () => {
    await runStoreRequest('resonance-records', 'readwrite', (store) =>
      store.put([{ id: 'resonance-sentinel' }], 'current-profile')
    )
    await storage.updateWardrobe(() => ({
      ...storage.emptyWardrobe(),
      entries: { '1020100347': { owned: true, source: 'pearpal' } }
    }))
    await (wrapper.vm as unknown as { reload: () => Promise<void> }).reload()
    await flushPromises()
    button('清空记录').click()
    await vi.waitFor(() => expect(document.querySelector('.confirm-dialog')).not.toBeNull())
    button(messages.zh.resonance.clearCancel).click()
    await flushPromises()
    expect(Object.keys((await loadWardrobe()).entries)).toHaveLength(1)
    button('清空记录').click()
    await vi.waitFor(() => expect(document.querySelector('.confirm-dialog')).not.toBeNull())
    document.querySelector<HTMLButtonElement>('.confirm-dialog-actions .primary')!.click()
    await vi.waitFor(() => expect(document.querySelector('.confirm-dialog')).toBeNull())
    expect(Object.keys((await loadWardrobe()).entries)).toHaveLength(0)
    expect(
      await runStoreRequest('resonance-records', 'readonly', (store) =>
        store.get('current-profile')
      )
    ).toEqual([{ id: 'resonance-sentinel' }])
  })
  it('shows read-only outfit and piece details without changing imported ownership', async () => {
    await storage.updateWardrobe(() => ({
      ...storage.emptyWardrobe(),
      entries: { '1020100347': { owned: true, source: 'pearpal' } }
    }))
    await (wrapper.vm as unknown as { reload: () => Promise<void> }).reload()
    await flushPromises()
    const saved = await loadWardrobe()
    const write = vi.spyOn(storage, 'updateWardrobe')
    expect(wrapper.text()).not.toMatch(/批量管理|记录来源|手动记录/)
    for (const kind of ['套装', '单品']) {
      button(kind).click()
      await flushPromises()
      await wrapper.find('.wardrobe-card-open').trigger('click')
      const dialog = document.querySelector('[role="dialog"]')!
      expect(dialog.querySelectorAll('button')).toHaveLength(1)
      expect(dialog.querySelector('button')?.getAttribute('aria-label')).toBe('关闭')
      const part = dialog.querySelector<HTMLElement>('.wardrobe-part')!
      expect(part.tagName).toBe('DIV')
      part.click()
      await flushPromises()
      expect(write).not.toHaveBeenCalled()
      expect(await loadWardrobe()).toEqual(saved)
      dialog.querySelector<HTMLButtonElement>('button')!.click()
      await flushPromises()
    }
  })
  it('requires preview confirmation before replacing manual ownership', async () => {
    await storage.updateWardrobe((latest) => {
      latest.entries['1020100399'] = { owned: true, source: 'manual' }
      return latest
    })
    vi.spyOn(pearpal, 'fetchPearpalSnapshot').mockResolvedValue({
      info_from_self: { suit_list: ['10347'] }
    })
    button('添加数据').click()
    await flushPromises()
    const auth = document.querySelector<HTMLTextAreaElement>('textarea')!
    auth.value = '{"roleid":"1","token":"test","id":"1"}'
    auth.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    button('获取预览').click()
    await vi.waitFor(() => expect(document.querySelector('.resonance-preview')).not.toBeNull())
    expect((await loadWardrobe()).entries['1020100399']?.source).toBe('manual')
    expect(document.querySelector('.data-import-warning')?.textContent).toContain(
      '整份覆盖勾选的记录'
    )
    button('确认导入').click()
    await vi.waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull())
    const saved = await loadWardrobe()
    expect(saved.entries['1020100399']).toBeUndefined()
    expect(Object.keys(saved.entries)).toHaveLength(10)
    expect(JSON.stringify(saved)).not.toContain('token')
  })
  it('discards a late notebook response after closing the dialog', async () => {
    let finish!: (data: unknown) => void
    vi.spyOn(pearpal, 'fetchPearpalSnapshot').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    button('添加数据').click()
    await flushPromises()
    const auth = document.querySelector<HTMLTextAreaElement>('textarea')!
    auth.value = '{"roleid":"1","token":"test","id":"1"}'
    auth.dispatchEvent(new Event('input', { bubbles: true }))
    await flushPromises()
    button('获取预览').click()
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
    document.querySelector<HTMLButtonElement>('[aria-label="关闭"]')!.click()
    await flushPromises()
    finish({ info_from_self: { suit_list: ['10347'] } })
    await flushPromises()
    expect(document.querySelector('[role="dialog"]')).toBeNull()
    expect(Object.keys((await loadWardrobe()).entries)).toHaveLength(0)
  })
})
