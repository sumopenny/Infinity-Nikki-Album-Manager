import { outfitMessages } from '../../src/i18n/messages/outfit'
import type { Language } from '../../src/i18n/types'

export function getOutfitMessages(language: Language) {
  return outfitMessages[language]
}
