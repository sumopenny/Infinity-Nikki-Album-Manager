import { afterEach, describe, expect, it, vi } from 'vitest'
import { convertImageToWebp, imageExtension, isSupportedImage, validateImageBlob } from '../../src/utils/outfit/outfitImage'
afterEach(() => vi.restoreAllMocks())
describe('outfitImage', () => {
  it('recognizes supported extensions case-insensitively', () => { expect(imageExtension('A.PNG')).toBe('png'); expect(isSupportedImage('A.PNG')).toBe(true); expect(isSupportedImage('a.txt')).toBe(false) })
  it('rejects empty and oversized images', async () => { await expect(validateImageBlob(new Blob())).rejects.toThrow('empty'); await expect(convertImageToWebp(new File([new Uint8Array(64*1024*1024+1)], 'x.png'))).rejects.toThrow('too large') })
  it('validates WebP and closes the bitmap', async () => { const close=vi.fn(); vi.stubGlobal('createImageBitmap', vi.fn(async()=>({width:10,height:10,close}))); const file=new File(['x'],'x.webp',{type:'image/webp'}); Object.defineProperty(file,'arrayBuffer',{value:async()=>new TextEncoder().encode('x')}); const blob=await convertImageToWebp(file); expect(blob.type).toBe('image/webp'); expect(close).toHaveBeenCalled() })
})
