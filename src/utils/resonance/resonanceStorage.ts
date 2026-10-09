import type { ResonanceRecord } from './resonanceTypes'

const DB_NAME = 'infinity-nikki-album-manager'
// 与 directoryStorage 保持同一版本号；版本号只能递增，避免触发降级打开错误。
const DB_VERSION = 4
const STORE_NAME = 'resonance-records'
const RECORDS_KEY = 'current-profile'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('album-handles')) request.result.createObjectStore('album-handles')
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    let result: T | undefined
    try {
      const tx = db.transaction(STORE_NAME, mode)
      const request = action(tx.objectStore(STORE_NAME))
      request.onsuccess = () => { result = request.result }
      tx.oncomplete = () => { db.close(); resolve(result as T) }
      tx.onabort = () => { db.close(); reject(tx.error ?? request.error ?? new Error('IndexedDB transaction aborted')) }
      tx.onerror = () => { db.close(); reject(tx.error ?? request.error ?? new Error('IndexedDB transaction failed')) }
    } catch (error) {
      db.close()
      reject(error)
    }
  })
}

export async function loadResonanceRecords(): Promise<ResonanceRecord[]> {
  try {
    const value = await transact<unknown>('readonly', (store) => store.get(RECORDS_KEY))
    return Array.isArray(value) ? value as ResonanceRecord[] : []
  } catch {
    return []
  }
}

export async function saveResonanceRecords(records: ResonanceRecord[]): Promise<void> {
  await transact('readwrite', (store) => store.put(records, RECORDS_KEY))
}
