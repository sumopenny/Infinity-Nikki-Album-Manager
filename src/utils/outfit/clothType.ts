import type { Language } from '../../i18n'

// 类型编号与暖暖相册 ClothType 枚举保持一致。
const CLOTH_TYPE_LABELS: Record<number, Record<Language, string>> = {
  10: { zh: '发型', en: 'Hair' },
  90: { zh: '连衣裙', en: 'Dresses' },
  20: { zh: '外套', en: 'Outerwear' },
  30: { zh: '上衣', en: 'Tops' },
  41: { zh: '下装', en: 'Bottoms' },
  50: { zh: '袜子', en: 'Socks' },
  60: { zh: '鞋子', en: 'Shoes' },
  71: { zh: '头饰', en: 'Hair Accessories' },
  72: { zh: '帽子', en: 'Headwear' },
  73: { zh: '耳饰', en: 'Earrings' },
  74: { zh: '颈饰', en: 'Neckwear' },
  75: { zh: '腕饰', en: 'Bracelets' },
  76: { zh: '项圈', en: 'Chokers' },
  77: { zh: '手套', en: 'Gloves' },
  78: { zh: '手持物', en: 'Handhelds' },
  79: { zh: '肤绘', en: 'Body Paint' },
  80: { zh: '全妆', en: 'Full Makeup' },
  81: { zh: '底妆', en: 'Base Makeup' },
  82: { zh: '眉妆', en: 'Eyebrows' },
  83: { zh: '睫毛', en: 'Eyelashes' },
  84: { zh: '美瞳', en: 'Contacts' },
  85: { zh: '唇妆', en: 'Lips' },
  86: { zh: '肤色', en: 'Skin Tones' },
  92: { zh: '面饰', en: 'Face Decorations' },
  93: { zh: '胸饰', en: 'Chest Accessories' },
  94: { zh: '挂饰', en: 'Pendants' },
  95: { zh: '背饰', en: 'Backpieces' },
  96: { zh: '戒指', en: 'Rings' },
  97: { zh: '臂饰', en: 'Arm Decorations' },
}

export function getClothTypeLabel(clothType: number | null, language: Language): string | null {
  return clothType === null ? null : CLOTH_TYPE_LABELS[clothType]?.[language] ?? null
}
