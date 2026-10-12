import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_IMAGE_BYTES, convertImageToWebp, imageExtension, isSupportedImage, validateImageBlob } from '../../src/utils/image'
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('outfitImage', () => {
  it('recognizes supported extensions case-insensitively', () => { expect(imageExtension('A.PNG')).toBe('png'); expect(isSupportedImage('A.PNG')).toBe(true); expect(isSupportedImage('a.txt')).toBe(false) })
  it('rejects empty and oversized images before decoding', async () => {
    await expect(validateImageBlob(new Blob())).rejects.toThrow('empty')
    const file = new File(['x'], 'x.png')
    Object.defineProperty(file, 'size', { value: MAX_IMAGE_BYTES + 1 })
    await expect(convertImageToWebp(file)).rejects.toThrow('too large')
  })
  it('validates WebP and closes the bitmap', async () => { const close=vi.fn(); vi.stubGlobal('createImageBitmap', vi.fn(async()=>({width:10,height:10,close}))); const file=new File(['x'],'x.webp',{type:'image/webp'}); Object.defineProperty(file,'arrayBuffer',{value:async()=>new TextEncoder().encode('x')}); const blob=await convertImageToWebp(file); expect(blob.type).toBe('image/webp'); expect(close).toHaveBeenCalled() })
})
