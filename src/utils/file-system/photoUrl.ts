// 相片对象地址：按需创建、缓存并释放图片 Object URL。
import type { PhotoItem } from '../photoGrouping'

const pendingPhotoLoads = new WeakMap<PhotoItem, Promise<string>>()
const releasedPhotos = new WeakSet<PhotoItem>()

export function formatFileSize(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`
  return `${(size / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export async function ensurePhotoUrl(photo: PhotoItem, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted || releasedPhotos.has(photo)) throw new DOMException('Photo load cancelled', 'AbortError')
  if (photo.url) return photo.url
  let pending = pendingPhotoLoads.get(photo)
  if (!pending) {
    pending = (async () => {
      const file = await photo.fileHandle.getFile()
      if (releasedPhotos.has(photo)) throw new DOMException('Photo load cancelled', 'AbortError')
      const url = URL.createObjectURL(file)
      if (releasedPhotos.has(photo)) { URL.revokeObjectURL(url); throw new DOMException('Photo load cancelled', 'AbortError') }
      photo.fileSizeText = formatFileSize(file.size)
      photo.fileSize = file.size
      photo.lastModified = file.lastModified
      photo.url = url
      return url
    })().finally(() => pendingPhotoLoads.delete(photo))
    pendingPhotoLoads.set(photo, pending)
  }
  const url = await pending
  if (signal?.aborted || releasedPhotos.has(photo)) throw new DOMException('Photo load cancelled', 'AbortError')
  return url
}

export function resetPhotoUrl(photo: PhotoItem): void {
  if (photo.url) URL.revokeObjectURL(photo.url)
  photo.url = null
  photo.fileSizeText = '--'
}

export function releasePhotoUrl(photo: PhotoItem): void {
  releasedPhotos.add(photo)
  if (photo.url) URL.revokeObjectURL(photo.url)
  photo.url = null
}

export function releasePhotoUrls(photos: PhotoItem[]): void {
  for (const photo of photos) releasePhotoUrl(photo)
}
