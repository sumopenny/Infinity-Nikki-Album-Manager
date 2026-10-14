// 通用图片处理：负责图片格式识别、WebP 转换、尺寸校验。
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'])
export const MAX_IMAGE_BYTES = 64 * 1024 * 1024
const MAX_IMAGE_PIXELS = 40_000_000

export function imageExtension(fileName: string): string {
  return fileName.split('.').pop()?.toLowerCase() ?? ''
}

export function isSupportedImage(fileName: string): boolean {
  return SUPPORTED_IMAGE_EXTENSIONS.has(imageExtension(fileName))
}

function validateImageDimensions(width: number, height: number): void {
  if (!width || !height) throw new Error('Image dimensions are invalid')
  if (width * height > MAX_IMAGE_PIXELS) throw new Error('Image dimensions are too large')
}

// 统一供转换和校验使用；部分手机浏览器能显示图片，但无法通过 ImageBitmap 解码。
async function decodeImage(blob: Blob): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}> {
  if (typeof createImageBitmap === 'function') {
    try {
      // 默认使用图片自身方向，避免旧浏览器拒绝显式的 from-image 参数。
      const bitmap = await createImageBitmap(blob)
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close()
      }
    } catch {
      // 使用与图片预览一致的加载路径重试。
    }
  }

  const url = URL.createObjectURL(blob)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () => reject(new Error('Image could not be decoded'))
      image.src = url
    })
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      release: () => {
        image.removeAttribute('src')
        URL.revokeObjectURL(url)
      }
    }
  } catch (error) {
    image.removeAttribute('src')
    URL.revokeObjectURL(url)
    throw error
  } finally {
    image.onload = null
    image.onerror = null
  }
}

export async function validateImageBlob(blob: Blob): Promise<void> {
  if (!blob.size) throw new Error('Image is empty')
  const bitmap = await decodeImage(blob)
  try {
    validateImageDimensions(bitmap.width, bitmap.height)
  } finally {
    bitmap.release()
  }
}
async function readImageBytes(file: File): Promise<ArrayBuffer> {
  try {
    return await file.arrayBuffer()
  } catch {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) resolve(reader.result)
        else reject(new Error('Image file could not be read'))
      }
      reader.onerror = () => reject(reader.error ?? new Error('Image file could not be read'))
      reader.onabort = () => reject(new Error('Image file reading was aborted'))
      reader.readAsArrayBuffer(file)
    })
  }
}

export async function convertImageToWebp(file: File): Promise<Blob> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large')
  if (imageExtension(file.name) === 'webp' || file.type === 'image/webp') {
    let bytes: ArrayBuffer | undefined
    try {
      bytes = await readImageBytes(file)
    } catch {
      // 原文件字节无法读取时，尝试与其他格式一样解码并重新生成 WebP。
    }
    if (bytes) {
      const webp = new Blob([bytes], { type: 'image/webp' })
      await validateImageBlob(webp)
      return webp
    }
  }
  const bitmap = await decodeImage(file)
  try {
    validateImageDimensions(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    context.drawImage(bitmap.source, 0, 0)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error('WebP conversion failed'))),
        'image/webp',
        0.9
      )
    })
  } finally {
    bitmap.release()
  }
}
