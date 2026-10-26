/** 解析结果独立于翻译文案，供界面和诊断使用同一组错误码。 */
export class PhotoParseError extends Error {
  readonly codes: readonly string[]
  constructor(codes: readonly string[]) {
    const unique = [...new Set(codes.length ? codes : ['photo_parse_failed'])]
    super(unique.join('; '))
    this.name = 'PhotoParseError'
    this.codes = Object.freeze(unique)
  }
}

export function isExpectedPhotoInputError(error: unknown): boolean {
  return (
    error instanceof PhotoParseError &&
    error.codes.every((code) =>
      ['jpeg_second_end_marker_missing', 'photo_structure_invalid', 'base64_invalid'].includes(code)
    )
  )
}

export function needsOriginalPhotoHint(codes: readonly string[]): boolean {
  return codes.some((code) => ['jpeg_second_end_marker_missing', 'base64_invalid'].includes(code))
}
