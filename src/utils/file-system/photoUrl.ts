// 相片对象地址：按需创建、缓存并释放图片 Object URL。
import type { PhotoDisplayItem, PhotoItem } from '../photoGrouping'

const pendingPhotoLoads = new WeakMap<PhotoDisplayItem, Promise<string>>()
const releasedPhotos = new WeakSet<PhotoDisplayItem>()

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export async function readPhotoBlob(photo: PhotoDisplayItem): Promise<Blob> {
  if (photo.loadImageBlob) return photo.loadImageBlob()
  if ('fileHandle' in photo) return (photo as PhotoItem).fileHandle.getFile()
  throw new Error('Image source is unavailable')
}

export async function ensurePhotoUrl(
  photo: PhotoDisplayItem,
  signal?: AbortSignal
): Promise<string> {
  if (signal?.aborted || releasedPhotos.has(photo))
    throw new DOMException('Photo load cancelled', 'AbortError')
  if (photo.url) return photo.url
  let pending = pendingPhotoLoads.get(photo)
  if (!pending) {
    pending = (async () => {
      const file = await readPhotoBlob(photo)
      if (releasedPhotos.has(photo)) throw new DOMException('Photo load cancelled', 'AbortError')
      const url = URL.createObjectURL(file)
      if (releasedPhotos.has(photo)) {
        URL.revokeObjectURL(url)
        throw new DOMException('Photo load cancelled', 'AbortError')
      }
      photo.fileSizeText = formatFileSize(file.size)
      photo.fileSize = file.size
      if (file instanceof File) photo.lastModified = file.lastModified
      photo.url = url
      return url
    })().finally(() => pendingPhotoLoads.delete(photo))
    pendingPhotoLoads.set(photo, pending)
  }
  const url = await pending
  if (signal?.aborted || releasedPhotos.has(photo))
    throw new DOMException('Photo load cancelled', 'AbortError')
  return url
}

export function resetPhotoUrl(photo: PhotoDisplayItem): void {
  if (photo.url) URL.revokeObjectURL(photo.url)
  photo.url = null
  photo.fileSizeText = '--'
}

export function releasePhotoUrl(photo: PhotoDisplayItem): void {
  releasedPhotos.add(photo)
  if (photo.url) URL.revokeObjectURL(photo.url)
  photo.url = null
}

export function releasePhotoUrls(photos: PhotoDisplayItem[]): void {
  for (const photo of photos) releasePhotoUrl(photo)
}
