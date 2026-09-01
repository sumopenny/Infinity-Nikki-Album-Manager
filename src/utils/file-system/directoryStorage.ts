// 目录句柄存储：使用 IndexedDB 保存和读取相册及 X6Game 目录授权句柄。
const DB_NAME = 'infinity-nikki-album-manager'
const DB_VERSION = 1
const STORE_NAME = 'album-handles'
const SAVED_DIRECTORY_KEY = 'current-album-directory'
const SAVED_X6GAME_DIRECTORY_KEY = 'current-x6game-directory'

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
