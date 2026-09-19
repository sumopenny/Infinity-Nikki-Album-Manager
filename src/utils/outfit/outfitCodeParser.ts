// 搭配码解析:规范化搭配码、调用上游解析 API,并把原始数据清洗为部件 ID 列表与染色数据。
// 解析 API 由暖暖相册(nikki.ranaxro.com)友情提供,已开放跨域访问。
const LOOKBOOK_API_BASE_URL = 'https://api-nikki.ranaxro.com/conv-clothdiydata'
const LOOKBOOK_CODE_PATTERN = /^[A-Za-z0-9]{11}#$/
const LOOKBOOK_REQUEST_TIMEOUT_MS = 10000
const SKIN_TONE_CLOTH_TYPE = 86
const IGNORED_LOOKBOOK_ITEM_IDS = new Set([
  1021860042, 1022860042, 1023860042, 1020860231,
])

export type LookbookParseError = 'invalid' | 'unavailable'

export class OutfitCodeParseError extends Error {
  readonly kind: LookbookParseError

  constructor(kind: LookbookParseError, message: string) {
    super(message)
    this.name = 'OutfitCodeParseError'
    this.kind = kind
  }
}

export interface LookbookDyeSwatch {
  targetGroupId: number
  featureTag: number
  paletteId: number
  slot: number | null
  color: string
}

export interface LookbookDyeItem {
  itemId: number
  outfitId: number | null
  dyes: LookbookDyeSwatch[]
}

export interface LookbookDecodeResult {
  code: string
  wearingClothes: number[]
  dyeItems: LookbookDyeItem[]
}

type LookbookPayload = {
  clothes?: Array<{
    cloth?: {
      id?: unknown
      outfit?: unknown
      cloth_type?: unknown
    }
    diy?: unknown
  }>
}

type DyeColorPayload = {
  rgba?: unknown
  color_grid?: unknown
}

/** 规范化搭配码:支持直接粘贴分享链接,11 位编码自动补 # 结尾;不合法返回空串。 */
export function normalizeLookbookCode(value: unknown): string {
  const raw = Array.isArray(value) ? value[0] : value
  let code = typeof raw === 'string' ? raw.trim() : ''
  if (!code) return ''

  try {
    const url = new URL(code, window.location.origin)
    const urlCode = url.searchParams.get('code')?.trim() ?? ''
    if (urlCode) code = urlCode
  } catch {
    // 不是合法 URL 时按原始码处理。
  }

  if (/^[A-Za-z0-9]{11}$/.test(code)) code = `${code}#`
  return LOOKBOOK_CODE_PATTERN.test(code) ? code : ''
}

const isIgnoredLookbookCloth = (cloth: { id?: unknown; cloth_type?: unknown }) => {
  const clothType = Number(cloth.cloth_type)
  const id = Number(cloth.id)
  return (
    clothType === SKIN_TONE_CLOTH_TYPE ||
    (Number.isSafeInteger(id) && IGNORED_LOOKBOOK_ITEM_IDS.has(id))
  )
}

/** 游戏返回的 rgba 处于线性色彩空间,需先转为 sRGB 再输出 hex。 */
const linearChannelToSrgb = (value: number) => {
  const channel = Math.max(0, Math.min(1, value))
  return channel <= 0.0031308 ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055
}

const rgbaToHex = (value: unknown) => {
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    value.slice(0, 3).some((channel) => !Number.isFinite(Number(channel)))
  ) {
    return null
  }
  return `#${value
    .slice(0, 3)
    .map((channel) =>
      Math.round(linearChannelToSrgb(Number(channel)) * 255)
        .toString(16)
        .padStart(2, '0')
    )
    .join('')}`
}

