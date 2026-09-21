const WEATHER_NAMES: Record<string, { zh: string; en: string }> = {
  '0': { zh: '晴天', en: 'Sunny' },
  '2': { zh: '雨天', en: 'Rainy' },
  '4': { zh: '彩虹', en: 'Rainbow' },
  '7': { zh: '星海', en: 'Sea of Stars' }
}

/** 将照片中的 WeatherType 枚举转换为可读名称，未知值保留原始编号。 */
export function weatherName(value: unknown, language: 'zh' | 'en'): string {
  const key = String(value)
  return WEATHER_NAMES[key]?.[language] ?? `WeatherType ${key}`
}
