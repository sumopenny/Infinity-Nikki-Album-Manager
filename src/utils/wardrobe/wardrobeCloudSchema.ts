import {
  hasWardrobeSnapshot,
  validateWardrobe,
  wardrobeBaseline,
  type WardrobeSnapshot,
  type WardrobeRegionScope
} from './wardrobeSchema'
import { wardrobeRegionScope } from './wardrobeRegion'

export const MAX_WARDROBE_BYTES = 8 * 1024 * 1024
export const MAX_WARDROBE_ENTRIES = 50000
export const MAX_WARDROBE_SUITS = 10000
export interface WardrobeCloudSummary {
  entryCount: number
  ownedCount: number
  unknownSuitCount: number
  regionScope: WardrobeRegionScope
  sourceUpdatedAt: string
}
export interface WardrobeCloudHead {
  revision: number
  updated_at: number
  active_snapshot: string | null
  summary: WardrobeCloudSummary | null
}
export interface WardrobeCloudSnapshot extends WardrobeCloudHead {
  schemaVersion: 1
  data: WardrobeSnapshot | null
}
export interface WardrobeCloudWrite {
  requestId: string
  revision: number
  schemaVersion?: 1
  data?: WardrobeSnapshot
}

/** 前后端共用；补齐旧区服的副本不能替代本地预览基线。 */
export function normalizeCloudWardrobe(value: unknown): WardrobeSnapshot {
  let data: WardrobeSnapshot
  try {
    data = validateWardrobe(value)
  } catch {
    throw new Error('INVALID_DATA')
  }
  if (!hasWardrobeSnapshot(data)) throw new Error('EMPTY_LOCAL')
  if (
    Object.keys(data.entries).length > MAX_WARDROBE_ENTRIES ||
    data.unknownSuitIds.length > MAX_WARDROBE_SUITS
  )
    throw new Error('TOO_LARGE')
  data.regionScope = wardrobeRegionScope(data)
  const serialized = wardrobeBaseline(data)
  if (new TextEncoder().encode(serialized).length > MAX_WARDROBE_BYTES) throw new Error('TOO_LARGE')
  return JSON.parse(serialized) as WardrobeSnapshot
}

export function summarizeWardrobe(data: WardrobeSnapshot): WardrobeCloudSummary {
  const entries = Object.values(data.entries)
  return {
    entryCount: entries.length,
    ownedCount: entries.filter((entry) => entry.owned).length,
    unknownSuitCount: data.unknownSuitIds.length,
    regionScope: wardrobeRegionScope(data),
    sourceUpdatedAt: data.updatedAt
  }
}

const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) >= 0
/** 无存档与损坏响应严格区分，避免把协议错误解释为可清空的数据。 */
export function validateWardrobeCloudHead(value: unknown): asserts value is WardrobeCloudHead {
  if (!value || typeof value !== 'object') throw new Error('INVALID_DATA')
  const head = value as WardrobeCloudHead
  if (!integer(head.revision) || !integer(head.updated_at)) throw new Error('INVALID_DATA')
  if (head.active_snapshot === null) {
    if (head.summary !== null) throw new Error('INVALID_DATA')
    return
  }
  const summary = head.summary
  if (
    typeof head.active_snapshot !== 'string' ||
    !head.active_snapshot ||
    !summary ||
    !integer(summary.entryCount) ||
    !integer(summary.ownedCount) ||
    !integer(summary.unknownSuitCount) ||
    summary.ownedCount > summary.entryCount ||
    summary.entryCount > MAX_WARDROBE_ENTRIES ||
    summary.unknownSuitCount > MAX_WARDROBE_SUITS ||
    !['cn', 'global'].includes(summary.regionScope) ||
    typeof summary.sourceUpdatedAt !== 'string' ||
    (summary.sourceUpdatedAt !== '' && !Number.isFinite(Date.parse(summary.sourceUpdatedAt)))
  )
    throw new Error('INVALID_DATA')
}

export function validateWardrobeCloudSnapshot(value: unknown): WardrobeCloudSnapshot {
  validateWardrobeCloudHead(value)
  const snapshot = value as WardrobeCloudSnapshot
  if (snapshot.schemaVersion !== 1) throw new Error('UNSUPPORTED_SCHEMA')
  if (!snapshot.active_snapshot) {
    if (snapshot.data !== null) throw new Error('INVALID_DATA')
    return snapshot
  }
  const data = normalizeCloudWardrobe(snapshot.data)
  const summary = summarizeWardrobe(data)
  if (
    Object.entries(summary).some(
      ([key, v]) => snapshot.summary?.[key as keyof WardrobeCloudSummary] !== v
    )
  )
    throw new Error('INVALID_DATA')
  return { ...snapshot, data }
}