const normalizeDyeSwatch = (
  value: unknown,
  targetGroupId: number,
  featureTag: number
): LookbookDyeSwatch | null => {
  if (!value || typeof value !== 'object') return null
  const color = value as DyeColorPayload
  const colorGrid = Number(color.color_grid)
  const hex = rgbaToHex(color.rgba)
  if (!Number.isInteger(colorGrid) || !hex) return null

  return {
    targetGroupId,
    featureTag,
    paletteId: colorGrid < 0 ? -1 : Math.ceil(colorGrid / 8),
    slot: colorGrid < 0 ? null : colorGrid % 8 || 8,
    color: hex,
  }
}

const normalizeDyes = (value: unknown): LookbookDyeSwatch[] => {
  if (!value || typeof value !== 'object') return []
  const outfitDye = (value as { outfit_dye?: unknown }).outfit_dye
  if (!Array.isArray(outfitDye)) return []

  return outfitDye
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const general = (entry as { General?: unknown }).General
      const hair = (entry as { Hair?: unknown }).Hair
      const dye = general ?? hair
      if (!dye || typeof dye !== 'object') return null

      const targetGroupId = Number((dye as { target_group_id?: unknown }).target_group_id)
      const featureTag = Number((dye as { feature_tag?: unknown }).feature_tag)
      if (!Number.isInteger(targetGroupId) || !Number.isInteger(featureTag)) return null

      const color = general
        ? (dye as { color?: unknown }).color
        : (dye as { color_0?: unknown }).color_0
      return normalizeDyeSwatch(color, targetGroupId, featureTag)
    })
    .filter((dye): dye is LookbookDyeSwatch => dye !== null)
}

const normalizeClothes = (value: unknown): LookbookDecodeResult | null => {
  if (!Array.isArray(value)) return null
  const clothes = value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const cloth = (entry as { cloth?: unknown }).cloth
      if (!cloth || typeof cloth !== 'object') return null
      if (isIgnoredLookbookCloth(cloth)) return null

      const id = Number((cloth as { id?: unknown }).id)
      if (!Number.isSafeInteger(id) || id <= 0) return null

      const outfitId = Number((cloth as { outfit?: unknown }).outfit)
      return {
        itemId: id,
        outfitId: Number.isSafeInteger(outfitId) && outfitId > 0 ? outfitId : null,
        dyes: normalizeDyes((entry as { diy?: unknown }).diy),
      }
    })
    .filter((cloth): cloth is LookbookDyeItem => cloth !== null)

  return {
    code: '',
    wearingClothes: clothes.map((cloth) => cloth.itemId),
    dyeItems: clothes.filter((cloth) => cloth.dyes.length > 0),
  }
}

/** 请求上游解析 API 并清洗数据;失败时抛 OutfitCodeParseError 标记错误类型。 */
export async function parseOutfitCode(rawCode: string): Promise<LookbookDecodeResult> {
  const code = normalizeLookbookCode(rawCode)
  if (!code) throw new OutfitCodeParseError('invalid', `Invalid lookbook code: ${rawCode}`)

  let response: Response
  try {
    response = await fetch(`${LOOKBOOK_API_BASE_URL}?${encodeURIComponent(code)}`, {
      signal: AbortSignal.timeout(LOOKBOOK_REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json' },
    })
  } catch (error) {
    throw new OutfitCodeParseError(
      'unavailable',
      `Lookbook request failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '')
    const codeRejected =
      response.status === 404 ||
      response.status === 400 ||
      (response.status === 502 && bodyText.trim() === 'Upstream API error: 404')
    throw new OutfitCodeParseError(
      codeRejected ? 'invalid' : 'unavailable',
      `Lookbook upstream failed with ${response.status}`
    )
  }

  let payload: LookbookPayload
  try {
    payload = (await response.json()) as LookbookPayload
  } catch {
    throw new OutfitCodeParseError('unavailable', 'Lookbook upstream returned malformed JSON')
  }

  const result = normalizeClothes(payload.clothes)
  if (!result) {
    throw new OutfitCodeParseError('unavailable', 'Lookbook upstream response is missing clothes')
  }
  return { ...result, code }
}
