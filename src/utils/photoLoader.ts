import type { PhotoItem } from './photoGrouping'
import { ensurePhotoUrl, resetPhotoUrl } from './fileSystem'

interface QueueEntry {
  task: () => Promise<string>
  signal?: AbortSignal
  resolve: (url: string) => void
  reject: (error: unknown) => void
  removeAbortListener?: () => void
}

export interface PhotoLoadQueue {
  load: (photo: PhotoItem, signal?: AbortSignal) => Promise<string>
  cancel: () => void
}

/** 解码完成的照片对象地址与原始尺寸。 */
export interface DecodedPhoto {
  url: string
  width: number
  height: number
}

/**
 * 等待浏览器完成图片读取和解码。
 * 参数：url 为对象地址，signal 用于取消已经离开页面的加载任务。
 * 返回：图片原始宽高，供调用方复用解码结果而不必再次探测。
 */
function waitForImageLoad(url: string, signal?: AbortSignal): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image()

    const cleanup = () => {
      image.onload = null
      image.onerror = null
      signal?.removeEventListener('abort', handleAbort)
    }
    const handleAbort = () => {
      cleanup()
      image.src = ''
      reject(new DOMException('Photo load cancelled', 'AbortError'))
    }

    image.onload = () => {
      cleanup()
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      cleanup()
      reject(new Error('Photo image decode failed'))
    }
    signal?.addEventListener('abort', handleAbort, { once: true })

    if (signal?.aborted) {
      handleAbort()
      return
    }
    image.src = url
  })
}

/**
 * 读取并解码照片，普通失败时自动重试一次。
 * 参数：photo 为目标照片，signal 用于取消失效任务。
 * 返回：已经完成解码的对象地址与原始尺寸。
 */
async function loadDecodedPhotoWithRetry(photo: PhotoItem, signal?: AbortSignal): Promise<DecodedPhoto> {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const url = await ensurePhotoUrl(photo, signal)
      const { width, height } = await waitForImageLoad(url, signal)
      return { url, width, height }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      lastError = error
      resetPhotoUrl(photo)
    }
  }

  throw lastError
}

/**
 * 读取并解码照片，普通失败时自动重试一次。
 * 参数：photo 为目标照片，signal 用于取消失效任务。
 * 返回：已经完成解码的对象地址。
 */
export async function loadPhotoWithRetry(photo: PhotoItem, signal?: AbortSignal): Promise<string> {
  return (await loadDecodedPhotoWithRetry(photo, signal)).url
}

/**
 * 读取并解码照片并带回原始尺寸，避免大图预览为测量宽高重复解码。
 * 参数：photo 为目标照片，signal 用于取消失效任务。
 * 返回：已经完成解码的对象地址与原始宽高。
 */
export async function loadPhotoWithRetryAndSize(photo: PhotoItem, signal?: AbortSignal): Promise<DecodedPhoto> {
  return loadDecodedPhotoWithRetry(photo, signal)
}

/**
 * 创建限制并发数的缩略图加载队列。
 * 参数：concurrency 为同时进行的最大图片加载数量。
 * 返回：可提交照片任务并整体取消的队列。
 */
export function createPhotoLoadQueue(concurrency: number): PhotoLoadQueue {
  const queue: QueueEntry[] = []
  let activeCount = 0
  let cancelled = false

  // 依次启动队列任务，直到达到并发上限。
  const drain = () => {
    while (!cancelled && activeCount < concurrency && queue.length) {
      const entry = queue.shift()
      if (!entry) return
      entry.removeAbortListener?.()

      if (entry.signal?.aborted) {
        entry.reject(new DOMException('Photo load cancelled', 'AbortError'))
        continue
      }

      activeCount += 1
      entry.task().then(entry.resolve, entry.reject).finally(() => {
        activeCount -= 1
        drain()
      })
    }
  }

  // 将单张照片加入共享队列，组件卸载时可通过 signal 移除等待中的任务。
  const load = (photo: PhotoItem, signal?: AbortSignal): Promise<string> =>
    new Promise((resolve, reject) => {
      if (cancelled || signal?.aborted) {
        reject(new DOMException('Photo load cancelled', 'AbortError'))
        return
      }

      const entry: QueueEntry = {
        task: () => loadPhotoWithRetry(photo, signal),
        signal,
        resolve,
        reject
      }
      const handleAbort = () => {
        const index = queue.indexOf(entry)
        if (index < 0) return
        queue.splice(index, 1)
        reject(new DOMException('Photo load cancelled', 'AbortError'))
      }
      signal?.addEventListener('abort', handleAbort, { once: true })
      entry.removeAbortListener = () => signal?.removeEventListener('abort', handleAbort)
      queue.push(entry)
      drain()
    })

  // 取消所有尚未开始的任务；活动任务由各组件的 AbortSignal 结束。
  const cancel = () => {
    cancelled = true
    for (const entry of queue.splice(0)) {
      entry.removeAbortListener?.()
      entry.reject(new DOMException('Photo load cancelled', 'AbortError'))
    }
  }

  return { load, cancel }
}
