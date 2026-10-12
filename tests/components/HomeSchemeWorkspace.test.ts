import 'fake-indexeddb/auto'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { messages } from '../../src/i18n'
import HomeSchemeWorkspace from '../../src/components/HomeSchemeWorkspace.vue'
import { parseHomeScheme } from '../../src/utils/homeBuild/homeSchemeParser'
import { homeSchemeMessages } from '../../src/i18n/messages/homeScheme'
import { DB_NAME } from '../../src/utils/file-system/database'
import { readHomeSchemeSnapshot, saveHomeScheme } from '../../src/utils/homeBuild/homeSchemeStorage'
import { createEmptyHomeSchemeMetadata } from '../helpers/homeSchemeMetadata'

vi.mock('../../src/utils/homeBuild/homeSchemeParser', () => ({ parseHomeScheme: vi.fn() }))
const props = { libraryRevision: 0, messages: homeSchemeMessages.zh, disabled: false,
  confirmAction: async () => true, searchQuery: '', selectionMessages: messages.zh.selectionBar,
  lightboxMessages: messages.zh.lightbox, dateMessages: messages.zh.date, thumbnailMode: 'wide' as const }
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  vi.clearAllMocks()
  document.body.innerHTML = '<div id="album-sidebar-column"></div>'
})
afterEach(async () => {
  vi.useRealTimers()
  document.body.innerHTML = ''
  await new Promise<void>((resolve, reject) => { const r = indexedDB.deleteDatabase(DB_NAME); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error) })
})

it('adds and persists a parsed scheme without any album directory', async () => {
  vi.mocked(parseHomeScheme).mockResolvedValue({ code: 'CODE1', name: '新方案', templateType: 0, coverImage: null, lastModifyTime: 0, version: '2.10', furnitureCount: 7, server: 49 })
  const wrapper = mount(HomeSchemeWorkspace, { props, attachTo: document.body })
  try {
    await vi.waitFor(() => expect(wrapper.findAll('.home-scheme-header-actions button').map(button => (button.element as HTMLButtonElement).disabled)).toEqual([false, true, false]))
    await wrapper.get('.home-scheme-header-actions .primary-button').trigger('click')
    const code = document.querySelector<HTMLInputElement>('#home-scheme-code')!
    code.value = 'CODE1'; code.dispatchEvent(new Event('input', { bubbles: true }))
    await wrapper.vm.$nextTick()
    await vi.advanceTimersByTimeAsync(450)
    expect(vi.mocked(parseHomeScheme)).toHaveBeenCalledWith('CODE1', expect.anything())
    await flushPromises()
    const save = [...document.querySelectorAll<HTMLButtonElement>('.home-scheme-editor button')].find(button => button.textContent?.trim() === '确定')!
    expect(save).toBeTruthy(); save.click()
    await vi.waitFor(() => expect(document.querySelector('.home-scheme-editor')).toBeNull())
    expect((await readHomeSchemeSnapshot()).records[0]).toMatchObject({ code: 'CODE1', name: '新方案' })
    expect(wrapper.emitted('countChange')?.at(-1)).toEqual([1])
    expect((wrapper.findAll('.home-scheme-header-actions button')[1].element as HTMLButtonElement).disabled).toBe(false)
  } finally { wrapper.unmount() }
})

it('reloads global data after migration revision changes and preserves it when thumbnail settings change', async () => {
  const wrapper = mount(HomeSchemeWorkspace, { props, attachTo: document.body })
  try {
    await vi.waitFor(() => expect(wrapper.emitted('countChange')?.at(-1)).toEqual([0]))
    await wrapper.get('.home-scheme-header-actions .primary-button').trigger('click')
    await saveHomeScheme({ code: 'CODE2', name: '迁入方案', schemeType: 'combo', tags: [], note: '', metadata: createEmptyHomeSchemeMetadata() })
    await wrapper.setProps({ libraryRevision: 1 })
    expect(document.querySelector('.home-scheme-editor')).not.toBeNull()
    expect(wrapper.text()).not.toContain('迁入方案')
    const cancel = [...document.querySelectorAll<HTMLButtonElement>('.home-scheme-editor button')].find(button => button.textContent?.trim() === '取消')!
    cancel.click()
    await vi.waitFor(() => expect(wrapper.text()).toContain('迁入方案'))
    await wrapper.setProps({ thumbnailMode: 'default' })
    expect(wrapper.text()).toContain('迁入方案')
    expect((await readHomeSchemeSnapshot()).records).toHaveLength(1)
  } finally { wrapper.unmount() }
})
