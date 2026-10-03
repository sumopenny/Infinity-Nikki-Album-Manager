import { ref, type Ref } from 'vue'
import type { Language } from '../i18n'
import type { PhotoActionInfo, PhotoItem } from '../utils/photoGrouping'
import { getSavedPhotoActionCache, savePhotoActionCache, type PhotoActionCacheEntry } from '../utils/file-system/directoryStorage'
import { parsePhotoAction, photoActionFingerprint, PHOTO_ACTION_PARSER_VERSION } from '../utils/photo-params/photoActionParser'
import { PHOTO_ACTION_CATALOG_VERSION } from '../utils/photo-params/resourceManifest'
import { runWithConcurrency } from '../utils/concurrency'

export interface PhotoActionParseProgress {
  running: boolean
  completed: number
  total: number
  failed: number
}

function toInfo(entry: PhotoActionCacheEntry): PhotoActionInfo {
  return {
    status: entry.status,
    actionId: entry.actionId,
    actionName: entry.actionName,
    actionImageUrl: entry.actionImageUrl,
    errorCode: entry.errorCode,
    fingerprint: entry.fingerprint,
    parsedAt: entry.parsedAt
  }
}

export function usePhotoActionParsing(options: {
  language: Ref<Language>
}) {
  const actionInfo = ref(new Map<string, PhotoActionInfo>())
  const progress = ref<PhotoActionParseProgress>({ running: false, completed: 0, total: 0, failed: 0 })
  let runId = 0

  function cancel() {
    runId += 1
    progress.value = { ...progress.value, running: false }
  }

  async function start(photos: PhotoItem[], albumKey: string, resolveCandidateUids: () => Promise<string[]>) {
    const run = ++runId
    progress.value = { running: true, completed: 0, total: photos.length, failed: 0 }
    const next = new Map<string, PhotoActionInfo>()
    const pending: PhotoItem[] = []

    await Promise.all(photos.map(async (photo) => {
      const fingerprint = photoActionFingerprint(albumKey, photo)
      const cache = await getSavedPhotoActionCache(albumKey, photo.name)
      if (run !== runId) return
      if (cache && cache.fingerprint === fingerprint && cache.parserVersion === PHOTO_ACTION_PARSER_VERSION && cache.catalogVersion === PHOTO_ACTION_CATALOG_VERSION) {
        next.set(photo.id, { ...toInfo(cache), fingerprint })
      } else {
        next.set(photo.id, { status: 'pending', fingerprint })
        pending.push(photo)
      }
    }))
    if (run !== runId) return
    actionInfo.value = next
    const cachedCount = photos.length - pending.length
    const cachedFailed = [...next.values()].filter((item) => item.status === 'unparsed').length
    progress.value = { ...progress.value, completed: cachedCount, failed: cachedFailed }
    if (!pending.length) {
      progress.value = { running: false, completed: photos.length, total: photos.length, failed: cachedFailed }
      return
    }

    const candidateUids = await resolveCandidateUids()
    if (run !== runId) return
    const parsed = candidateUids.length
      ? await runWithConcurrency(pending, (photo) => parsePhotoAction(photo, candidateUids, options.language.value), {
          concurrency: 15,
          onItemComplete: (photo, _index, result) => {
            if (run !== runId) return
            const fingerprint = photoActionFingerprint(albumKey, photo)
            const info = { ...result, fingerprint }
            const updated = new Map(actionInfo.value)
            updated.set(photo.id, info)
            actionInfo.value = updated
            progress.value = { ...progress.value, completed: progress.value.completed + 1, failed: progress.value.failed + (result.status === 'unparsed' ? 1 : 0) }
            if (result.status !== 'unparsed') {
              void savePhotoActionCache(albumKey, photo.name, {
                fingerprint,
                parserVersion: PHOTO_ACTION_PARSER_VERSION,
                catalogVersion: PHOTO_ACTION_CATALOG_VERSION,
                status: result.status as PhotoActionCacheEntry['status'],
                actionId: result.actionId,
                actionName: result.actionName,
                actionImageUrl: result.actionImageUrl,
                parsedAt: result.parsedAt ?? Date.now()
              })
            }
          }
        })
      : []
    if (run !== runId) return
    if (!candidateUids.length) {
      const updated = new Map(actionInfo.value)
      for (const photo of pending) {
        const fingerprint = photoActionFingerprint(albumKey, photo)
        const info: PhotoActionInfo = { status: 'unparsed', fingerprint, errorCode: 'uid_missing', parsedAt: Date.now() }
        updated.set(photo.id, info)
      }
      actionInfo.value = updated
      progress.value = { running: false, completed: photos.length, total: photos.length, failed: pending.length }
      return
    }
    progress.value = { running: false, completed: photos.length, total: photos.length, failed: parsed.filter((item) => item.status === 'unparsed').length + cachedFailed }
  }

  return { actionInfo, progress, start, cancel }
}
