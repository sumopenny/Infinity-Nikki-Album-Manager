import { openDb, runStoreRequest, OUTFITS_STORE, OUTFIT_IMAGES_STORE, OUTFIT_TAGS_STORE, OUTFIT_IGNORED_CODES_STORE } from '../file-system/database'
import { convertImageToWebp, MAX_IMAGE_BYTES, validateImageBlob } from '../image'
import { displayOutfit } from './outfitImageLoader'
import { sha256Hex } from '../sha256'
import { createOutfitId, DEFAULT_OUTFIT_TAGS, DuplicateOutfitCodeError, normalizeOutfitCode, normalizeOutfitRecord,
  normalizeOutfitTagList, type OutfitRecord, type OutfitItem, type SaveOutfitInput, type OutfitDeleteResult } from './outfitTypes'

export interface OutfitImage { id: string; blob: Blob; size: number; sha256: string }
export interface OutfitSnapshot { records: OutfitRecord[]; images: Map<string, OutfitImage>; tags: string[]; ignoredCodes: string[] }
export function outfitRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
}

/** Only await IndexedDB requests inside action; decode/hash/file work precedes the transaction. */
export async function outfitTransaction<T>(stores: string[], mode: IDBTransactionMode, action: (tx: IDBTransaction) => Promise<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    let tx: IDBTransaction | undefined, result: T, failure: unknown
    try {
      tx = db.transaction(stores, mode)
      tx.oncomplete = () => { db.close(); resolve(result) }
      tx.onabort = () => { db.close(); const error = failure ?? tx!.error; reject(error instanceof DOMException && error.name === 'ConstraintError' ? new DuplicateOutfitCodeError() : error ?? new Error('outfit_transaction_aborted')) }
      tx.onerror = () => { /* Abort reports final failure. */ }
      action(tx).then(value => { result = value }).catch(error => { failure = error; try { tx!.abort() } catch { db.close(); reject(error) } })
    } catch (error) { try { tx?.abort() } catch { /* Already inactive. */ } db.close(); reject(error) }
  })
}
export async function hashOutfitBlob(blob: Blob): Promise<string> {
  return sha256Hex(await blob.arrayBuffer())
}
export async function prepareOutfitImage(blob: Blob, id: string, decode = true): Promise<OutfitImage> {
  if (!blob.size || blob.size > MAX_IMAGE_BYTES) throw new Error('outfit_image_invalid')
  const bytes = await blob.arrayBuffer(), signature = new Uint8Array(bytes, 0, Math.min(12, bytes.byteLength))
  if (String.fromCharCode(...signature.slice(0, 4)) !== 'RIFF' || String.fromCharCode(...signature.slice(8, 12)) !== 'WEBP') throw new Error('outfit_image_invalid')
  if (decode) await validateImageBlob(blob)
  return { id, blob: new Blob([bytes], { type: 'image/webp' }), size: bytes.byteLength, sha256: await hashOutfitBlob(blob) }
}
export async function initializeOutfitTags(): Promise<void> {
  await outfitTransaction([OUTFIT_TAGS_STORE], 'readwrite', async tx => {
    const store = tx.objectStore(OUTFIT_TAGS_STORE)
    if (await outfitRequest(store.get('default')) === undefined) store.put([...DEFAULT_OUTFIT_TAGS], 'default')
  })
}
export async function readOutfitImage(id: string): Promise<Blob> {
  const image = await runStoreRequest<OutfitImage | undefined>(OUTFIT_IMAGES_STORE, 'readonly', store => store.get(id))
  if (!image?.blob || !image.size || image.blob.size !== image.size) throw new Error('outfit_image_missing')
  return image.blob
}
export async function readOutfitRecords(): Promise<{ records: OutfitRecord[]; tags: string[]; sizes: Map<string, number> }> {
  await initializeOutfitTags()
  return outfitTransaction([OUTFITS_STORE, OUTFIT_IMAGES_STORE, OUTFIT_TAGS_STORE], 'readonly', async tx => {
    const [rawRecords, rawTags, imageKeys] = await Promise.all([outfitRequest(tx.objectStore(OUTFITS_STORE).getAll()),
      outfitRequest(tx.objectStore(OUTFIT_TAGS_STORE).get('default')), outfitRequest(tx.objectStore(OUTFIT_IMAGES_STORE).getAllKeys())])
    const records = rawRecords.map(normalizeOutfitRecord).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    const tags = normalizeOutfitTagList(rawTags), sizes = new Map<string, number>(), availableImages = new Set(imageKeys)
    for (const record of records) {
      if (record.tags.some(tag => !tags.includes(tag))) throw new Error('outfit_tag_missing')
      if (!availableImages.has(record.id)) throw new Error('outfit_image_missing')
      sizes.set(record.id, record.imageSize ?? 0)
    }
    return { records, tags, sizes }
  })
}
export async function readOutfitCollection(): Promise<{ outfits: OutfitItem[]; tags: string[] }> {
  const { records, tags, sizes } = await readOutfitRecords()
  return { outfits: records.map(record => displayOutfit(record, sizes.get(record.id)!, () => readOutfitImage(record.id))), tags }
}
export async function readOutfitSnapshot(): Promise<OutfitSnapshot> {
  await initializeOutfitTags()
  return outfitTransaction([OUTFITS_STORE, OUTFIT_IMAGES_STORE, OUTFIT_TAGS_STORE, OUTFIT_IGNORED_CODES_STORE], 'readonly', async tx => {
    const [raw, images, tags, ignored] = await Promise.all([outfitRequest(tx.objectStore(OUTFITS_STORE).getAll()), outfitRequest(tx.objectStore(OUTFIT_IMAGES_STORE).getAll()),
      outfitRequest(tx.objectStore(OUTFIT_TAGS_STORE).get('default')), outfitRequest(tx.objectStore(OUTFIT_IGNORED_CODES_STORE).getAllKeys())])
    const records = raw.map(normalizeOutfitRecord).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    const imageMap = new Map<string, OutfitImage>(images.map((image: OutfitImage) => [image.id, image]))
    const normalizedTags = normalizeOutfitTagList(tags)
    for (const record of records) {
      const image = imageMap.get(record.id)
      if (!image?.blob || !image.size || image.size !== image.blob.size) throw new Error('outfit_image_missing')
      if (record.tags.some(tag => !normalizedTags.includes(tag))) throw new Error('outfit_tag_missing')
    }
    return { records, images: imageMap, tags: normalizedTags, ignoredCodes: ignored.map(String) }
  })
}
export async function saveOutfit(input: SaveOutfitInput): Promise<OutfitItem> {
  if (!input.outfit && !input.imageFile) throw new Error('outfit_image_required')
  const prepared = input.imageFile ? await prepareOutfitImage(await convertImageToWebp(input.imageFile), input.outfit?.id ?? createOutfitId(), false) : null
  await initializeOutfitTags()
  const saved = await outfitTransaction([OUTFITS_STORE, OUTFIT_IMAGES_STORE, OUTFIT_TAGS_STORE, OUTFIT_IGNORED_CODES_STORE], 'readwrite', async tx => {
    const records = tx.objectStore(OUTFITS_STORE), images = tx.objectStore(OUTFIT_IMAGES_STORE)
    const previous = input.outfit ? await outfitRequest(records.get(input.outfit.id)) as OutfitRecord | undefined : undefined
    if (input.outfit && (!previous || JSON.stringify(normalizeOutfitRecord(previous)) !== JSON.stringify(normalizeOutfitRecord(input.outfit)))) throw new Error('outfit_record_changed')
    const id = previous?.id ?? prepared!.id
    const code = normalizeOutfitCode(input.code)
    const duplicate = code ? await outfitRequest(records.index('code').get(code)) as OutfitRecord | undefined : undefined
    if (duplicate && duplicate.id !== id) throw new DuplicateOutfitCodeError()
    const tags = normalizeOutfitTagList(await outfitRequest(tx.objectStore(OUTFIT_TAGS_STORE).get('default')))
    const tag = input.tag?.trim()
    if (tag && !tags.includes(tag)) throw new Error('outfit_tag_missing')
    const record = normalizeOutfitRecord({ ...previous, version: 1, id, image: `${id}.webp`, imageSize: prepared?.size ?? previous?.imageSize, code, tags: tag ? [tag] : [], note: input.note?.trim() ?? '',
      createdAt: previous?.createdAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() })
    const image = prepared ? { ...prepared, id } : await outfitRequest(images.get(id)) as OutfitImage | undefined
    if (!image?.blob || image.size !== image.blob.size) throw new Error('outfit_image_missing')
    records.put(record); if (prepared) images.put(image)
    if (code) tx.objectStore(OUTFIT_IGNORED_CODES_STORE).delete(code)
    return { record, size: image.size }
  })
  return displayOutfit(saved.record, saved.size, () => readOutfitImage(saved.record.id))
}
export async function saveOutfitTags(values: string[], expected?: string[]): Promise<string[]> {
  const tags = normalizeOutfitTagList(values)
  return outfitTransaction([OUTFITS_STORE, OUTFIT_TAGS_STORE], 'readwrite', async tx => {
    if (expected && JSON.stringify(await outfitRequest(tx.objectStore(OUTFIT_TAGS_STORE).get('default'))) !== JSON.stringify(expected)) throw new Error('outfit_tags_changed')
    const records = await outfitRequest(tx.objectStore(OUTFITS_STORE).getAll()) as OutfitRecord[]
    if (records.some(record => record.tags.some(tag => !tags.includes(tag)))) throw new Error('outfit_tag_in_use')
    tx.objectStore(OUTFIT_TAGS_STORE).put(tags, 'default'); return tags
  })
}
export async function deleteOutfitTag(removedTag: string): Promise<{ tags: string[]; updatedCount: number }> {
  return outfitTransaction([OUTFITS_STORE, OUTFIT_TAGS_STORE], 'readwrite', async tx => {
    const store = tx.objectStore(OUTFITS_STORE)
    const [records, rawTags] = await Promise.all([outfitRequest(store.getAll()), outfitRequest(tx.objectStore(OUTFIT_TAGS_STORE).get('default'))])
    const tags = normalizeOutfitTagList(rawTags).filter(tag => tag !== removedTag)
    let updatedCount = 0
    for (const raw of records) { const record = normalizeOutfitRecord(raw); if (!record.tags.includes(removedTag)) continue
      store.put({ ...record, tags: [], updatedAt: new Date().toISOString() }); updatedCount++ }
    tx.objectStore(OUTFIT_TAGS_STORE).put(tags, 'default'); return { tags, updatedCount }
  })
}
export async function deleteOutfits(outfits: OutfitItem[]): Promise<OutfitDeleteResult> {
  return outfitTransaction([OUTFITS_STORE, OUTFIT_IMAGES_STORE, OUTFIT_IGNORED_CODES_STORE], 'readwrite', async tx => {
    const records = tx.objectStore(OUTFITS_STORE), deleted: OutfitItem[] = [], failedNames: string[] = []
    for (const item of outfits) {
      const current = await outfitRequest(records.get(item.id)) as OutfitRecord | undefined
      if (!current || JSON.stringify(normalizeOutfitRecord(current)) !== JSON.stringify(normalizeOutfitRecord(item))) { failedNames.push(item.code || item.name); continue }
      records.delete(item.id); tx.objectStore(OUTFIT_IMAGES_STORE).delete(item.id)
      if (current.code) tx.objectStore(OUTFIT_IGNORED_CODES_STORE).put({ code: current.code, deletedAt: new Date().toISOString() })
      deleted.push(item)
    }
    return { deleted, failedNames }
  })
}
export async function deleteOutfit(item: OutfitItem): Promise<void> {
  const result = await deleteOutfits([item]); if (result.failedNames.length) throw new Error('outfit_record_changed')
}

let pending: Promise<unknown> = Promise.resolve()
export function withOutfitImportLock<T>(action: () => Promise<T>): Promise<T> {
  const run = () => typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('infinity-nikki-outfit-import', action) : action()
  const next = pending.then(run, run); pending = next.catch(() => undefined); return next
}
