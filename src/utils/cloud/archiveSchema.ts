import { validateCloudRecords } from '../resonance/cloudSchema'
import type { CloudSnapshot } from '../resonance/cloudClient'
import type { ResonanceRecord } from '../resonance/resonanceTypes'
import {
  normalizeCloudWardrobe,
  validateWardrobeCloudHead,
  validateWardrobeCloudSnapshot,
  type WardrobeCloudHead,
  type WardrobeCloudSnapshot
} from '../wardrobe/wardrobeCloudSchema'
import type { WardrobeSnapshot } from '../wardrobe/wardrobeSchema'

export const archiveModules = ['resonance', 'wardrobe'] as const
export type ArchiveModule = (typeof archiveModules)[number]
export type ArchiveAction = 'upload' | 'download' | 'delete'
export interface ArchiveHead {
  resonance: { revision: number; updated_at: number; active_snapshot: string | null; count: number }
  wardrobe: WardrobeCloudHead
}
export interface ArchiveSnapshot {
  resonance?: CloudSnapshot
  wardrobe?: WardrobeCloudSnapshot
}
export interface ArchiveLocal {
  resonance: ResonanceRecord[]
  wardrobe: WardrobeSnapshot
}
export interface ArchiveWrite {
  requestId: string
  modules: {
    resonance?: { revision: number; records?: ResonanceRecord[] }
    wardrobe?: { revision: number; data?: WardrobeSnapshot }
  }
}
const integer = (v: unknown) =>
  Number.isSafeInteger(v) && Number(v) >= 0 && Number(v) < Number.MAX_SAFE_INTEGER
export function validateArchiveHead(value: unknown): asserts value is ArchiveHead {
  const head = value as ArchiveHead
  const r = head?.resonance
  if (
    !r ||
    !integer(r.revision) ||
    !integer(r.updated_at) ||
    !integer(r.count) ||
    !(
      r.active_snapshot === null ||
      (typeof r.active_snapshot === 'string' && r.active_snapshot.length > 0)
    ) ||
    (r.active_snapshot === null && r.count !== 0)
  )
    throw new Error('INVALID_DATA')
  validateWardrobeCloudHead(head.wardrobe)
}
export function validateArchiveSnapshot(
  value: unknown,
  selected: ArchiveModule[]
): ArchiveSnapshot {
  const snapshot = value as ArchiveSnapshot
  if (!snapshot || typeof snapshot !== 'object') throw new Error('INVALID_DATA')
  if (selected.includes('resonance')) {
    const r = snapshot.resonance
    if (
      !r ||
      !integer(r.revision) ||
      !integer(r.updated_at) ||
      !Array.isArray(r.records) ||
      !(
        r.active_snapshot === null ||
        (typeof r.active_snapshot === 'string' && r.active_snapshot.length > 0)
      ) ||
      (r.active_snapshot === null && r.records.length > 0)
    )
      throw new Error('INVALID_DATA')
    if (r.active_snapshot) validateCloudRecords(r.records)
  }
  if (selected.includes('wardrobe')) validateWardrobeCloudSnapshot(snapshot.wardrobe)
  return snapshot
}
/** 只接受明确选中的模块；在任何暂存写入前完成两份负载的验证。 */
export function validateArchiveWrite(value: unknown, deleting: boolean): ArchiveWrite {
  const body = value as ArchiveWrite
  if (
    !body ||
    typeof body.requestId !== 'string' ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.requestId) ||
    !body.modules ||
    typeof body.modules !== 'object' ||
    Array.isArray(body.modules) ||
    !Object.keys(body.modules).length ||
    Object.keys(body.modules).some((k) => !archiveModules.includes(k as ArchiveModule))
  )
    throw new Error('INVALID_DATA')
  const modules: ArchiveWrite['modules'] = {}
  if ('resonance' in body.modules) {
    const r = body.modules.resonance
    if (!r || !integer(r.revision)) throw new Error('INVALID_DATA')
    if (!deleting) {
      if (!r.records?.length) throw new Error('EMPTY_LOCAL')
      validateCloudRecords(r.records)
    }
    modules.resonance = { revision: r.revision, ...(!deleting ? { records: r.records } : {}) }
  }
  if ('wardrobe' in body.modules) {
    const w = body.modules.wardrobe
    if (!w || !integer(w.revision)) throw new Error('INVALID_DATA')
    modules.wardrobe = {
      revision: w.revision,
      ...(!deleting ? { data: normalizeCloudWardrobe(w.data) } : {})
    }
  }
  return { requestId: body.requestId, modules }
}
