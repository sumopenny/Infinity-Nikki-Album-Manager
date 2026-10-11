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
