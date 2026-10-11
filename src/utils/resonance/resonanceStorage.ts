import type { ResonanceRecord } from './resonanceTypes'

import { openDb } from '../file-system/database'
const STORE_NAME = 'resonance-records'
const RECORDS_KEY = 'current-profile'

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
