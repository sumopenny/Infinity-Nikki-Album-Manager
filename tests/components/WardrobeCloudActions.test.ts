import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import WardrobeCloudActions from '../../src/components/WardrobeCloudActions.vue'
import { cloudRequest } from '../../src/utils/resonance/cloudClient'
import { CloudRequestError } from '../../src/utils/cloud/cloudClient'
import {
  getWardrobeHead,
  getWardrobeSnapshot,
  writeWardrobeSnapshot
} from '../../src/utils/wardrobe/wardrobeCloudClient'
import { emptyWardrobe } from '../../src/utils/wardrobe/wardrobeSchema'
import {
  normalizeCloudWardrobe,
  summarizeWardrobe,
  type WardrobeCloudHead
} from '../../src/utils/wardrobe/wardrobeCloudSchema'
import { readWardrobeSnapshot, updateWardrobe } from '../../src/utils/wardrobe/wardrobeStorage'
import { clearAllBrowserData } from '../../src/utils/file-system/database'
import * as wardrobeStorage from '../../src/utils/wardrobe/wardrobeStorage'
import { reportError } from '../../src/utils/errorReporting/errorReporter'
vi.mock('../../src/utils/errorReporting/errorReporter', async (original) => ({
  ...(await original<typeof import('../../src/utils/errorReporting/errorReporter')>()),
  reportError: vi.fn()
}))
vi.mock('../../src/utils/resonance/cloudClient', () => ({ cloudRequest: vi.fn() }))
vi.mock('../../src/utils/wardrobe/wardrobeCloudClient', () => ({
  getWardrobeHead: vi.fn(),
  getWardrobeSnapshot: vi.fn(),
  writeWardrobeSnapshot: vi.fn()
}))
const api = vi.mocked(cloudRequest),
  head = vi.mocked(getWardrobeHead),
  snapshot = vi.mocked(getWardrobeSnapshot),
  write = vi.mocked(writeWardrobeSnapshot)
const user = { id: 'wardrobe-user', username: 'nikki' }
const saved = () =>
  normalizeCloudWardrobe({ ...emptyWardrobe(), imported: true, regionScope: 'global' })
