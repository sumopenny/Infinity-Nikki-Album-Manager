import { THUMBNAIL_MODE_OPTIONS } from '../types/thumbnail'
// 国际化入口：汇总中文和英文语言包，提供 messages、默认语言、缩略图选项和公共导出。
import type { ThumbnailMode } from '../types/thumbnail'
import type { Language, LocaleMessages } from './types'
import { en } from './en'
import { zh } from './zh'
export type { OutfitMessages } from './messages/outfit'

export * from './types'
export { zh } from './zh'
export { en } from './en'
export const DEFAULT_LANGUAGE: Language = 'zh'
export function getThumbnailModeOptions(
  _language: Language
): Array<{ value: ThumbnailMode; label: string }> {
  return THUMBNAIL_MODE_OPTIONS.map((option) => ({ ...option }))
}

export const messages: Record<Language, LocaleMessages> = { zh, en }
