import { openDb } from './file-system/database'
import { parsePearpalResonance, PEARPAL_NO_RECORDS } from './resonance/resonanceImport'
import { parseResonanceFile } from './resonance/resonanceFile'
import type { ResonanceRecord } from './resonance/resonanceTypes'
import { loadWardrobeCatalog } from './wardrobe/wardrobeCatalog'
import { parseWardrobePearpal } from './wardrobe/wardrobeImport'
import {
  emptyWardrobe,
  parseWardrobeBackup,
  validateWardrobe,
  type WardrobeSnapshot
} from './wardrobe/wardrobeStorage'

export interface DataPreview {
  resonance: ResonanceRecord[] | null
  wardrobe: WardrobeSnapshot | null
  skippedPools: number
}

/** 两种备份仅启用自身模块；原始手账分别解析，缺失的数据不可用于清空另一模块。 */
export async function parseDataPreview(value: unknown): Promise<DataPreview> {
  const raw = value as {
    format?: string
    info_from_self?: { suit_list?: unknown; gacha_list?: unknown }
    info_from_gm?: { clothes?: unknown }
  } | null
  if (!raw || typeof raw !== 'object') throw new Error('INVALID_IMPORT')
  const result: DataPreview = { resonance: null, wardrobe: null, skippedPools: 0 }
  if (raw.format === 'nikki-personal-wardrobe') {
    result.wardrobe = parseWardrobeBackup(JSON.stringify(raw))
    return result
  }
  if (raw.format || !('info_from_self' in raw || 'info_from_gm' in raw)) {
    const parsed = parseResonanceFile(raw, true)
    result.resonance = parsed.records
    result.skippedPools = parsed.skippedPools
    return result
  }
  // 单独的共鸣清单不能证明完整衣橱；至少需要手账套装或直接服装字段。
  if (Array.isArray(raw.info_from_self?.suit_list) || Array.isArray(raw.info_from_gm?.clothes)) {
    result.wardrobe = parseWardrobePearpal(raw, await loadWardrobeCatalog()).snapshot
  }
  if (raw.info_from_self?.gacha_list) {
    try {
      const parsed = parsePearpalResonance(raw)
      result.resonance = parsed.records
      result.skippedPools = parsed.skippedPools
    } catch (error) {
      if (!(error instanceof Error) || error.message !== PEARPAL_NO_RECORDS) throw error
    }
  }
  if (result.resonance === null && result.wardrobe === null) throw new Error('NO_IMPORT_DATA')
  return result
}

/** 选中的模块在同一事务内校验预览基线并替换，任一失败均回滚，未勾选模块不读写。 */
export async function saveDataImport(
  data: DataPreview,
  selected: { resonance: boolean; wardrobe: boolean },
  base: { resonance: string; wardrobe: string }
): Promise<void> {
  const resonance = selected.resonance ? data.resonance : null
  const wardrobe = selected.wardrobe ? data.wardrobe : null
  const jobs: {
    store: 'resonance-records' | 'wardrobe'
    key: string
    expected: string
    value: unknown
    empty: unknown
  }[] = []
  if (resonance !== null)
    jobs.push({
      store: 'resonance-records',
      key: 'current-profile',
      expected: base.resonance,
      value: structuredClone(resonance),
      empty: []
    })
  if (wardrobe !== null)
    jobs.push({
      store: 'wardrobe',
      key: 'current',
      expected: base.wardrobe,
      value: { ...validateWardrobe(wardrobe), updatedAt: new Date().toISOString() },
      empty: emptyWardrobe()
    })
  if (!jobs.length) throw new Error('NO_SELECTION')
  const db = await openDb()
  return new Promise((resolve, reject) => {
    let failure: unknown
    let tx: IDBTransaction
    try {
      tx = db.transaction(
        jobs.map((job) => job.store),
        'readwrite'
      )
    } catch (error) {
      db.close()
      reject(error)
      return
    }
    tx.oncomplete = () => {
      db.close()
      resolve()
    }
    tx.onabort = () => {
      db.close()
      reject(failure ?? tx.error)
    }
    tx.onerror = () => {
      /* 等待事务回滚后报告。 */
    }
    for (const job of jobs) {
      const store = tx.objectStore(job.store)
      const request = store.get(job.key)
      request.onsuccess = () => {
        try {
          const current =
            request.result === undefined
              ? job.empty
              : job.store === 'wardrobe'
                ? validateWardrobe(request.result)
                : request.result
          if (JSON.stringify(current) !== job.expected) throw new Error('LOCAL_CHANGED')
          store.put(job.value, job.key)
        } catch (error) {
          failure = error
          tx.abort()
        }
      }
    }
  })
}