const remote = (): WardrobeCloudHead => ({
  revision: 1,
  updated_at: 1,
  active_snapshot: 'save',
  summary: summarizeWardrobe(saved())
})
let wrapper: ReturnType<typeof mount>
const panel = () => document.body.querySelector('dialog')!
const settle = async () => {
  await flushPromises()
  await vi.waitFor(() => expect(panel().textContent).not.toContain('Working…'))
}
async function open(text: string) {
  await wrapper
    .findAll('button')
    .find((b) => b.text() === text)!
    .trigger('click')
  await settle()
}
async function submit() {
  panel()
    .querySelector('form')!
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle()
}
beforeEach(async () => {
  vi.resetAllMocks()
  await clearAllBrowserData()
  api.mockResolvedValue({ user })
  head.mockResolvedValue(remote())
  snapshot.mockResolvedValue({ ...remote(), schemaVersion: 1, data: saved() })
  write.mockResolvedValue({ revision: 2, replayed: false })
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
  }
  wrapper = mount(WardrobeCloudActions, { props: { language: 'en' } })
  await flushPromises()
})
afterEach(() => {
  wrapper.unmount()
  vi.restoreAllMocks()
})
describe('wardrobe cloud confirmation', () => {
  it('retains the original IndexedDB read failure in diagnostics', async () => {
    const cause = new DOMException('read failed', 'UnknownError')
    vi.spyOn(wardrobeStorage, 'loadWardrobe').mockRejectedValueOnce(cause)
    await open('Upload to cloud')
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'LOCAL_READ_FAILED', cause }),
      { module: 'wardrobe-cloud', action: 'upload', stage: 'prepare' }
    )
    expect(write).not.toHaveBeenCalled()
  })
  it('retains the original IndexedDB write failure in diagnostics', async () => {
    const cause = new DOMException('write failed', 'QuotaExceededError')
    await open('Sync from cloud')
    vi.spyOn(wardrobeStorage, 'replaceWardrobeIfUnchanged').mockRejectedValueOnce(cause)
    await submit()
    expect(reportError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'LOCAL_SAVE_FAILED', cause }),
      { module: 'wardrobe-cloud', action: 'download', stage: 'submit' }
    )
    expect(wrapper.emitted('restored')).toBeUndefined()
  })
  it('does not synchronize on login and only reads summary for a valid zero-item upload', async () => {
    expect(head).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    await updateWardrobe(() => ({ ...emptyWardrobe(), imported: true }))
    await open('Upload to cloud')
    expect(panel().textContent).toContain('owns 0 pieces')
    expect(panel().textContent).toContain('cloud wardrobe region will change to CN')
    expect(snapshot).not.toHaveBeenCalled()
    await submit()
    expect(write).toHaveBeenCalledWith(
      'upload',
      user,
      expect.objectContaining({
        revision: 1,
        schemaVersion: 1,
        data: expect.objectContaining({ imported: true, entries: {}, regionScope: 'cn' })
      })
    )
    expect(wrapper.emitted('notice')?.at(-1)).toEqual(['Operation completed.', 'success'])
  })
  it('blocks cleared local data', async () => {
    await open('Upload to cloud')
    expect(panel().textContent).toContain('has not been imported or has been cleared')
    expect(panel().querySelector('button[type=submit]')).toBeNull()
    expect(write).not.toHaveBeenCalled()
  })
  it('restores a valid empty cloud save with its region after confirmation', async () => {
    await updateWardrobe(() => ({
      ...emptyWardrobe(),
      imported: true,
      regionScope: 'cn',
      entries: { '123': { owned: true, source: 'manual' } }
    }))
    await open('Sync from cloud')
    expect(panel().textContent).toContain('wardrobe region will change to Global')
    expect(snapshot).not.toHaveBeenCalled()
    await submit()
    expect(snapshot).toHaveBeenCalledTimes(1)
    expect(await readWardrobeSnapshot()).toMatchObject({
      imported: true,
      entries: {},
      regionScope: 'global'
    })
    expect(wrapper.emitted('restored')).toHaveLength(1)
  })
  it('does not replace local data when the cloud is absent or changes after preview', async () => {
    head.mockResolvedValueOnce({ revision: 1, updated_at: 1, active_snapshot: null, summary: null })
    await updateWardrobe(() => ({ ...emptyWardrobe(), imported: true, unknownSuitIds: ['999999'] }))
    await open('Sync from cloud')
    expect(panel().textContent).toContain('No cloud wardrobe exists')
    expect(await readWardrobeSnapshot()).toMatchObject({ unknownSuitIds: ['999999'] })
  })
  it('rejects local changes between preview and download', async () => {
    await open('Sync from cloud')
    await updateWardrobe(() => ({ ...emptyWardrobe(), imported: true, unknownSuitIds: ['999999'] }))
    await submit()
    expect(panel().textContent).toContain('Local records changed')
    expect(await readWardrobeSnapshot()).toMatchObject({ unknownSuitIds: ['999999'] })
    expect(wrapper.emitted('restored')).toBeUndefined()
  })
  it('rejects a newer cloud revision', async () => {
    await open('Sync from cloud')
    snapshot.mockResolvedValueOnce({ ...remote(), revision: 2, schemaVersion: 1, data: saved() })
    await submit()
    expect(panel().textContent).toContain('Another device updated')
    expect(await readWardrobeSnapshot()).toMatchObject({ imported: false })
  })
  it.each(['NETWORK', 'SERVER_ERROR'])(
    'retries the same payload after %s even if local data changed',
    async (code) => {
      await updateWardrobe(() => ({ ...emptyWardrobe(), imported: true }))
      await open('Upload to cloud')
      write.mockRejectedValueOnce(new CloudRequestError(code, 'test-trace-id'))
      await submit()
      expect(reportError).toHaveBeenCalledWith(
        expect.objectContaining({ message: code, traceId: 'test-trace-id' }),
        { module: 'wardrobe-cloud', action: 'upload', stage: 'submit' }
      )
      expect(panel().textContent).toContain('Error reference: test-trace-id')
      const original = JSON.stringify(write.mock.calls[0][2])
      await updateWardrobe(() => ({
        ...emptyWardrobe(),
        imported: true,
        unknownSuitIds: ['999999']
      }))
      await submit()
      expect(write).toHaveBeenCalledTimes(2)
      expect(JSON.stringify(write.mock.calls[1][2])).toBe(original)
    }
  )
})
