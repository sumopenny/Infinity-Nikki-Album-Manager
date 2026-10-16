import { openDb, runStoreRequest } from '../file-system/database'

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
}
export const emptyWardrobe = (): WardrobeSnapshot => ({
  entries: {},
  unknownSuitIds: [],
  updatedAt: ''
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
  return { entries, unknownSuitIds: [...new Set(raw.unknownSuitIds)], updatedAt: raw.updatedAt }
}
export async function loadWardrobe(): Promise<WardrobeSnapshot> {
  const value = await runStoreRequest('wardrobe', 'readonly', (store) => store.get('current'))
  return value === undefined ? emptyWardrobe() : validateWardrobe(value)
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
