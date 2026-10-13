import { openDb, runStoreRequest, HOME_SCHEMES_STORE, HOME_IMAGES_STORE, HOME_TAGS_STORE } from '../file-system/database'
import { convertImageToWebp, validateImageBlob, MAX_IMAGE_BYTES } from '../image'
import { sha256Hex } from '../sha256'
import { createHomeSchemeId, normalizeHomeSchemeRecord, isValidHomeSchemeTag, normalizeHomeSchemeTag,
  MAX_HOME_SCHEME_TAGS, type HomeSchemeItem, type HomeSchemeRecord, type SaveHomeSchemeInput } from './homeSchemeTypes'

export interface HomeSchemeImage { id: string; blob: Blob; size: number; sha256: string }
export interface HomeSchemeSnapshot { records: HomeSchemeRecord[]; images: Map<string, HomeSchemeImage>; tags: string[] }

export function homeRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

/** Only IndexedDB requests may be awaited in action; file/image work runs before the transaction. */
export async function homeTransaction<T>(stores: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction | undefined
    let result: T
    let failure: unknown
    try {
      tx = db.transaction(stores, mode)
      tx.oncomplete = () => { db.close(); resolve(result) }
      tx.onabort = () => { db.close(); reject(failure ?? tx!.error ?? new Error('home_scheme_transaction_aborted')) }
      tx.onerror = () => { /* onabort reports the final failure */ }
      action(tx).then(value => { result = value }).catch(error => {
        failure = error
        try { tx!.abort() } catch { db.close(); reject(error) }
      })
    } catch (error) {
      try { tx?.abort() } catch { /* already inactive */ }
      db.close(); reject(error)
    }
  })
}

export async function prepareHomeSchemeImage(blob: Blob, id: string): Promise<HomeSchemeImage> {
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('home_scheme_image_invalid')
  const bytes = await blob.arrayBuffer()
  const signature = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength))
  if (String.fromCharCode(...signature.slice(0, 4)) !== 'RIFF' ||
      String.fromCharCode(...signature.slice(8, 12)) !== 'WEBP') throw new Error('home_scheme_image_invalid')
  await validateImageBlob(blob)
  const sha256 = await sha256Hex(bytes)
  return { id, blob: new Blob([bytes], { type: 'image/webp' }), size: bytes.byteLength, sha256 }
}

export function normalizeHomeSchemeTags(values: unknown): string[] {
  if (!Array.isArray(values)) throw new Error('home_scheme_tags_invalid')
  const tags = [...new Set(values.map(normalizeHomeSchemeTag))]
  if (tags.length > MAX_HOME_SCHEME_TAGS || tags.some(tag => !isValidHomeSchemeTag(tag))) throw new Error('home_scheme_tags_invalid')
  return tags
}

export async function readHomeSchemeSnapshot(): Promise<HomeSchemeSnapshot> {
  return homeTransaction([HOME_SCHEMES_STORE, HOME_IMAGES_STORE, HOME_TAGS_STORE], 'readonly', async tx => {
    const [rawRecords, rawImages, rawTags] = await Promise.all([
      homeRequest(tx.objectStore(HOME_SCHEMES_STORE).getAll()),
      homeRequest(tx.objectStore(HOME_IMAGES_STORE).getAll()),
      homeRequest(tx.objectStore(HOME_TAGS_STORE).get('default'))
    ])
    const records = rawRecords.map(normalizeHomeSchemeRecord).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const tags = normalizeHomeSchemeTags(rawTags ?? [])
    const images = new Map<string, HomeSchemeImage>(rawImages.map((image: HomeSchemeImage) => [image.id, image]))
    for (const record of records) {
      if (record.tags.some(tag => !tags.includes(tag))) throw new Error('home_scheme_tag_missing')
      const image = images.get(record.id)
      if (record.image && (!image?.blob || image.blob.size !== image.size || !image.size)) throw new Error('home_scheme_image_missing')
    }
    return { records, images, tags }
  })
}

function displayHomeScheme(record: HomeSchemeRecord, image?: HomeSchemeImage): HomeSchemeItem {
  return { ...record, imageUrl: record.image && image ? URL.createObjectURL(image.blob) : record.metadata.coverImageUrl }
}

export async function readHomeSchemeLibrary(): Promise<{ schemes: HomeSchemeItem[]; tags: string[] }> {
  const snapshot = await readHomeSchemeSnapshot()
  const schemes: HomeSchemeItem[] = []
  try {
    for (const record of snapshot.records) schemes.push(displayHomeScheme(record, snapshot.images.get(record.id)))
    return { schemes, tags: snapshot.tags }
  } catch (error) { releaseHomeSchemeUrls(schemes); throw error }
}

export async function countHomeSchemes(): Promise<number> {
  return runStoreRequest(HOME_SCHEMES_STORE, 'readonly', store => store.count())
}

export function releaseHomeSchemeUrls(schemes: HomeSchemeItem[]): void {
  for (const scheme of schemes) if (scheme.image && scheme.imageUrl?.startsWith('blob:')) URL.revokeObjectURL(scheme.imageUrl)
}

