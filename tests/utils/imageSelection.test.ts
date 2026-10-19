// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { validateSelectedImage } from '../../src/utils/imageSelection'
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})
function setup(mode: 'ok' | 'error' | 'timeout', width = 10) {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const revoke = vi.fn()
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:probe'), revokeObjectURL: revoke })
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = width
      naturalHeight = 10
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      removeAttribute() {}
      set src(_value: string) {
        queueMicrotask(() => {
          if (mode === 'ok') this.onload?.()
          if (mode === 'error') this.onerror?.()
        })
      }
    }
  )
  return revoke
}
it.each([
  ['photo.gif', 'image/gif'],
  ['photo.avif', 'image/avif'],
  ['photo.heic', 'image/heic'],
  ['photo.png', '']
])('allows %s when browser preview succeeds', async (name, type) => {
  const revoke = setup('ok')
  await validateSelectedImage(new File(['image'], name, { type }))
  expect(revoke).toHaveBeenCalledWith('blob:probe')
})
it('reports decode failure and releases the probe URL', async () => {
  const revoke = setup('error')
  await expect(
    validateSelectedImage(new File(['image'], 'a.heic', { type: 'image/heic' }))
  ).rejects.toThrow('Browser cannot decode')
  expect(revoke).toHaveBeenCalledOnce()
})
it('bounds silent preview hangs', async () => {
  vi.useFakeTimers()
  const revoke = setup('timeout')
  const task = expect(validateSelectedImage(new File(['image'], 'a.png'))).rejects.toThrow(
    'timed out'
  )
  await vi.advanceTimersByTimeAsync(15000)
  await task
  expect(revoke).toHaveBeenCalledOnce()
})
it('rejects excessive dimensions', async () => {
  setup('ok', 4_000_001)
  await expect(validateSelectedImage(new File(['image'], 'a.png'))).rejects.toThrow('dimensions')
})
