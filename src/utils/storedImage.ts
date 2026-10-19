import { convertImageToWebp, MAX_IMAGE_BYTES, validateImageBlob } from './image'

export const STORED_IMAGE_EXTENSIONS = ['webp', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'avif']

/** 根据文件头恢复真实类型；扩展名和传入 MIME 均不能替代内容校验。 */
export async function inspectStoredImage(blob: Blob, decode = true) {
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('Image size is invalid')
  const bytes = await blob.arrayBuffer()
  const head = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 64))
  const text = (start: number, end: number) => String.fromCharCode(...head.slice(start, end))
  let extension: string
  if (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') extension = 'webp'
  else if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => head[i] === v)) extension = 'png'
  else if (head[0] === 255 && head[1] === 216 && head[2] === 255) extension = 'jpg'
  else if (['GIF87a', 'GIF89a'].includes(text(0, 6))) extension = 'gif'
  else if (text(0, 2) === 'BM') extension = 'bmp'
  else if (
    text(4, 8) === 'ftyp' &&
    (['avif', 'avis'].includes(text(8, 12)) ||
      Array.from({ length: Math.max(0, Math.floor((head.length - 16) / 4)) }, (_, i) =>
        text(16 + i * 4, 20 + i * 4)
      ).includes('avif'))
  )
    extension = 'avif'
  else throw new Error('Image signature is unsupported or invalid')
  const normalized = new Blob([bytes], {
    type: extension === 'jpg' ? 'image/jpeg' : `image/${extension}`
  })
  if (decode) await validateImageBlob(normalized)
  return { blob: normalized, extension, bytes }
}

export function matchesStoredImageExtension(path: string, extension: string): boolean {
  const suffix = path.split('.').pop()?.toLowerCase()
  return suffix === extension || (suffix === 'jpeg' && extension === 'jpg')
}

/** 原生编码优先；编码失败时校验并保留原始字节，不保存浏览器意外输出的 PNG。 */
export async function convertImageForStorage(file: File): Promise<Blob> {
  try {
    const output = await convertImageToWebp(file)
    const checked = await inspectStoredImage(output, false)
    if (checked.extension === 'webp') return checked.blob
  } catch {
    // 原生编码不可用时继续校验原图；成功回退不作为错误提示。
  }
  return (await inspectStoredImage(file)).blob
}
