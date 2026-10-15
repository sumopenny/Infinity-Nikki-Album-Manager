import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { computed, effectScope, ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { usePhotoParams } from '../../src/composables/usePhotoParams'
import { photoParamsZh } from '../../src/i18n/messages/photoParams'
import {
  getSavedX6GameDirectoryHandle,
  getSavedCameraParamUids,
  addSavedCameraParamUid
} from '../../src/utils/file-system/directoryStorage'
import { decodePhoto } from '../../src/utils/photo-params/wasmClient'
vi.mock('../../src/utils/file-system/directoryStorage', () => ({
  getSavedX6GameDirectoryHandle: vi.fn(),
  getSavedCameraParamUids: vi.fn(),
  addSavedCameraParamUid: vi.fn()
}))
vi.mock('../../src/utils/file-system/directoryAccess', () => ({
  listGamePlayPhotoAccounts: vi.fn(async () => [])
}))
vi.mock('../../src/utils/photo-params/wasmClient', () => ({
  decodePhoto: vi.fn(),
  decodeCameraParams: vi.fn()
}))
let scope: ReturnType<typeof effectScope>
function setup() {
  scope = effectScope()
  return scope.run(() =>
    usePhotoParams({ language: ref('zh'), messages: computed(() => photoParamsZh) })
  )!
}
const file = () => ({ name: 'photo.jpg', arrayBuffer: async () => new ArrayBuffer(1) }) as File
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(getSavedX6GameDirectoryHandle).mockResolvedValue(null)
  vi.mocked(getSavedCameraParamUids).mockResolvedValue([])
})
afterEach(() => scope.stop())
it('does not request UID or change progress after an old directory lookup completes', async () => {
  let finish!: (value: null) => void
  vi.mocked(getSavedX6GameDirectoryHandle).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = resolve
    })
  )
  const state = setup()
  const task = state.openForFile(file())
  await flushPromises()
  state.openCameraParamsTool()
  finish(null)
  await task
  expect(state.uidRequired.value).toBe(false)
  expect(state.error.value).toBeNull()
  expect(state.progress.value.stage).toBe('idle')
})
it.each(['switch', 'close', 'dispose'])(
  'drops decoded results when UID saving finishes after %s',
  async (action) => {
    const state = setup()
    await state.openForFile(file())
    let finish!: () => void
    vi.mocked(addSavedCameraParamUid).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      })
    )
    vi.mocked(decodePhoto).mockResolvedValue({
      ok: true,
      value: { camera: {}, photo: {}, rawCameraParams: 'old' }
    })
    const task = state.submitUid('123456789')
    await flushPromises()
    expect(addSavedCameraParamUid).toHaveBeenCalled()
    if (action === 'switch') state.openCameraParamsTool()
    else if (action === 'close') state.close()
    else scope.stop()
    const progress = state.progress.value
    finish()
    await task
    expect(state.result.value).toBeNull()
    expect(state.progress.value).toEqual(progress)
  }
)
