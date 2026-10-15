// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { convertImageToWebp, snapshotImageFile, validateImageBlob } from '../../src/utils/image'

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

  it('reads the original WebP using FileReader after a NotReadableError', async () => {
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 20, height: 10, close: vi.fn() })
    )
    const file = new File(['original-webp'], 'photo.webp', { type: 'image/webp' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi
        .fn()
        .mockRejectedValue(
          new DOMException('The requested file could not be read', 'NotReadableError')
        )
    })
    const read = vi.spyOn(FileReader.prototype, 'readAsArrayBuffer')
    const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob')
    const result = await convertImageToWebp(file)
    const bytes = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as ArrayBuffer)
      reader.readAsArrayBuffer(result)
    })
    expect(new TextDecoder().decode(bytes)).toBe('original-webp')
    expect(read).toHaveBeenCalledWith(file)
    expect(canvas).not.toHaveBeenCalled()
  })

  it('re-encodes WebP when both byte readers fail but image loading succeeds', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    mockImage()
    const file = new File(['webp'], 'photo.webp', { type: 'image/webp' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockRejectedValue(new Error('not readable'))
    })
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(() => {
      throw new DOMException('not readable', 'NotReadableError')
    })
    const output = new Blob(['encoded'], { type: 'image/webp' })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn()
    } as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
      callback(output)
    )
    await expect(convertImageToWebp(file)).resolves.toBe(output)
    expect(URL.revokeObjectURL).toHaveBeenCalledOnce()
  })

  it('rejects WebP when neither byte reading nor image loading succeeds', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    mockImage({ fail: true })
    const file = new File(['invalid'], 'photo.webp', { type: 'image/webp' })
    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockRejectedValue(new Error('not readable'))
    })
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(() => {
      throw new DOMException('not readable', 'NotReadableError')
    })
    await expect(convertImageToWebp(file)).rejects.toThrow('Image could not be decoded')
  })

  it('reports FileReader failures without attempting Data URL decoding', async () => {
    vi.stubGlobal('createImageBitmap', undefined)
    mockImage({ fail: true })
    vi.spyOn(FileReader.prototype, 'readAsDataURL').mockImplementation(() => {
      throw new DOMException('file access denied', 'NotReadableError')
    })
    await expect(validateImageBlob(new Blob(['image']))).rejects.toThrow(
      'FileReader=FAILED (NotReadableError: file access denied); DataURL=SKIPPED'
    )
  })

  it('copies original bytes into an independent file before the source becomes unreadable', async () => {
    const original = new File(['original-image'], 'photo.jpg', {
      type: 'image/jpeg',
      lastModified: 123
    })
    const snapshot = await snapshotImageFile(original)
    expect(snapshot).not.toBe(original)
    expect(snapshot.name).toBe(original.name)
    expect(snapshot.type).toBe(original.type)
    expect(snapshot.lastModified).toBe(123)
    const read = FileReader.prototype.readAsArrayBuffer
    vi.spyOn(FileReader.prototype, 'readAsArrayBuffer').mockImplementation(function (
      this: FileReader,
      blob
    ) {
      if (blob === original) throw new DOMException('expired', 'NotReadableError')
      return read.call(this, blob)
    })
    await expect(snapshotImageFile(original)).rejects.toThrow('NotReadableError: expired')
    const secondCopy = await snapshotImageFile(snapshot)
    expect(secondCopy.size).toBe(original.size)
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.readAsText(secondCopy)
    })
    expect(text).toBe('original-image')
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
    const result = validateImageBlob(new Blob(['invalid'], { type: 'image/jpeg' }))
    await expect(result).rejects.toThrow('decode:img-blob-url')
    await expect(result).rejects.toThrow('createImageBitmap=Error: decode failed')
    await expect(result).rejects.toThrow('type=image/jpeg; bytes=7')
    await expect(result).rejects.toThrow(
      'FileReader=OK; readBytes=7; sizeMatch=true; header=696e76616c6964; sha256='
    )
    await expect(result).rejects.toThrow('DataURL=FAILED')
    await expect(result).rejects.toThrow('Image could not be decoded')
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
