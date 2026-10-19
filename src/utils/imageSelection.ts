import { MAX_IMAGE_BYTES } from './image'

/** 先确认浏览器能实际预览，再替换旧图；不以文件类型和扩展名代替实际解码。 */
export async function validateSelectedImage(file: File): Promise<void> {
  let url: string | undefined
  const image = new Image()
  try {
    if (!file.size || file.size > MAX_IMAGE_BYTES)
      throw new Error('Image is empty or exceeds 64 MiB')
    url = URL.createObjectURL(file)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Image preview timed out (15000ms)')), 15000)
      image.onload = () => {
        clearTimeout(timer)
        if (
          !image.naturalWidth ||
          !image.naturalHeight ||
          image.naturalWidth * image.naturalHeight > 40_000_000
        )
          reject(new Error('Image dimensions are invalid or exceed 40 million pixels'))
        else resolve()
      }
      image.onerror = () => {
        clearTimeout(timer)
        reject(new Error('Browser cannot decode this image format, or image data is damaged'))
      }
      try {
        image.src = url!
      } catch (error) {
        clearTimeout(timer)
        reject(error)
      }
    })
  } finally {
    image.onload = image.onerror = null
    image.removeAttribute('src')
    if (url) URL.revokeObjectURL(url)
  }
}
