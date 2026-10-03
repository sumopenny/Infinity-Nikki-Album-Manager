// 目录句柄存储：使用 IndexedDB 保存和读取相册及 X6Game 目录授权句柄。
const DB_NAME = 'infinity-nikki-album-manager'
const DB_VERSION = 1
const STORE_NAME = 'album-handles'
const SAVED_DIRECTORY_KEY = 'current-album-directory'
const SAVED_X6GAME_DIRECTORY_KEY = 'current-x6game-directory'
const SAVED_CAMERA_PARAM_UIDS_KEY = 'current-camera-param-uids'
const OUTFIT_PARSE_CACHE_KEY_PREFIX = 'outfit-code-parse:'
// 特效染色标记的解析结果格式发生变化，避免继续命中旧版 IndexedDB 数据。
const OUTFIT_PARSE_CACHE_VERSION = 'v2:'
const HOME_SCHEME_PARSE_CACHE_KEY_PREFIX = 'home-scheme-parse:'
const PHOTO_ACTION_CACHE_KEY_PREFIX = 'photo-action-parse:v1:'

export interface PhotoActionCacheEntry {
  fingerprint: string
  parserVersion: string
  catalogVersion: string
  status: 'action' | 'none' | 'unparsed'
  actionId?: string
  actionName?: string
  actionImageUrl?: string
  errorCode?: string
  parsedAt: number
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode)
    const request = action(tx.objectStore(STORE_NAME))
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => db.close()
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function saveAlbumDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await transaction('readwrite', (store) => store.put(handle, SAVED_DIRECTORY_KEY))
}

export async function saveX6GameDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  await transaction('readwrite', (store) => store.put(handle, SAVED_X6GAME_DIRECTORY_KEY))
}

export async function getSavedAlbumDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try { return await transaction('readonly', (store) => store.get(SAVED_DIRECTORY_KEY)) } catch { return null }
}

export async function clearSavedAlbumDirectoryHandle(): Promise<void> {
  await transaction('readwrite', (store) => store.delete(SAVED_DIRECTORY_KEY))
}

export async function getSavedX6GameDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try { return await transaction('readonly', (store) => store.get(SAVED_X6GAME_DIRECTORY_KEY)) } catch { return null }
}

export async function clearSavedX6GameDirectoryHandle(): Promise<void> {
  await transaction('readwrite', (store) => store.delete(SAVED_X6GAME_DIRECTORY_KEY))
}

export async function getSavedCameraParamUids(): Promise<string[]> {
  try {
    const value = await transaction('readonly', (store) => store.get(SAVED_CAMERA_PARAM_UIDS_KEY))
    return Array.isArray(value) ? value.filter((uid): uid is string => typeof uid === 'string' && uid.trim().length > 0) : []
  } catch { return [] }
}

export async function addSavedCameraParamUid(uid: string): Promise<void> {
  const normalized = uid.trim()
  if (!normalized) return
  const current = await getSavedCameraParamUids()
  if (current.includes(normalized)) return
  await transaction('readwrite', (store) => store.put([...current, normalized], SAVED_CAMERA_PARAM_UIDS_KEY))
}

export async function clearSavedCameraParamUids(): Promise<void> {
  await transaction('readwrite', (store) => store.delete(SAVED_CAMERA_PARAM_UIDS_KEY))
}

export async function getSavedOutfitParseResult(code: string): Promise<unknown> {
  return transaction('readonly', (store) => store.get(`${OUTFIT_PARSE_CACHE_KEY_PREFIX}${OUTFIT_PARSE_CACHE_VERSION}${code}`))
}

function photoActionCacheKey(albumKey: string, photoKey: string): string {
  return `${PHOTO_ACTION_CACHE_KEY_PREFIX}${encodeURIComponent(albumKey)}:${encodeURIComponent(photoKey)}`
}

export async function getSavedPhotoActionCache(albumKey: string, photoKey: string): Promise<PhotoActionCacheEntry | null> {
  try {
    const value = await transaction('readonly', (store) => store.get(photoActionCacheKey(albumKey, photoKey)))
    return value && typeof value === 'object' ? value as PhotoActionCacheEntry : null
  } catch { return null }
}

export async function savePhotoActionCache(albumKey: string, photoKey: string, entry: PhotoActionCacheEntry): Promise<void> {
  await transaction('readwrite', (store) => store.put(entry, photoActionCacheKey(albumKey, photoKey)))
}

export async function clearSavedPhotoActionCache(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAllKeys()
    request.onsuccess = () => {
      for (const key of request.result) {
        if (typeof key === 'string' && key.startsWith(PHOTO_ACTION_CACHE_KEY_PREFIX)) store.delete(key)
      }
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  })
}

export async function saveOutfitParseResult(code: string, result: unknown): Promise<void> {
  await transaction('readwrite', (store) => store.put(result, `${OUTFIT_PARSE_CACHE_KEY_PREFIX}${OUTFIT_PARSE_CACHE_VERSION}${code}`))
}

export async function clearSavedOutfitParseResults(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAllKeys()
    request.onsuccess = () => {
      for (const key of request.result) {
        if (typeof key === 'string' && key.startsWith(OUTFIT_PARSE_CACHE_KEY_PREFIX)) store.delete(key)
      }
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  })
}

export async function getSavedHomeSchemeParseResult(code: string): Promise<unknown> {
  return transaction('readonly', (store) => store.get(`${HOME_SCHEME_PARSE_CACHE_KEY_PREFIX}${code}`))
}

export async function saveHomeSchemeParseResult(code: string, result: unknown): Promise<void> {
  await transaction('readwrite', (store) => store.put(result, `${HOME_SCHEME_PARSE_CACHE_KEY_PREFIX}${code}`))
}

/** 仅删除家园方案解析缓存，不触碰相册授权句柄、搭配码缓存或方案文件。 */
export async function clearSavedHomeSchemeParseResults(): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    const store = tx.objectStore(STORE_NAME)
    const request = store.getAllKeys()
    request.onsuccess = () => {
      for (const key of request.result) {
        if (typeof key === 'string' && key.startsWith(HOME_SCHEME_PARSE_CACHE_KEY_PREFIX)) store.delete(key)
      }
    }
    request.onerror = () => reject(request.error)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
    tx.onabort = () => { db.close(); reject(tx.error) }
  })
}
