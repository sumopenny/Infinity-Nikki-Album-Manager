import type { ResonanceRecord } from './resonanceTypes'

import { runStoreRequest } from '../file-system/database'
const STORE_NAME = 'resonance-records'
const RECORDS_KEY = 'current-profile'

function transact<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return runStoreRequest(STORE_NAME, mode, action)
}

export async function loadResonanceRecords(): Promise<ResonanceRecord[]> {
  const value = await transact<unknown>('readonly', (store) => store.get(RECORDS_KEY))
  if (value === undefined) return []
  if (!Array.isArray(value)) throw new Error('Invalid resonance storage')
  return value as ResonanceRecord[]
}

export async function saveResonanceRecords(records: ResonanceRecord[]): Promise<void> {
  await transact('readwrite', (store) => store.put(records, RECORDS_KEY))
}
