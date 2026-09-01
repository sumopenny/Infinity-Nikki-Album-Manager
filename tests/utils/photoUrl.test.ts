import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensurePhotoUrl, formatFileSize, releasePhotoUrl, resetPhotoUrl } from '../../src/utils/file-system/photoUrl'

afterEach(() => vi.restoreAllMocks())
Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: () => 'blob:default' })
Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: () => undefined })
const photo = (file: File) => ({ url: null, fileHandle: { getFile: async () => file } }) as any
describe('photoUrl', () => {
  it('formats file sizes at unit boundaries', () => { expect(formatFileSize(12)).toBe('12 B'); expect(formatFileSize(1024)).toBe('1.0 KB'); expect(formatFileSize(1024 ** 2)).toBe('1.0 MB') })
  it('loads, caches and releases an object URL', async () => { const p = photo(new File(['abc'], 'a.jpg', { lastModified: 42 })); vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:a'); const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined); expect(await ensurePhotoUrl(p)).toBe('blob:a'); expect(p.fileSize).toBe(3); expect(await ensurePhotoUrl(p)).toBe('blob:a'); releasePhotoUrl(p); expect(revoke).toHaveBeenCalledWith('blob:a'); await expect(ensurePhotoUrl(p)).rejects.toThrow('cancelled') })
  it('resets an existing URL', () => { const p = photo(new File(['x'], 'x')); p.url = 'blob:x'; const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined); resetPhotoUrl(p); expect(p.url).toBeNull(); expect(revoke).toHaveBeenCalledWith('blob:x') })
})
