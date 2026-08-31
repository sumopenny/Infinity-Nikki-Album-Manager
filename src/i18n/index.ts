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
const thumbnailModeValues: ThumbnailMode[] = ['default', 'half', 'wide', 'standard', 'portrait-wide', 'portrait-standard']

const thumbnailModeLabels: Record<Language, Record<ThumbnailMode, string>> = {
  zh: {
    default: '默认 1:1',
    half: '半尺寸 1:1',
    wide: '16:9',
    standard: '4:3',
    'portrait-wide': '9:16',
    'portrait-standard': '3:4'
  },
  en: {
    default: 'Default 1:1',
    half: 'Half 1:1',
    wide: '16:9',
    standard: '4:3',
    'portrait-wide': '9:16',
    'portrait-standard': '3:4'
  }
}

export function getThumbnailModeOptions(language: Language): Array<{ value: ThumbnailMode; label: string }> {
  return thumbnailModeValues.map((value) => ({ value, label: thumbnailModeLabels[language][value] }))
}


export const messages: Record<Language, LocaleMessages> = { zh, en }
