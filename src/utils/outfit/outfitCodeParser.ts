// 搭配码解析：在本地 WASM 还原对象路径编号，再通过同源代理读取原始搭配数据。
import {
  clearSavedOutfitParseResults,
  getSavedOutfitParseResult,
  saveOutfitParseResult
} from '../file-system/directoryStorage'
import {
  decodeLookbookPayload,
  decodeLookbookShareCodePathId
} from './lookbookWasmClient'

const LOOKBOOK_DATA_PROXY_BASE_URL = '/api/outfit-code'
const LOOKBOOK_CODE_PATTERN = /^[A-Za-z0-9]{11}#$/
const LOOKBOOK_REQUEST_TIMEOUT_MS = 10000

const parsedResultCache = new Map<string, LookbookDecodeResult>()
const pendingParseRequests = new Map<string, Promise<LookbookDecodeResult>>()

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
  clothType: number | null
  outfitId: number | null
  dyes: LookbookDyeSwatch[]
  hasSpecialEffect: boolean
}

export interface LookbookCloth {
  itemId: number
  clothType: number | null
  outfitId: number | null
}

export interface LookbookDecodeResult {
  code: string
  wearingClothes: LookbookCloth[]
  dyeItems: LookbookDyeItem[]
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

const isCachedParseResult = (value: unknown, code: string): value is LookbookDecodeResult => {
  if (!value || typeof value !== 'object') return false
  const result = value as Partial<LookbookDecodeResult>
  if (result.code !== code || !Array.isArray(result.wearingClothes) || !Array.isArray(result.dyeItems)) return false
  return result.wearingClothes.every((cloth) => (
    cloth && typeof cloth === 'object' &&
    Number.isSafeInteger(cloth.itemId) && cloth.itemId > 0 &&
    (cloth.clothType === null || Number.isInteger(cloth.clothType)) &&
    (cloth.outfitId === null || (Number.isSafeInteger(cloth.outfitId) && cloth.outfitId > 0))
  )) && result.dyeItems.every((item) => (
    item && typeof item === 'object' &&
    Number.isSafeInteger(item.itemId) && item.itemId > 0 &&
    Array.isArray(item.dyes) && item.dyes.every((dye) => (
      dye && typeof dye === 'object' &&
      Number.isInteger(dye.targetGroupId) && Number.isInteger(dye.featureTag) &&
      Number.isInteger(dye.paletteId) &&
      (dye.slot === null || Number.isInteger(dye.slot)) && typeof dye.color === 'string'
    )) && typeof item.hasSpecialEffect === 'boolean'
  ))
}

/** 请求对象存储代理，并调用浏览器 WASM 归一化搭配数据。 */
async function requestLookbookParse(code: string): Promise<LookbookDecodeResult> {
  let pathId: string | null
  try {
    pathId = await decodeLookbookShareCodePathId(code)
  } catch (error) {
    throw new OutfitCodeParseError(
      'unavailable',
      'Lookbook WASM share-code decoding failed: ' + (error instanceof Error ? error.message : String(error))
    )
  }
  if (!pathId) {
    throw new OutfitCodeParseError('invalid', 'Invalid lookbook code: ' + code)
  }

  let response: Response
  try {
    response = await fetch(LOOKBOOK_DATA_PROXY_BASE_URL + '/' + pathId, {
      signal: AbortSignal.timeout(LOOKBOOK_REQUEST_TIMEOUT_MS),
      headers: { Accept: 'application/json, application/octet-stream' },
    })
  } catch (error) {
    throw new OutfitCodeParseError(
      'unavailable',
      `Lookbook request failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (!response.ok) {
    const codeRejected = response.status === 404 || response.status === 400
    throw new OutfitCodeParseError(
      codeRejected ? 'invalid' : 'unavailable',
      `Lookbook object request failed with ${response.status}`
    )
  }

  let payload: string
  try {
    payload = await response.text()
  } catch {
    throw new OutfitCodeParseError('unavailable', 'Lookbook upstream response could not be read')
  }

  let decoded
  try {
    decoded = await decodeLookbookPayload<LookbookDecodeResult>(code, payload)
  } catch (error) {
    throw new OutfitCodeParseError(
      'unavailable',
      `Lookbook WASM normalization failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
  if (!decoded.ok) {
    const message = decoded.errorCode === 'json_invalid'
      ? 'Lookbook upstream returned malformed JSON'
      : decoded.errorCode === 'clothes_missing'
        ? 'Lookbook upstream response is missing clothes'
        : `Lookbook upstream response could not be normalized (${decoded.errorCode})`
    throw new OutfitCodeParseError('unavailable', message)
  }
  return decoded.value
}

/** 解析搭配码；成功结果持久化到 IndexedDB，存储不可用时回退到在线请求。 */
export async function parseOutfitCode(rawCode: string): Promise<LookbookDecodeResult> {
  const code = normalizeLookbookCode(rawCode)
  if (!code) throw new OutfitCodeParseError('invalid', `Invalid lookbook code: ${rawCode}`)

  const memoryCached = parsedResultCache.get(code)
  if (memoryCached) return memoryCached

  const pending = pendingParseRequests.get(code)
  if (pending) return pending

  const request = (async () => {
    try {
      const stored = await getSavedOutfitParseResult(code)
      if (isCachedParseResult(stored, code)) {
        parsedResultCache.set(code, stored)
        return stored
      }
    } catch {
      // IndexedDB 不可用时继续请求上游解析服务。
    }

    const result = await requestLookbookParse(code)
    parsedResultCache.set(code, result)
    try { await saveOutfitParseResult(code, result) } catch {
      // 持久化失败不影响本次已成功的解析结果。
    }
    return result
  })()
  pendingParseRequests.set(code, request)
  try {
    return await request
  } finally {
    pendingParseRequests.delete(code)
  }
}

export async function clearOutfitCodeParseCache(): Promise<void> {
  parsedResultCache.clear()
  pendingParseRequests.clear()
  try { await clearSavedOutfitParseResults() } catch {
    // 浏览器不支持 IndexedDB 时无需阻断清理流程。
  }
}
