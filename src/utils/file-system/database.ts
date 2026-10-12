// 所有本地数据共用升级入口，避免先打开不同模块时漏建存储。
export const DB_NAME = 'infinity-nikki-album-manager'
export const DB_VERSION = 6
export const CAMERA_FAVORITES_STORE = 'camera-favorites'
export const CAMERA_TAGS_STORE = 'camera-favorite-tags'
export const CAMERA_COVERS_STORE = 'camera-favorite-covers'

export function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      for (const name of ['album-handles', 'resonance-records', CAMERA_COVERS_STORE, CAMERA_TAGS_STORE]) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name)
      }
      const favorites = db.objectStoreNames.contains(CAMERA_FAVORITES_STORE)
        ? request.transaction!.objectStore(CAMERA_FAVORITES_STORE)
        : db.createObjectStore(CAMERA_FAVORITES_STORE, { keyPath: 'id' })
      if (!favorites.indexNames.contains('code')) favorites.createIndex('code', 'code', { unique: true })
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      resolve(db)
    }
    request.onerror = () => reject(request.error)
    request.onblocked = () => {
      reject(new Error('数据库升级被其他页面占用，请关闭本站其他标签页后重试。'))
      // 阻塞解除后请求可能仍成功，关闭无人使用的连接。
      request.onsuccess = () => request.result.close()
    }
  })
}

/** Resolve writes only after the transaction has committed. */
export async function runStoreRequest<T>(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    let request: IDBRequest<T> | undefined
    let result: T
    let tx: IDBTransaction | undefined
    try {
      tx = db.transaction(storeName, mode)
      tx.oncomplete = () => { db.close(); resolve(result) }
      tx.onabort = () => { db.close(); reject(tx?.error ?? request?.error ?? new Error('IndexedDB transaction aborted')) }
      tx.onerror = () => { /* onabort reports the final transaction failure. */ }
      request = action(tx.objectStore(storeName))
      request.onsuccess = () => { result = request!.result }
    } catch (error) {
      try { tx?.abort() } catch { /* Transaction may already be inactive. */ }
      db.close()
      reject(error)
    }
  })
}

/** Clear authorization and parser state only; user collections and resonance records are retained. */
export async function clearBrowserSessionData(): Promise<void> {
  await runStoreRequest('album-handles', 'readwrite', store => store.clear())
}
