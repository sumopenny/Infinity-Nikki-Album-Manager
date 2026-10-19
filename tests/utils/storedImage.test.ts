// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { convertImageForStorage } from '../../src/utils/storedImage'
import { convertImageToWebp, validateImageBlob } from '../../src/utils/image'
vi.mock('../../src/utils/image', () => ({
  convertImageToWebp: vi.fn(),
  validateImageBlob: vi.fn(),
  MAX_IMAGE_BYTES: 64 * 1024 * 1024
}))
afterEach(() => vi.resetAllMocks())
const png = new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), 'original'], 'wrong.jpg', {
  type: 'image/jpeg'
})
it.each(['png-output', 'null-output', 'throws'])(
  'preserves original bytes on %s and corrects MIME',
  async (mode) => {
    if (mode === 'png-output')
      vi.mocked(convertImageToWebp).mockResolvedValue(
        new Blob([await png.arrayBuffer(), 'reencoded'], { type: 'image/png' })
      )
    else vi.mocked(convertImageToWebp).mockRejectedValue(new Error(mode))
    const result = await convertImageForStorage(png)
    expect(result.type).toBe('image/png')
    expect(new Uint8Array(await result.arrayBuffer())).toEqual(
      new Uint8Array(await png.arrayBuffer())
    )
    expect(validateImageBlob).toHaveBeenCalledOnce()
  }
)
it('keeps successful WebP encoding', async () => {
  const output = new Blob(['RIFF0000WEBPencoded'], { type: 'image/webp' })
  vi.mocked(convertImageToWebp).mockResolvedValue(output)
  expect(await (await convertImageForStorage(png)).text()).toBe(await output.text())
  expect(validateImageBlob).not.toHaveBeenCalled()
})
it('does not save an undecodable original', async () => {
  vi.mocked(convertImageToWebp).mockRejectedValue(new Error('encoding failed'))
  vi.mocked(validateImageBlob).mockRejectedValue(new Error('decode failed'))
  await expect(convertImageForStorage(png)).rejects.toThrow('decode failed')
})
it('rejects invalid signatures and oversized originals', async () => {
  vi.mocked(convertImageToWebp).mockRejectedValue(new Error('encoding failed'))
  await expect(convertImageForStorage(new File(['bad'], 'bad.png'))).rejects.toThrow('signature')
  const large = new File(['x'], 'large.png')
  Object.defineProperty(large, 'size', { value: 65 * 1024 * 1024 })
  await expect(convertImageForStorage(large)).rejects.toThrow('size')
})
