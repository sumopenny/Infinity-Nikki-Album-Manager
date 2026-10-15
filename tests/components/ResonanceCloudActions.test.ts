import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent } from 'vue'
import CollectionActions from '../../src/components/CollectionActions.vue'
import ResonanceCloudActions from '../../src/components/ResonanceCloudActions.vue'
import { cloudRequest } from '../../src/utils/resonance/cloudClient'
import {
  loadResonanceRecords,
  saveResonanceRecords
} from '../../src/utils/resonance/resonanceStorage'
import type { ResonanceRecord } from '../../src/utils/resonance/resonanceTypes'
vi.mock('../../src/utils/resonance/cloudClient', () => ({ cloudRequest: vi.fn() }))
const api = vi.mocked(cloudRequest)
const user = { id: 'user-1', username: 'nikki' }
const record = (id: string): ResonanceRecord => ({
  id: `a:${id}`,
  bannerId: 'a',
  outfitId: id,
  bannerName: { zh: '池', en: 'Banner' },
  outfitName: { zh: '套装', en: 'Outfit' },
  bannerStartAt: '',
  outfitImageUrl: '',
  rarity: 5,
  sets: [
    { setNumber: 1, totalPulls: 10, parts: [] },
    { setNumber: 2, totalPulls: 0, parts: [] }
  ]
})
let wrappers: ReturnType<typeof mount>[] = []
beforeEach(() => {
  // 模拟局域网 HTTP：提供安全随机数，但没有 randomUUID。
  vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) })
  api.mockReset()
  api.mockResolvedValue({ user })
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
})
afterEach(async () => {
  wrappers.forEach((w) => w.unmount())
  wrappers = []
  vi.unstubAllGlobals()
  await new Promise<void>((resolve) => {
    const r = indexedDB.deleteDatabase('infinity-nikki-album-manager')
    r.onsuccess = r.onerror = r.onblocked = () => resolve()
  })
})
const panel = () => document.body.querySelector('dialog')!
const settled = async () => {
  await flushPromises()
  await vi.waitFor(() => expect(panel().textContent).not.toMatch(/处理中|Working…/))
}
const submit = async () => {
  panel()
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settled()
}
const click = async (w: ReturnType<typeof mount>, text: string) => {
  await w
    .findAll('button')
    .find((b) => b.text() === text)!
    .trigger('click')
  await settled()
}

