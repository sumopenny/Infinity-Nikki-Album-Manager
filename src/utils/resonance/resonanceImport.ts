import { diagnosticFetch } from '../errorReporting/diagnosticFetch'
// 奇想手账按所选区服验证角色；凭据只随当前请求发送，不进入持久化层。
import {
  buildResonanceRecords,
  loadResonanceBanners,
  normalizeBannerPulls
} from './resonanceCatalog'
import { decodePearpal } from './resonancePearpalData'
import type { ResonanceRecord } from './resonanceTypes'
import { PEARPAL_REGIONS, type PearpalRegion } from './pearpalRegions'

export interface ResonanceCredentials {
  token: string
  roleid: string
  id: string
}

export interface ResonanceImportProgress {
  current: number
  total: number
  bannerName: { zh: string; en: string }
}

export interface ResonanceImportResult {
  records: ResonanceRecord[]
  skippedPools: number
}

export const PEARPAL_UID_MISMATCH = 'Pearpal UID mismatch'
export const PEARPAL_REGION_MISMATCH = 'Pearpal region mismatch'
export const PEARPAL_AUTH_FAILED = 'Pearpal credentials could not be verified'
export const PEARPAL_NO_RECORDS = 'No supported banner pull records were found'

async function request(url: string, init?: RequestInit): Promise<Response> {
  const response = await diagnosticFetch(url, init)
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    try {
      const payload = JSON.parse(detail) as { info?: unknown; error?: unknown }
      const message =
        typeof payload.info === 'string' && payload.info ? payload.info : payload.error
      if (typeof message === 'string' && message) throw new Error(message)
    } catch (error) {
      if (error instanceof Error && error.message !== 'Unexpected end of JSON input') throw error
    }
    throw new Error(`Pearpal request failed (${response.status})`)
  }
  return response
}

async function postPearpal(
  action: 'verify' | 'snapshot',
  credentials: ResonanceCredentials,
  region: PearpalRegion,
  signal?: AbortSignal
): Promise<Response> {
  const response = await request(`/api/resonance/pearpal?action=${action}`, {
    method: 'POST',
    signal,
    cache: 'no-store',
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify({ region, token: credentials.token, openid: credentials.id })
  })
  if (response.headers.get('cache-control')?.includes('no-store') !== true) {
    // The proxy also sets this header; reject unexpected cached responses at the client boundary.
    throw new Error('Pearpal response caching is not allowed')
  }
  return response
}

/** 验证必须包含角色 UID；缺少角色时统一提示重新登录，不能把上游 OK 当成错误原因。 */
async function verifyPearpalUid(
  credentials: ResonanceCredentials,
  region: PearpalRegion,
  signal?: AbortSignal
): Promise<void> {
  const response = await postPearpal('verify', credentials, region, signal)
  const payload = (await response.json()) as {
    code?: number
    info?: string
    data?: { role?: { uid?: string | number; zone_id?: number } }
  }
  const role = payload.data?.role
  if (payload.code !== 0 || !role || role.uid === undefined || role.uid === null) {
    throw new Error(PEARPAL_AUTH_FAILED)
  }
  if (String(role.uid) !== credentials.roleid.trim()) {
    throw new Error(PEARPAL_UID_MISMATCH)
  }
  // 国服兼容旧接口缺少区服字段；国际服必须明确匹配，不能仅凭 UID 猜测区服。
  if (role.zone_id === undefined && region === 'cn') return
  if (Number(role.zone_id) !== PEARPAL_REGIONS[region].zoneId) {
    throw new Error(PEARPAL_REGION_MISMATCH)
  }
}

interface PearpalRow {
  card_pool_id?: number | string
  pool_cnt?: number | string
  result?: number | string
  rarity?: number | string
  times_from_last_five_stars?: number | string
  times_from_last_four_stars?: number | string
}

function asGachaRows(value: unknown): PearpalRow[] {
  if (Array.isArray(value))
    return value.filter((row): row is PearpalRow => Boolean(row) && typeof row === 'object')
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap((rows) =>
      Array.isArray(rows)
        ? rows.filter((row): row is PearpalRow => Boolean(row) && typeof row === 'object')
        : []
    )
  }
  return []
}

