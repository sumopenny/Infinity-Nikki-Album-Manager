import {
  HOME_SCHEMES_STORE,
  HOME_IMAGES_STORE,
  HOME_TAGS_STORE,
  HOME_MIGRATION_SOURCES_STORE,
  HOME_MIGRATION_ENTRIES_STORE,
  runStoreRequest
} from '../file-system/database'
import {
  homeRequest,
  homeTransaction,
  normalizeHomeSchemeTags,
  prepareHomeSchemeImage,
  type HomeSchemeImage
} from './homeSchemeStorage'
import {
  createHomeSchemeId,
  normalizeHomeSchemeRecord,
  MAX_HOME_SCHEME_TAGS,
  type HomeSchemeRecord
} from './homeSchemeTypes'
import { sha256Hex } from '../sha256'

interface MigrationSource {
  id: string
  directory: FileSystemDirectoryHandle
  processedTags: string[]
}
export interface HomeSchemeMigrationResult {
  addedCount: number
  replacedCount: number
  skippedCount: number
  failedCount: number
  tagsChanged: boolean
  homeDirectoryRemoved: boolean
  failures: { fileName: string; message: string; errorName: string }[]
}

function isMissing(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

function sameRecord(left: HomeSchemeRecord, right: HomeSchemeRecord): boolean {
  const content = (record: HomeSchemeRecord) => ({
    ...record,
    id: '',
    image: Boolean(record.image)
  })
  return JSON.stringify(content(left)) === JSON.stringify(content(right))
}

async function homeFileFingerprint(file: Blob): Promise<string> {
  return sha256Hex(await file.arrayBuffer())
}

interface DirectorySnapshotEntry {
  kind: FileSystemHandleKind
  fingerprint: string
}
async function snapshotHomeDirectory(
  directory: FileSystemDirectoryHandle
): Promise<Map<string, DirectorySnapshotEntry>> {
  const entries = new Map<string, DirectorySnapshotEntry>()
  for await (const [name, handle] of directory.entries()) {
    let fingerprint = ''
    if (handle.kind === 'file' && /\.(json|webp)$/.test(name)) {
      const file = await (await directory.getFileHandle(name)).getFile()
      fingerprint = await homeFileFingerprint(file)
    }
    entries.set(name, { kind: handle.kind, fingerprint })
  }
  return entries
}

async function removeMigratedHomeDirectory(
  album: FileSystemDirectoryHandle,
  directory: FileSystemDirectoryHandle,
  snapshot: Map<string, DirectorySnapshotEntry>,
  sourceId: string,
  fileNames: string[]
): Promise<void> {
  const allowed = new Set(['tags.json', ...fileNames])
  for (const name of fileNames) {
    const record = normalizeHomeSchemeRecord(
      JSON.parse(await (await directory.getFileHandle(name)).getFile().then((file) => file.text()))
    )
    if (record.image) allowed.add(record.image)
  }
  for (const [name, entry] of snapshot) {
    if (entry.kind !== 'file' || !allowed.has(name))
      throw new Error('home_scheme_cleanup_unmigrated_content')
  }
  await homeTransaction([HOME_MIGRATION_ENTRIES_STORE], 'readonly', async (tx) => {
    for (const fileName of fileNames) {
      const marker = await homeRequest(
        tx.objectStore(HOME_MIGRATION_ENTRIES_STORE).get([sourceId, fileName])
      )
      if (!marker) throw new Error('home_scheme_cleanup_incomplete')
      if (
        (marker.fingerprint && marker.fingerprint !== snapshot.get(fileName)?.fingerprint) ||
        (marker.image &&
          snapshot.has(marker.image) &&
          marker.imageFingerprint !== snapshot.get(marker.image)?.fingerprint)
      ) {
        throw new Error('home_scheme_cleanup_unmigrated_content')
      }
    }
  })
  const current = await album.getDirectoryHandle('home')
  if (!(await current.isSameEntry(directory)))
    throw new Error('home_scheme_cleanup_directory_changed')
  const latest = await snapshotHomeDirectory(current)
  if (
    latest.size !== snapshot.size ||
    [...latest].some(
      ([name, entry]) =>
        !snapshot.has(name) ||
        snapshot.get(name)!.kind !== entry.kind ||
        snapshot.get(name)!.fingerprint !== entry.fingerprint
    )
  ) {
    throw new Error('home_scheme_cleanup_directory_changed')
  }
  // All database writes have committed, all contents are accounted for, and the directory is unchanged.
  await album.removeEntry('home', { recursive: true })
}

async function migrate(album: FileSystemDirectoryHandle): Promise<HomeSchemeMigrationResult> {
  const result: HomeSchemeMigrationResult = {
    addedCount: 0,
    replacedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    tagsChanged: false,
    homeDirectoryRemoved: false,
    failures: []
  }
  const failed = (fileName: string, error: unknown) => {
    result.failedCount++
    result.failures.push({
      fileName,
      message: error instanceof Error ? error.message : String(error),
      errorName: error instanceof Error ? error.name : ''
    })
  }
  let directory: FileSystemDirectoryHandle
  try {
    directory = await album.getDirectoryHandle('home')
  } catch (error) {
    if (!isMissing(error)) failed('home', error)
    return result
  }
  const snapshot = await snapshotHomeDirectory(directory)

  let source: MigrationSource | undefined
  const sources: MigrationSource[] = await runStoreRequest(
    HOME_MIGRATION_SOURCES_STORE,
    'readonly',
    (store) => store.getAll()
  )
  for (const candidate of sources) {
    if (await directory.isSameEntry(candidate.directory)) {
      source = candidate
      break
    }
  }
  source ??= { id: createHomeSchemeId(), directory, processedTags: [] }
  let legacyTags: string[]
  try {
    try {
      legacyTags = normalizeHomeSchemeTags(
        JSON.parse(
          await (await directory.getFileHandle('tags.json')).getFile().then((file) => file.text())
        )
      )
    } catch (error) {
      if (!isMissing(error)) throw error
      legacyTags = []
    }
    const tagState = await homeTransaction(
      [HOME_TAGS_STORE, HOME_MIGRATION_SOURCES_STORE],
      'readwrite',
      async (tx) => {
        const sourceStore = tx.objectStore(HOME_MIGRATION_SOURCES_STORE)
        const current = (await homeRequest(sourceStore.get(source!.id))) as
          MigrationSource | undefined
        const next = current ?? source!
        const tags = normalizeHomeSchemeTags(
          (await homeRequest(tx.objectStore(HOME_TAGS_STORE).get('default'))) ?? []
        )
        const previousTags = [...tags]
        const processedTags = [...next.processedTags]
        for (const tag of legacyTags) {
          if (processedTags.includes(tag)) continue
          if (!tags.includes(tag) && tags.length >= MAX_HOME_SCHEME_TAGS) continue
          if (!tags.includes(tag)) tags.push(tag)
          processedTags.push(tag)
        }
        tx.objectStore(HOME_TAGS_STORE).put(tags, 'default')
        const saved = { ...next, processedTags }
        sourceStore.put(saved)
        return { source: saved, tagsChanged: JSON.stringify(previousTags) !== JSON.stringify(tags) }
      }
    )
    source = tagState.source
    result.tagsChanged = tagState.tagsChanged
  } catch (error) {
    failed('tags.json', error)
    return result
  }

  const fileNames: string[] = []
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'file' && name.endsWith('.json') && name !== 'tags.json')
      fileNames.push(name)
  }
  // Stable order also makes duplicate codes within one legacy directory deterministic.
  fileNames.sort()
  const sourceId = source.id
  for (const fileName of fileNames) {
    const key = [sourceId, fileName]
    const processed = await runStoreRequest(HOME_MIGRATION_ENTRIES_STORE, 'readonly', (store) =>
      store.get(key)
    )
    if (processed) continue
    try {
      const sourceFile = await (await directory.getFileHandle(fileName)).getFile()
      const raw = JSON.parse(await sourceFile.text())
      const fingerprint = await homeFileFingerprint(sourceFile)
      const record = normalizeHomeSchemeRecord(raw)
      if (fileName !== `${record.id}.json`) throw new Error('home_scheme_record_id_invalid')
      if (record.tags.some((tag) => !legacyTags.includes(tag)))
        throw new Error('home_scheme_tag_missing')
      if (record.tags.some((tag) => !source!.processedTags.includes(tag)))
        throw new Error('home_scheme_tag_limit')
      const image = record.image
        ? await prepareHomeSchemeImage(
            await (await directory.getFileHandle(record.image)).getFile(),
            record.id
          )
        : null
      const outcome = await homeTransaction(
        [HOME_SCHEMES_STORE, HOME_IMAGES_STORE, HOME_TAGS_STORE, HOME_MIGRATION_ENTRIES_STORE],
        'readwrite',
        async (tx) => {
          const markers = tx.objectStore(HOME_MIGRATION_ENTRIES_STORE)
          if (await homeRequest(markers.get(key))) return 'processed'
          const records = tx.objectStore(HOME_SCHEMES_STORE),
            images = tx.objectStore(HOME_IMAGES_STORE)
          const tags = normalizeHomeSchemeTags(
            (await homeRequest(tx.objectStore(HOME_TAGS_STORE).get('default'))) ?? []
          )
          const existing = (await homeRequest(records.index('code').get(record.code))) as
            HomeSchemeRecord | undefined
          let id = existing?.id ?? record.id
          if (!existing && (await homeRequest(records.get(id)))) id = createHomeSchemeId()
          const incoming = {
            ...record,
            id,
            image: image ? `${id}.webp` : null,
            tags: record.tags.filter((tag) => tags.includes(tag))
          }
          const oldImage = existing?.image
            ? ((await homeRequest(images.get(id))) as HomeSchemeImage | undefined)
            : undefined
          const identical =
            existing &&
            sameRecord(normalizeHomeSchemeRecord(existing), incoming) &&
            (image
              ? oldImage?.sha256 === image.sha256 && oldImage.size === image.size
              : !existing.image)
          if (!identical) {
            records.put(incoming)
            if (image) images.put({ ...image, id })
            else images.delete(id)
          }
          markers.put({
            sourceId,
            fileName,
            targetId: id,
            fingerprint,
            image: record.image,
            imageFingerprint: image?.sha256 ?? null,
            processedAt: new Date().toISOString()
          })
          return identical ? 'skipped' : existing ? 'replaced' : 'added'
        }
      )
      if (outcome === 'added') result.addedCount++
      else if (outcome === 'replaced') result.replacedCount++
      else if (outcome === 'skipped') result.skippedCount++
    } catch (error) {
      failed(fileName, error)
    }
  }
  // Report unused tags that could not fit too; their state remains retryable.
  const overflow = legacyTags.filter((tag) => !source!.processedTags.includes(tag))
  if (overflow.length)
    failed('tags.json', new Error('home_scheme_tag_limit: ' + overflow.join('、')))
  if (!result.failedCount) {
    try {
      await removeMigratedHomeDirectory(album, directory, snapshot, sourceId, fileNames)
      result.homeDirectoryRemoved = true
    } catch (error) {
      failed('home', error)
    }
  }
  return result
}

let pending: Promise<unknown> = Promise.resolve()
export function migrateHomeSchemeLibrary(
  album: FileSystemDirectoryHandle
): Promise<HomeSchemeMigrationResult> {
  const action = () =>
    typeof navigator !== 'undefined' && navigator.locks
      ? navigator.locks.request('infinity-nikki-home-migration', () => migrate(album))
      : migrate(album)
  const next = pending.then(action, action)
  pending = next.catch(() => undefined)
  return next
}
