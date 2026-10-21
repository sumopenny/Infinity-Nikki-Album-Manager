/** 国服与国际服共用手账协议；前后端仅按此白名单选择上游，不接受用户指定域名。 */
const CN = {
  site: 'https://myl.nuanpaper.com',
  home: 'https://myl.nuanpaper.com/home',
  api: 'https://myl-api.nuanpaper.com',
  clientId: 1106
} as const
const GLOBAL = {
  site: 'https://pearpal.infoldgames.com',
  home: 'https://pearpal.infoldgames.com/en/home',
  api: 'https://pearpal-api.infoldgames.com',
  clientId: 1116
} as const

export const PEARPAL_REGIONS = {
  cn: { ...CN, zoneId: 1, name: { zh: '国服', en: 'China' } },
  asia: { ...GLOBAL, zoneId: 4, name: { zh: '国际服·亚服', en: 'Global · Asia' } },
  america: { ...GLOBAL, zoneId: 6, name: { zh: '国际服·美服', en: 'Global · America' } },
  europe: { ...GLOBAL, zoneId: 2, name: { zh: '国际服·欧服', en: 'Global · Europe' } },
  tw: { ...GLOBAL, zoneId: 8, name: { zh: '国际服·台港澳', en: 'Global · Taiwan/Hong Kong/Macao' } }
} as const

export type PearpalRegion = keyof typeof PEARPAL_REGIONS

export function isPearpalRegion(value: unknown): value is PearpalRegion {
  return typeof value === 'string' && Object.hasOwn(PEARPAL_REGIONS, value)
}