function toPullRow(row: PearpalRow) {
  return {
    itemId: String(row.result ?? ''),
    obtainedAt: '',
    poolCount: Number(row.pool_cnt),
    pullsToObtain:
      Number(row.rarity) === 5
        ? Number(row.times_from_last_five_stars ?? 0) + 1
        : Number(row.times_from_last_four_stars ?? 0) + 1
  }
}

/** 先核对所选区服的角色 UID，再解压完整手账快照，供共鸣与衣橱各自解析。 */
export async function fetchPearpalSnapshot(
  credentials: ResonanceCredentials,
  signal?: AbortSignal,
  region: PearpalRegion = 'cn'
): Promise<unknown> {
  signal?.throwIfAborted()
  await verifyPearpalUid(credentials, region, signal)
  signal?.throwIfAborted()
  const response = await postPearpal('snapshot', credentials, region, signal)
  // 登录失效时快照返回 JSON 而非 Snappy，先识别登录错误，避免显示解压异常。
  if (response.headers.get('content-type')?.includes('application/json')) {
    const payload = (await response.clone().json()) as { code?: number }
    if (payload.code === 1801) throw new Error(PEARPAL_AUTH_FAILED)
  }
  const decoded = decodePearpal(await response.arrayBuffer())
  signal?.throwIfAborted()
  return decoded
}

/** 共鸣与衣橱共用验证及解压入口；衣橱不要求手账含有共鸣记录。 */
export async function importFromPearpal(
  credentials: ResonanceCredentials,
  onProgress?: (value: ResonanceImportProgress) => void,
  signal?: AbortSignal,
  region: PearpalRegion = 'cn'
): Promise<ResonanceImportResult> {
  const decoded = (await fetchPearpalSnapshot(credentials, signal, region)) as {
    info_from_self?: { gacha_list?: unknown }
  }
  return parsePearpalResonance(decoded, onProgress, signal)
}

/** 从已获取的完整手账解析共鸣，与衣橱共享一次网络请求。 */
export function parsePearpalResonance(
  decoded: { info_from_self?: { gacha_list?: unknown } },
  onProgress?: (value: ResonanceImportProgress) => void,
  signal?: AbortSignal
): ResonanceImportResult {
  signal?.throwIfAborted()
  const gachaList = asGachaRows(decoded?.info_from_self?.gacha_list)
  if (!gachaList.length) throw new Error(PEARPAL_NO_RECORDS)

  const byBanner = new Map<string, PearpalRow[]>()
  for (const row of gachaList) {
    const bannerId = String(row.card_pool_id ?? '')
    const poolCount = Number(row.pool_cnt)
    if (!/^\d+$/.test(bannerId) || !Number.isFinite(poolCount) || poolCount < 0) continue
    const list = byBanner.get(bannerId) ?? []
    list.push(row)
    byBanner.set(bannerId, list)
  }

  const banners = loadResonanceBanners()
  const targets = banners.filter((banner) => byBanner.has(banner.bannerId))
  const records: ResonanceRecord[] = []
  let skippedPools = 0
  targets.forEach((banner, index) => {
    onProgress?.({ current: index + 1, total: targets.length, bannerName: banner.name })
    try {
      // pool_cnt 越小越早；归一化器接收最新记录优先的顺序。
      const rows = [...(byBanner.get(banner.bannerId) ?? [])].sort(
        (a, b) => Number(b.pool_cnt) - Number(a.pool_cnt)
      )
      const pulls = normalizeBannerPulls(banner.bannerId, rows.map(toPullRow))
      const bannerRecords = buildResonanceRecords(banner.bannerId, pulls)
      if (!bannerRecords.length) skippedPools += 1
      records.push(...bannerRecords)
    } catch {
      skippedPools += 1
    }
  })

  if (!records.length) throw new Error(PEARPAL_NO_RECORDS)
  return { records, skippedPools }
}
