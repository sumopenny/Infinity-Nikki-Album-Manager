/** Only known archive validation errors become user-facing text. */
export function outfitBackupMessage(error: unknown, language: 'zh' | 'en'): string | null {
  if (!(error instanceof Error)) return null
  const message = error.message
  const zh = language === 'zh'
  if (message === 'Backup manifest is missing' || message === 'Unsupported backup format')
    return zh
      ? '这不是受支持的搭配码备份，请选择从“搭配码备份”导出的 ZIP 文件。'
      : 'This is not a supported outfit backup. Select a ZIP exported from Outfit Backup.'
  if (
    message === 'Backup is too large' ||
    message === 'Expanded backup is too large' ||
    message === 'Backup image is too large'
  )
    return zh
      ? '搭配码备份过大，请检查文件是否为完整的搭配码备份。'
      : 'The outfit backup is too large. Check that you selected an outfit backup.'
  if (
    message === 'Backup is missing an outfit image' ||
    message === 'outfit_image_format_mismatch' ||
    message.startsWith('Image ') ||
    message === 'Browser cannot decode this image format, or image data is damaged'
  )
    return zh
      ? '备份中的图片缺失、损坏或格式不受支持，请重新导出备份。'
      : 'A backup image is missing, damaged, or unsupported. Export the backup again.'
  if (
    message === 'Backup contains duplicate entries' ||
    message === 'Backup contains too many files' ||
    message === 'Backup contains an unsafe path' ||
    message === 'Backup contains an unsupported file' ||
    message === 'Backup contains invalid outfit metadata' ||
    message === 'outfit_ignored_codes_invalid' ||
    error instanceof SyntaxError
  )
    return zh
      ? '搭配码备份结构不完整或已损坏，请重新导出备份。'
      : 'The outfit backup is incomplete or damaged. Export it again.'
  return null
}