describe('cloud menu and confirmations', () => {
  it.each([
    ['登录', 'login', '登录成功'],
    ['注册', 'register', '注册成功']
  ])('reports %s success with a specific top notice', async (label, action, success) => {
    api.mockImplementation(async (request) => (request === 'session' ? { user: null } : { user }))
    const w = mount(ResonanceCloudActions, { props: { language: 'zh' } })
    wrappers.push(w)
    await flushPromises()
    await click(w, label)
    for (const input of panel().querySelectorAll<HTMLInputElement>('input')) {
      input.value = input.name === 'username' ? 'nikki' : 'abcdef'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await submit()
    expect(api.mock.calls.some(([name]) => name === action)).toBe(true)
    expect(w.emitted('notice')?.at(-1)).toEqual([success, 'success'])
  })
  it.each([
    ['登录', 'CREDENTIALS', '账号名或密码错误。'],
    ['注册', 'USERNAME_TAKEN', '该账号名已被使用。']
  ])('reports %s failures at the top and retains the form', async (label, code, message) => {
    api.mockImplementation(async (request) => {
      if (request === 'session') return { user: null }
      throw new Error(code)
    })
    const w = mount(ResonanceCloudActions, { props: { language: 'zh' } })
    wrappers.push(w)
    await flushPromises()
    await click(w, label)
    for (const input of panel().querySelectorAll<HTMLInputElement>('input')) {
      input.value = input.name === 'username' ? 'nikki' : 'abcdef'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    await submit()
    expect(w.emitted('notice')?.at(-1)).toEqual([message, 'error'])
    expect(panel().querySelector('.resonance-cloud-error')).toBeNull()
    expect(panel().hasAttribute('open')).toBe(true)
    expect(panel().querySelector<HTMLInputElement>('[name=username]')?.value).toBe('nikki')
  })
  it('deletes only after confirmation without a password and preserves local records', async () => {
    await saveResonanceRecords([record('local')])
    api.mockImplementation(async (action) =>
      action === 'session'
        ? { user }
        : { revision: 1, active_snapshot: 'save', records: [record('cloud')] }
    )
    const w = mount(ResonanceCloudActions, { props: { language: 'zh' } })
    wrappers.push(w)
    await flushPromises()
    await click(w, '删除云端存档')
    expect(panel().querySelector('input[type=password]')).toBeNull()
    expect(panel().textContent).toContain('确认后将删除全部云端共鸣记录')
    expect(api.mock.calls.filter(([action]) => action === 'delete')).toHaveLength(0)
    await submit()
    const calls = api.mock.calls.filter(([action]) => action === 'delete')
    expect(calls).toHaveLength(1)
    expect(calls[0][2]).toEqual({ requestId: expect.any(String), revision: 1 })
    expect(await loadResonanceRecords()).toEqual([record('local')])
  })
  it('keeps mobile authentication dialog mounted after the ellipsis menu closes and after a breakpoint change', async () => {
    let listener: (() => void) | undefined
    const query = {
      matches: true,
      addEventListener: (_: string, cb: () => void) => {
        listener = cb
      },
      removeEventListener: vi.fn()
    }
    vi.stubGlobal('matchMedia', () => query)
    api.mockResolvedValue({ user: null })
    const Host = defineComponent({
      components: { CollectionActions, ResonanceCloudActions },
      template:
        '<CollectionActions label="Actions" persistent-secondary><template #secondary><ResonanceCloudActions language="zh" /></template></CollectionActions>'
    })
    const w = mount(Host, { attachTo: document.body })
    wrappers.push(w)
    await flushPromises()
    await w.find('.collection-action-trigger').trigger('click')
    await click(w, '登录')
    expect(panel().hasAttribute('open')).toBe(true)
    expect(w.find('.collection-action-options').isVisible()).toBe(false)
    query.matches = false
    listener?.()
    await flushPromises()
    expect(panel().hasAttribute('open')).toBe(true)
    expect(api).toHaveBeenCalledTimes(1)
  })
  it('downloads only after confirmation and completely replaces local records', async () => {
    await saveResonanceRecords([record('local')])
    const remote = {
      revision: 1,
      active_snapshot: 'save',
      records: [record('cloud')],
      updated_at: 1
    }
    api.mockImplementation(async (action) => (action === 'session' ? { user } : remote))
    const w = mount(ResonanceCloudActions, { props: { language: 'zh' } })
    wrappers.push(w)
    await flushPromises()
    await click(w, '从云端同步')
    expect(await loadResonanceRecords()).toEqual([record('local')])
    expect(panel().textContent).toContain('完整覆盖本地')
    await submit()
    expect(await loadResonanceRecords()).toEqual([record('cloud')])
    expect(w.emitted('restored')?.[0][0]).toEqual([record('cloud')])
  })
  it('rejects changed local data and leaves it intact', async () => {
    await saveResonanceRecords([record('local')])
    api.mockImplementation(async (action) =>
      action === 'session'
        ? { user }
        : { revision: 1, active_snapshot: 'save', records: [record('cloud')] }
    )
    const w = mount(ResonanceCloudActions, { props: { language: 'zh' } })
    wrappers.push(w)
    await flushPromises()
    await click(w, '从云端同步')
    await saveResonanceRecords([record('other-tab')])
    await submit()
    expect(panel().textContent).toContain('本地记录已发生变化')
    expect(await loadResonanceRecords()).toEqual([record('other-tab')])
  })
  it('uses exactly the same request after an ambiguous upload failure', async () => {
    await saveResonanceRecords([record('local')])
    let attempts = 0
    api.mockImplementation(async (action) => {
      if (action === 'session') return { user }
      if (action === 'snapshot') return { revision: 0, active_snapshot: null, records: [] }
      if (attempts++ === 0) throw new Error('NETWORK')
      return { revision: 1, replayed: true }
    })
    const w = mount(ResonanceCloudActions, { props: { language: 'zh' } })
    wrappers.push(w)
    await flushPromises()
    await click(w, '上传云端')
    await submit()
    expect(panel().textContent).toContain('核实结果并重试')
    await submit()
    const uploads = api.mock.calls.filter(([action]) => action === 'upload')
    expect(uploads).toHaveLength(2)
    expect(uploads[0][2]).toEqual(uploads[1][2])
    expect(await loadResonanceRecords()).toEqual([record('local')])
  })
  it('does not clear local records when cloud is empty', async () => {
    await saveResonanceRecords([record('local')])
    api.mockImplementation(async (action) =>
      action === 'session' ? { user } : { revision: 0, active_snapshot: null, records: [] }
    )
    const w = mount(ResonanceCloudActions, { props: { language: 'en' } })
    wrappers.push(w)
    await flushPromises()
    await click(w, 'Sync from cloud')
    expect(panel().textContent).toContain('No cloud save exists')
    expect(panel().querySelector('button[type=submit]')?.hasAttribute('disabled')).toBe(true)
    expect(await loadResonanceRecords()).toEqual([record('local')])
  })
})
