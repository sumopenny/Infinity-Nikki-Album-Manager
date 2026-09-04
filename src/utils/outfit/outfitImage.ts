// 搭配图片处理：负责图片格式识别、WebP 转换、尺寸和写入结果校验。
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

export async function validateImageBlob(blob: Blob): Promise<void> {
  if (!blob.size) throw new Error('Image is empty')
  const bitmap = await createImageBitmap(blob)
  try {
    validateImageDimensions(bitmap.width, bitmap.height)
  } finally {
    bitmap.close()
  }
}
export async function convertImageToWebp(file: File): Promise<Blob> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large')
  if (imageExtension(file.name) === 'webp' || file.type === 'image/webp') {
    const webp = new Blob([await file.arrayBuffer()], { type: 'image/webp' })
    await validateImageBlob(webp)
    return webp
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    validateImageDimensions(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas is unavailable')
    context.drawImage(bitmap, 0, 0)
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('WebP conversion failed')),
        'image/webp',
        0.9
      )
    })
  } finally {
    bitmap.close()
  }
}

export async function validateWrittenFileSize(
  directory: FileSystemDirectoryHandle,
  name: string,
  expectedSize: number
): Promise<void> {
  const fileHandle = await directory.getFileHandle(name)
  const file = await fileHandle.getFile()
  if (!file.size || file.size !== expectedSize) {
    throw new Error('Written image size is invalid')
  }
}