export async function saveHomeScheme(input: SaveHomeSchemeInput): Promise<HomeSchemeItem> {
  const prepared = input.imageFile && !input.removeImage
    ? await prepareHomeSchemeImage(await convertImageToWebp(input.imageFile), input.item?.id ?? input.id ?? createHomeSchemeId()) : null
  const saved = await homeTransaction([HOME_SCHEMES_STORE, HOME_IMAGES_STORE, HOME_TAGS_STORE], 'readwrite', async tx => {
    const records = tx.objectStore(HOME_SCHEMES_STORE), images = tx.objectStore(HOME_IMAGES_STORE)
    const tags = normalizeHomeSchemeTags(await homeRequest(tx.objectStore(HOME_TAGS_STORE).get('default')) ?? [])
    const previous = input.item ? await homeRequest(records.get(input.item.id)) as HomeSchemeRecord | undefined : undefined
    if (input.item && !previous) throw new Error('home_scheme_record_missing')
    let id = previous?.id ?? input.id ?? prepared?.id ?? createHomeSchemeId()
    if (!previous && await homeRequest(records.get(id))) id = createHomeSchemeId()
    const record = normalizeHomeSchemeRecord({ version: 1, id,
      image: input.removeImage ? null : prepared ? `${id}.webp` : previous?.image ?? null,
      code: input.code, name: input.name, schemeType: input.schemeType, metadata: input.metadata,
      tags: input.tags.map(normalizeHomeSchemeTag).filter(tag => tags.includes(tag)).slice(0, 1),
      note: input.note.trim(), createdAt: input.createdAt ?? previous?.createdAt ?? new Date().toISOString(),
      updatedAt: input.updatedAt ?? new Date().toISOString() })
    const duplicate = await homeRequest(records.index('code').get(record.code)) as HomeSchemeRecord | undefined
    if (duplicate && duplicate.id !== id) throw new Error('home_scheme_code_duplicate')
    let image = record.image ? prepared ? { ...prepared, id } : await homeRequest(images.get(id)) as HomeSchemeImage | undefined : undefined
    if (record.image && !image) throw new Error('home_scheme_image_missing')
    if (image) images.put(image)
    else images.delete(id)
    records.put(record)
    return { record, image }
  })
  return displayHomeScheme(saved.record, saved.image)
}

export async function deleteHomeScheme(item: Pick<HomeSchemeItem, 'id'>): Promise<void> {
  await homeTransaction([HOME_SCHEMES_STORE, HOME_IMAGES_STORE], 'readwrite', async tx => {
    tx.objectStore(HOME_SCHEMES_STORE).delete(item.id)
    tx.objectStore(HOME_IMAGES_STORE).delete(item.id)
  })
}

export async function saveHomeSchemeTags(values: string[]): Promise<string[]> {
  const tags = normalizeHomeSchemeTags(values)
  return homeTransaction([HOME_SCHEMES_STORE, HOME_TAGS_STORE], 'readwrite', async tx => {
    const records = await homeRequest(tx.objectStore(HOME_SCHEMES_STORE).getAll()) as HomeSchemeRecord[]
    if (records.some(record => record.tags.some(tag => !tags.includes(tag)))) throw new Error('home_scheme_tag_in_use')
    tx.objectStore(HOME_TAGS_STORE).put(tags, 'default')
    return tags
  })
}

export async function deleteHomeSchemeTag(removedTag: string): Promise<{ tags: string[]; updatedCount: number }> {
  return homeTransaction([HOME_SCHEMES_STORE, HOME_TAGS_STORE], 'readwrite', async tx => {
    const store = tx.objectStore(HOME_SCHEMES_STORE)
    const [records, rawTags] = await Promise.all([homeRequest(store.getAll()), homeRequest(tx.objectStore(HOME_TAGS_STORE).get('default'))])
    const tags = normalizeHomeSchemeTags(rawTags ?? []).filter(tag => tag !== removedTag)
    let updatedCount = 0
    for (const raw of records) {
      const record = normalizeHomeSchemeRecord(raw)
      if (!record.tags.includes(removedTag)) continue
      store.put({ ...record, tags: [], updatedAt: new Date().toISOString() })
      updatedCount++
    }
    tx.objectStore(HOME_TAGS_STORE).put(tags, 'default')
    return { tags, updatedCount }
  })
}

export async function reorderHomeSchemeTags(current: string[], reordered: string[]): Promise<string[]> {
  return homeTransaction([HOME_TAGS_STORE], 'readwrite', async tx => {
    const actual = normalizeHomeSchemeTags(await homeRequest(tx.objectStore(HOME_TAGS_STORE).get('default')) ?? [])
    if (JSON.stringify(actual) !== JSON.stringify(current) || reordered.length !== actual.length ||
        new Set(reordered).size !== actual.length || reordered.some(tag => !actual.includes(tag))) throw new Error('home_scheme_tag_order_invalid')
    tx.objectStore(HOME_TAGS_STORE).put(reordered, 'default')
    return reordered
  })
}
