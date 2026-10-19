import { sha256Hex } from './sha256'

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

// 立即通过 FileReader 获取真实字节，避免只包装原 File 后仍依赖手机文件提供器。
async function readBlobBytes(blob: Blob): Promise<ArrayBuffer> {
  return await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader()
    const finish = () => {
      clearTimeout(timer)
      reader.onload = reader.onerror = reader.onabort = null
    }
    const timer = setTimeout(() => {
      finish()
      reader.abort()
      reject(new Error('FileReader timeout (15000ms)'))
    }, 15000)
    reader.onload = () => {
      const result = reader.result
      finish()
      if (result instanceof ArrayBuffer) resolve(result)
      else reject(new Error('FileReader returned a non-buffer result'))
    }
    reader.onerror = () => {
      const error = reader.error ?? new Error('FileReader error without native reason')
      finish()
      reject(error)
    }
    reader.onabort = () => {
      finish()
      reject(new Error('FileReader aborted'))
    }
    try {
      reader.readAsArrayBuffer(blob)
    } catch (error) {
      finish()
      reject(error)
    }
  })
}

// 从实际字节创建独立文件，保留名称、类型和时间；失败时不交出原始引用。
export async function snapshotImageFile(file: File): Promise<File> {
  if (file.size > MAX_IMAGE_BYTES)
    throw imageDiagnosticError('selected:snapshot', file, new Error('Image is too large'))
  try {
    const bytes = await readBlobBytes(file)
    if (!bytes.byteLength || bytes.byteLength !== file.size)
      throw new Error('Image snapshot byte count mismatch')
    return new File([bytes], file.name, { type: file.type, lastModified: file.lastModified })
  } catch (error) {
    throw imageDiagnosticError('selected:snapshot', file, error)
  }
}

// 保留失败阶段和浏览器原始异常；img 的 error 事件通常不会提供底层解码原因。
export function imageDiagnosticError(stage: string, blob: Blob, error: unknown): Error {
  const reason = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  const environment = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const detail = `[${stage}] ${reason}; type=${blob.type || 'unknown'}; bytes=${blob.size}; browser=${environment}`
  const diagnostic = new Error(detail, { cause: error })
  return diagnostic
}

function validateImageDimensions(width: number, height: number): void {
  if (!width || !height) throw new Error('Image dimensions are invalid')
  if (width * height > MAX_IMAGE_PIXELS) throw new Error('Image dimensions are too large')
}

// 仅在原解码路径失败时诊断；不输出完整 Data URL，也不改变保存结果。
async function diagnoseDataUrl(blob: Blob): Promise<string> {
  let dataUrl: string
  try {
    dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      const timer = setTimeout(() => {
        reject(new Error('FileReader timeout (15000ms)'))
        reader.abort()
      }, 15000)
      const finish = () => {
        clearTimeout(timer)
        reader.onload = reader.onerror = reader.onabort = null
      }
      reader.onload = () => {
        const result = reader.result
        finish()
        if (typeof result === 'string') resolve(result)
        else reject(new Error('FileReader returned a non-string result'))
      }
      reader.onerror = () => {
        const error = reader.error ?? new Error('FileReader error without native reason')
        finish()
        reject(error)
      }
      reader.onabort = () => {
        finish()
        reject(new Error('FileReader aborted'))
      }
      try {
        reader.readAsDataURL(blob)
      } catch (error) {
        finish()
        reject(error)
      }
    })
  } catch (error) {
    return `FileReader=FAILED (${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}); DataURL=SKIPPED`
  }
  let byteReport: string
  try {
    const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
    const bytes = Uint8Array.from(binary, (value) => value.charCodeAt(0))
    const header = Array.from(bytes.slice(0, 16), (value) =>
      value.toString(16).padStart(2, '0')
    ).join('')
    byteReport = `readBytes=${bytes.length}; sizeMatch=${bytes.length === blob.size}; header=${header}; sha256=${await sha256Hex(bytes.buffer)}`
  } catch (error) {
    byteReport = `byte inspection failed: ${String(error)}`
  }
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Data URL load timeout (15000ms)')), 15000)
      image.onload = () => {
        clearTimeout(timer)
        resolve()
      }
      image.onerror = () => {
        clearTimeout(timer)
        reject(new Error('img error event (no native reason)'))
      }
      try {
        image.src = dataUrl
      } catch (error) {
        clearTimeout(timer)
        reject(error)
      }
    })
    return `FileReader=OK; ${byteReport}; DataURL=OK; dimensions=${image.naturalWidth}x${image.naturalHeight}`
  } catch (error) {
    return `FileReader=OK; ${byteReport}; DataURL=FAILED (${String(error)}); dimensions=${image.naturalWidth}x${image.naturalHeight}`
  } finally {
    image.onload = image.onerror = null
    image.removeAttribute('src')
  }
}

// 统一供转换和校验使用；部分手机浏览器能显示图片，但无法通过 ImageBitmap 解码。
async function decodeImage(blob: Blob): Promise<{
  source: CanvasImageSource
  width: number
  height: number
  release: () => void
}> {
  let bitmapFailure = 'unavailable'
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
    } catch (error) {
      bitmapFailure = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
      // 使用与图片预览一致的加载路径重试。
    }
  }

  const url = URL.createObjectURL(blob)
  const image = new Image()
  try {
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve()
      image.onerror = () =>
        reject(
          new Error(
            `Image could not be decoded; img error event (no native reason); createImageBitmap=${bitmapFailure}; complete=${image.complete}; dimensions=${image.naturalWidth}x${image.naturalHeight}`
          )
        )
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
    const diagnosis = await diagnoseDataUrl(blob)
    const reason = error instanceof Error ? error.message : String(error)
    throw imageDiagnosticError(
      'decode:img-blob-url',
      blob,
      new Error(`${reason}; ${diagnosis}`, { cause: error })
    )
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
  } catch (error) {
    imageDiagnosticError('read:arrayBuffer (retry FileReader)', file, error)
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

async function convertImageToWebpInternal(file: File): Promise<Blob> {
  if (file.size > MAX_IMAGE_BYTES) throw new Error('Image is too large')
  if (imageExtension(file.name) === 'webp' || file.type === 'image/webp') {
    let bytes: ArrayBuffer | undefined
    try {
      bytes = await readImageBytes(file)
    } catch (error) {
      imageDiagnosticError('read:webp-bytes (retry decoding)', file, error)
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
    try {
      context.drawImage(bitmap.source, 0, 0)
    } catch (error) {
      throw imageDiagnosticError('canvas:drawImage', file, error)
    }
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(
                imageDiagnosticError(
                  'canvas:toBlob',
                  file,
                  new Error('WebP conversion failed (null output)')
                )
              ),
        'image/webp',
        0.9
      )
    })
  } finally {
    bitmap.release()
  }
}

// 顶层补充文件上下文，同时保留解码、绘制、导出的阶段信息。
export async function convertImageToWebp(file: File): Promise<Blob> {
  try {
    return await convertImageToWebpInternal(file)
  } catch (error) {
    throw imageDiagnosticError('save:convertImageToWebp', file, error)
  }
}
