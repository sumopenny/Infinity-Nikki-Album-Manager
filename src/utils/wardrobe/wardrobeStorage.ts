import { openDb, runStoreRequest } from '../file-system/database'
import { loadWardrobeCatalog, type WardrobeCatalog } from './wardrobeCatalog'

// 保留旧版备份的来源字段兼容性；界面不再提供手动修改入口。
export type OwnershipSource = 'manual' | 'pearpal'
export interface Ownership {
  owned: boolean
  source: OwnershipSource
}
export interface WardrobeSnapshot {
  entries: Record<string, Ownership>
  unknownSuitIds: string[]
  updatedAt: string
  imported?: boolean
}
export const emptyWardrobe = (): WardrobeSnapshot => ({
  entries: {},
  unknownSuitIds: [],
  updatedAt: '',
  imported: false
})
const validId = (id: string) => /^[1-9]\d{0,14}$/.test(id) && Number.isSafeInteger(Number(id))

/** 文件及数据库使用相同校验；只投影衣橱字段，不保留凭据或任意附加对象。 */
export function validateWardrobe(value: unknown): WardrobeSnapshot {
  if (!value || typeof value !== 'object') throw new Error('INVALID_WARDROBE')
  const raw = value as WardrobeSnapshot
  if (
    !raw.entries ||
    typeof raw.entries !== 'object' ||
    Array.isArray(raw.entries) ||
    !Array.isArray(raw.unknownSuitIds) ||
    raw.unknownSuitIds.some((id) => typeof id !== 'string' || !validId(id)) ||
    (raw.imported !== undefined && typeof raw.imported !== 'boolean') ||
    typeof raw.updatedAt !== 'string' ||
    (raw.updatedAt !== '' && !Number.isFinite(Date.parse(raw.updatedAt)))
  )
    throw new Error('INVALID_WARDROBE')
  const entries: Record<string, Ownership> = {}
  for (const [id, entry] of Object.entries(raw.entries)) {
    if (
      !validId(id) ||
      !entry ||
      typeof entry.owned !== 'boolean' ||
      !['manual', 'pearpal'].includes(entry.source)
    )
      throw new Error('INVALID_WARDROBE')
    entries[id] = { owned: entry.owned, source: entry.source }
  }
  return {
    entries,
    unknownSuitIds: [...new Set(raw.unknownSuitIds)],
    updatedAt: raw.updatedAt,
    imported: raw.imported ?? (Object.keys(entries).length > 0 || raw.unknownSuitIds.length > 0)
  }
}
export async function loadWardrobe(): Promise<WardrobeSnapshot> {
  const value = await runStoreRequest('wardrobe', 'readonly', (store) => store.get('current'))
  const snapshot = value === undefined ? emptyWardrobe() : validateWardrobe(value)
  if (!snapshot.unknownSuitIds.length) return snapshot
  const catalog = await loadWardrobeCatalog()
  if (resolveUnknownWardrobeSuits(snapshot, catalog) === snapshot) return snapshot
  // Re-read inside the transaction so another tab's import is never overwritten.
  return updateWardrobe((latest) => resolveUnknownWardrobeSuits(latest, catalog))
}

/** 读改写位于同一事务；导入和清空整份替换时验证基线，避免覆盖其他标签页的新数据。 */
export async function updateWardrobe(
  change: (latest: WardrobeSnapshot) => WardrobeSnapshot,
  expected?: string
): Promise<WardrobeSnapshot> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('wardrobe', 'readwrite')
    const store = tx.objectStore('wardrobe')
    let result: WardrobeSnapshot
    let failure: unknown
    tx.oncomplete = () => {
      db.close()
      resolve(result)
    }
    tx.onabort = () => {
      db.close()
      reject(failure ?? tx.error)
    }
    tx.onerror = () => {
      /* 等待事务回滚后统一报告。 */
    }
    const request = store.get('current')
    request.onsuccess = () => {
      try {
        const current =
          request.result === undefined ? emptyWardrobe() : validateWardrobe(request.result)
        if (expected !== undefined && JSON.stringify(current) !== expected)
          throw new Error('WARDROBE_CHANGED')
        result = validateWardrobe(change(current))
        result.updatedAt = new Date().toISOString()
        store.put(result, 'current')
      } catch (error) {
        failure = error
        tx.abort()
      }
    }
  })
}
export function createWardrobeBackup(snapshot: WardrobeSnapshot): string {
  return JSON.stringify(
    { format: 'nikki-personal-wardrobe', version: 1, data: validateWardrobe(snapshot) },
    null,
    2
  )
}
export function parseWardrobeBackup(text: string): WardrobeSnapshot {
  const file = JSON.parse(text)
  if (file?.format !== 'nikki-personal-wardrobe' || file.version !== 1)
    throw new Error('INVALID_WARDROBE')
  return validateWardrobe(file.data)
}

/** Resolve only complete catalog mappings; retain IDs whose pieces are still unavailable. */
export function resolveUnknownWardrobeSuits(
  snapshot: WardrobeSnapshot,
  catalog: WardrobeCatalog
): WardrobeSnapshot {
  const resolvable = snapshot.unknownSuitIds.filter((id) => {
    const outfit = catalog.byId.get(id)
    return (
      outfit?.kind === 'outfit' &&
      outfit.parts.length > 0 &&
      outfit.parts.every((part) => catalog.byId.get(part)?.kind === 'item')
    )
  })
  if (!resolvable.length) return snapshot
  const resolved = new Set(resolvable)
  const entries = { ...snapshot.entries }
  for (const id of resolvable)
    for (const part of catalog.byId.get(id)!.parts)
      entries[part] = { owned: true, source: 'pearpal' }
  return {
    ...snapshot,
    entries,
    unknownSuitIds: snapshot.unknownSuitIds.filter((id) => !resolved.has(id))
  }
}

/** Merge positive ownership without allowing an older backup to revoke local ownership. */
export async function mergeWardrobe(
  incoming: WardrobeSnapshot
): Promise<{ saved: number; skipped: number }> {
  const data = validateWardrobe(incoming)
  const catalog = data.unknownSuitIds.length ? await loadWardrobeCatalog() : null
  let saved = 0,
    skipped = 0
  await updateWardrobe((latest) => {
    const entries = { ...latest.entries }
    for (const [id, entry] of Object.entries(data.entries)) {
      const existing = entries[id]
      if (!existing || (!existing.owned && entry.owned)) {
        entries[id] = entry
        saved++
      } else skipped++
    }
    const unknown = new Set(latest.unknownSuitIds)
    for (const id of data.unknownSuitIds) {
      if (unknown.has(id)) skipped++
      else {
        unknown.add(id)
        saved++
      }
    }
    const result = {
      ...latest,
      entries,
      unknownSuitIds: [...unknown],
      imported: !!latest.imported || !!data.imported
    }
    return catalog ? resolveUnknownWardrobeSuits(result, catalog) : result
  })
  return { saved, skipped }
}
