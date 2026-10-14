// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { convertImageToWebp, validateImageBlob } from '../../src/utils/image'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mockImage(options: { fail?: boolean; width?: number } = {}) {
  const removeAttribute = vi.fn()
  let loadedImage: unknown
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:test-image'),
    revokeObjectURL: vi.fn()
  })
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = options.width ?? 20
      naturalHeight = 10
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      removeAttribute = removeAttribute
      set src(_value: string) {
        loadedImage = this
        queueMicrotask(() => (options.fail ? this.onerror?.() : this.onload?.()))
      }
    }
  )
  return { removeAttribute, image: () => loadedImage }
}

describe('image decoding fallback', () => {
  it.each([
    'The source image could not be decoded.',
    "The provided value 'from-image' is not a valid enum value of type ImageOrientation."
  ])('converts through the image element after bitmap failure: %s', async (message) => {
    const decode = vi.fn().mockRejectedValue(new Error(message))
    vi.stubGlobal('createImageBitmap', decode)
    const fallback = mockImage()
    const drawImage = vi.fn()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage
    } as unknown as CanvasRenderingContext2D)
    const webp = new Blob(['webp'], { type: 'image/webp' })
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(webp))
    const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' })

    await expect(convertImageToWebp(file)).resolves.toBe(webp)
    expect(decode).toHaveBeenCalledWith(file)
    expect(drawImage).toHaveBeenCalledWith(fallback.image(), 0, 0)
    expect(fallback.removeAttribute).toHaveBeenCalledWith('src')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-image')
  })

  it('validates existing WebP through the fallback without re-encoding', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))
    mockImage()
    const file = new File(['webp'], 'photo.webp', { type: 'image/webp' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: async () => new TextEncoder().encode('webp').buffer
    })
    const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
    const result = await convertImageToWebp(file)
    expect(result.type).toBe('image/webp')
    expect(result.size).toBe(4)
    expect(canvas).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('works when ImageBitmap is unavailable', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    mockImage()
    await expect(validateImageBlob(new Blob(['image']))).resolves.toBeUndefined()
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('rejects unreadable images and releases the URL', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('decode failed')))
    const fallback = mockImage({ fail: true })
    await expect(validateImageBlob(new Blob(['invalid']))).rejects.toThrow(
      'Image could not be decoded'
    )
    expect(fallback.removeAttribute).toHaveBeenCalledWith('src')
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('retains the pixel limit after fallback and releases the URL', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    mockImage({ width: 4_000_001 })
    await expect(validateImageBlob(new Blob(['image']))).rejects.toThrow('too large')
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('releases the fallback image when canvas encoding fails', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    mockImage()
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(null))
    await expect(convertImageToWebp(new File(['image'], 'photo.png'))).rejects.toThrow(
      'WebP conversion failed'
    )
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })
})
