import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import CollectionActions from '../../src/components/CollectionActions.vue'
import ResonanceCloudActions from '../../src/components/ResonanceCloudActions.vue'
import { cloudRequest } from '../../src/utils/resonance/cloudClient'
import { loadResonanceRecords, saveResonanceRecords } from '../../src/utils/resonance/resonanceStorage'
import type { ResonanceRecord } from '../../src/utils/resonance/resonanceTypes'
vi.mock('../../src/utils/resonance/cloudClient', () => ({ cloudRequest: vi.fn() }))
const api = vi.mocked(cloudRequest)
const user = { id: 'user-1', username: 'nikki' }
const record = (id: string): ResonanceRecord => ({ id: `a:${id}`, bannerId: 'a', outfitId: id, bannerName: { zh: '池', en: 'Banner' }, outfitName: { zh: '套装', en: 'Outfit' }, bannerStartAt: '', outfitImageUrl: '', rarity: 5, sets: [{ setNumber: 1, totalPulls: 10, parts: [] }, { setNumber: 2, totalPulls: 0, parts: [] }] })
let wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  api.mockReset()
  api.mockResolvedValue({ user })
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
})
afterEach(async () => {
  wrappers.forEach(w => w.unmount()); wrappers = []
  vi.unstubAllGlobals()
  await new Promise<void>(resolve => { const r = indexedDB.deleteDatabase('infinity-nikki-album-manager'); r.onsuccess = r.onerror = r.onblocked = () => resolve() })
})
const panel = () => document.body.querySelector('dialog')!
const settled = async () => { await flushPromises(); await vi.waitFor(() => expect(panel().textContent).not.toMatch(/处理中|Working…/)) }
const submit = async () => { panel().querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); await settled() }
const click = async (w: ReturnType<typeof mount>, text: string) => { await w.findAll('button').find(b => b.text() === text)!.trigger('click'); await settled() }

describe('cloud menu and confirmations', () => {
  it('keeps mobile authentication dialog mounted after the ellipsis menu closes and after a breakpoint change', async () => {
    let listener: (() => void) | undefined
    const query = { matches: true, addEventListener: (_: string, cb: () => void) => { listener = cb }, removeEventListener: vi.fn() }
    vi.stubGlobal('matchMedia', () => query)
    api.mockResolvedValue({ user: null })
    const Host = defineComponent({ components: { CollectionActions, ResonanceCloudActions }, template: '<CollectionActions label="Actions" persistent-secondary><template #secondary><ResonanceCloudActions language="zh" /></template></CollectionActions>' })
    const w = mount(Host, { attachTo: document.body }); wrappers.push(w)
    await flushPromises()
    await w.find('.collection-action-trigger').trigger('click')
    await click(w, '登录')
    expect(panel().hasAttribute('open')).toBe(true)
    expect(w.find('.collection-action-options').isVisible()).toBe(false)
    query.matches = false; listener?.(); await flushPromises()
    expect(panel().hasAttribute('open')).toBe(true)
    expect(api).toHaveBeenCalledTimes(1)
  })
  it('downloads only after confirmation and completely replaces local records', async () => {
    await saveResonanceRecords([record('local')])
    const remote = { revision: 1, active_snapshot: 'save', records: [record('cloud')], updated_at: 1 }
    api.mockImplementation(async action => action === 'session' ? { user } : remote)
    const w = mount(ResonanceCloudActions, { props: { language: 'zh' } }); wrappers.push(w)
    await flushPromises(); await click(w, '从云端同步')
    expect(await loadResonanceRecords()).toEqual([record('local')])
    expect(panel().textContent).toContain('完整覆盖本地')
    await submit()
    expect(await loadResonanceRecords()).toEqual([record('cloud')])
    expect(w.emitted('restored')?.[0][0]).toEqual([record('cloud')])
  })
  it('rejects changed local data and leaves it intact', async () => {
    await saveResonanceRecords([record('local')])
    api.mockImplementation(async action => action === 'session' ? { user } : { revision: 1, active_snapshot: 'save', records: [record('cloud')] })
    const w = mount(ResonanceCloudActions, { props: { language: 'zh' } }); wrappers.push(w)
    await flushPromises(); await click(w, '从云端同步')
    await saveResonanceRecords([record('other-tab')]); await submit()
    expect(panel().textContent).toContain('本地记录已发生变化')
    expect(await loadResonanceRecords()).toEqual([record('other-tab')])
  })
  it('uses exactly the same request after an ambiguous upload failure', async () => {
    await saveResonanceRecords([record('local')])
    let attempts = 0
    api.mockImplementation(async action => {
      if (action === 'session') return { user }
      if (action === 'snapshot') return { revision: 0, active_snapshot: null, records: [] }
      if (attempts++ === 0) throw new Error('NETWORK')
      return { revision: 1, replayed: true }
    })
    const w = mount(ResonanceCloudActions, { props: { language: 'zh' } }); wrappers.push(w)
    await flushPromises(); await click(w, '上传云端'); await submit()
    expect(panel().textContent).toContain('核实结果并重试')
    await submit()
    const uploads = api.mock.calls.filter(([action]) => action === 'upload')
    expect(uploads).toHaveLength(2)
    expect(uploads[0][2]).toEqual(uploads[1][2])
    expect(await loadResonanceRecords()).toEqual([record('local')])
  })
  it('does not clear local records when cloud is empty', async () => {
    await saveResonanceRecords([record('local')])
    api.mockImplementation(async action => action === 'session' ? { user } : { revision: 0, active_snapshot: null, records: [] })
    const w = mount(ResonanceCloudActions, { props: { language: 'en' } }); wrappers.push(w)
    await flushPromises(); await click(w, 'Sync from cloud')
    expect(panel().textContent).toContain('No cloud save exists')
    expect(panel().querySelector('button[type=submit]')?.hasAttribute('disabled')).toBe(true)
    expect(await loadResonanceRecords()).toEqual([record('local')])
  })
})
