import { nextTick, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'
import type { Language } from '../i18n'
import type { PhotoParamsMessages } from '../i18n/messages/photoParams'
import type { PhotoItem } from '../utils/photoGrouping'
import { listGamePlayPhotoAccounts } from '../utils/file-system/directoryAccess'
import { addSavedCameraParamUid, getSavedCameraParamUids, getSavedX6GameDirectoryHandle } from '../utils/file-system/directoryStorage'
import { decodeCameraParams, decodePhoto } from '../utils/photo-params/wasmClient'
import type { PhotoParamsProgress, PhotoParamsResult, PhotoParamsStage } from '../utils/photo-params/types'
import { resourceImage, resourceName } from '../utils/photo-params/resourceManifest'
import { PHOTO_PARAM_RANGES, photoFocalLengthDisplay, rawFocalLengthDisplay, sliderPercent } from '../utils/photo-params/slider'
import { weatherName } from '../utils/photo-params/weather'

type DecodedPhoto = { rawCameraParams: string; photo: Record<string, unknown>; camera: Record<string, unknown> }

export function usePhotoParams(options: {
  language: Readonly<Ref<Language>>
  messages: ComputedRef<PhotoParamsMessages>
}) {
  const { language, messages } = options
  const photo = ref<PhotoItem | { name: string } | null>(null)
  const uploadFile = ref<File | null>(null)
  const isVisible = ref(false)
  const result = ref<PhotoParamsResult | null>(null)
  const error = ref<string | null>(null)
  const uidRequired = ref(false)
  const progress = ref<PhotoParamsProgress>({ stage: 'idle', percent: 0, message: '' })
  let runId = 0

  function setStage(stage: PhotoParamsStage, percent: number) {
    progress.value = { stage, percent, message: messages.value.stages[stage] }
  }

  function describeError(code: string): string {
    const errorMessages = messages.value.errors
    return errorMessages.format(code, errorMessages.descriptions[code] ?? errorMessages.unknownMeaning)
  }

  function presentCameraParams(camera: Record<string, unknown>, rawCameraParams: string, photoData?: Record<string, unknown>) {
    const formatNumber = (value: unknown, digits: number) => {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) return messages.value.noValue
      return parsed.toFixed(digits)
    }
    const formatPercent = (value: unknown) => {
      const parsed = Number(value)
      if (!Number.isFinite(parsed)) return messages.value.noValue
      return `${Math.round(parsed * 100)}%`
    }
    const preferred = (key: string) => String(photoData?.[key] ?? camera[key] ?? messages.value.noValue)
    const display = (key: string, source: Record<string, unknown> = camera) => {
      const value = source[key]
      if (value == null) return messages.value.noValue
      if (['bloomIntensity', 'brightness', 'contrast'].includes(key)) return formatPercent(value)
      return formatNumber(value, 1)
    }
    const number = (key: string, source: Record<string, unknown> = camera) => Number(source[key])
    const focal = photoData?.focalLength != null
      ? photoFocalLengthDisplay(photoData.focalLength)
      : rawFocalLengthDisplay(camera.focalLength)
    const captureTime = photoData?.captureTime as { hour?: number; minute?: number; second?: number } | undefined
    const pad = (value: unknown) => String(Math.max(0, Math.floor(Number(value) || 0))).padStart(2, '0')
    const light = (photoData?.light ?? camera.light) as { id?: string; strength?: number } | undefined
    const filter = (photoData?.filter ?? camera.filter) as { id?: string; strength?: number } | undefined
    const resourceId = (resource: { id?: string } | undefined) => {
      const id = String(resource?.id ?? '').trim()
      return id && id !== 'None' ? id : undefined
    }
    const lightId = resourceId(light)
    const filterId = resourceId(filter)
    const momo = camera.momo as { enabled?: boolean; poseId?: number; horizontal?: number; distance?: number; height?: number; rotation?: number } | null
    const poseId = photoData?.poseId as string | number | undefined
    const resources: PhotoParamsResult['resourceGroups'] = [
      { title: messages.value.action, name: poseId == null ? messages.value.noValue : resourceName('pose', poseId, language.value), imageUrl: poseId == null ? undefined : resourceImage('pose', poseId) },
      { title: messages.value.light, name: lightId ? resourceName('light', lightId, language.value) : messages.value.noValue, value: lightId ? formatPercent(light?.strength) : undefined, imageUrl: lightId ? resourceImage('light', lightId) : undefined },
      { title: messages.value.filter, name: filterId ? resourceName('filter', filterId, language.value) : messages.value.noValue, value: filterId ? formatPercent(filter?.strength) : undefined, imageUrl: filterId ? resourceImage('filter', filterId) : undefined }
    ]
    if (momo) resources.push({ title: messages.value.labels.momoPose, name: momo.enabled ? messages.value.labels.momoVisible : resourceName('momo', momo.poseId ?? 0, language.value), value: momo.poseId == null ? undefined : String(momo.poseId), imageUrl: momo.poseId == null ? undefined : resourceImage('momo', momo.poseId) })
    result.value = {
      environmentFields: captureTime || photoData?.weatherType != null ? [
        ...(captureTime ? [{ label: messages.value.labels.gameTime, value: `${pad(captureTime.hour)}:${pad(captureTime.minute)}:${pad(captureTime.second)}` }] : []),
        ...(photoData?.weatherType != null ? [{ label: messages.value.labels.weather, value: weatherName(photoData.weatherType, language.value) }] : [])
      ] : [],
      cameraFields: [
        { label: messages.value.labels.focalLength, value: focal ? `${formatNumber(focal.millimeters, 0)}mm` : messages.value.noValue, position: focal?.position },
        { label: messages.value.labels.aperture, value: preferred('apertureValue'), position: sliderPercent(number('aperture', photoData ?? camera), PHOTO_PARAM_RANGES.aperture) },
        { label: messages.value.labels.vignette, value: formatPercent((photoData ?? camera).vignette), position: sliderPercent(number('vignette', photoData ?? camera), PHOTO_PARAM_RANGES.unit) }
      ],
      imageFields: [
        { key: 'bloomIntensity' as const, range: PHOTO_PARAM_RANGES.unit, format: 'percent' },
        { key: 'bloomRange' as const, range: PHOTO_PARAM_RANGES.signed, format: 'number' },
        { key: 'brightness' as const, range: PHOTO_PARAM_RANGES.unit, format: 'percent' },
        { key: 'exposure' as const, range: PHOTO_PARAM_RANGES.signed, format: 'number' },
        { key: 'contrast' as const, range: PHOTO_PARAM_RANGES.unit, format: 'percent' },
        { key: 'saturation' as const, range: PHOTO_PARAM_RANGES.signed, format: 'number' },
        { key: 'vibrance' as const, range: PHOTO_PARAM_RANGES.signed, format: 'number' },
        { key: 'highlights' as const, range: PHOTO_PARAM_RANGES.signed, format: 'number' },
        { key: 'shadows' as const, range: PHOTO_PARAM_RANGES.signed, format: 'number' }
      ].map(({ key, range, format }) => ({ label: messages.value.labels.imageFields[key], value: format === 'percent' ? formatPercent(camera[key]) : display(key), position: sliderPercent(camera[key], range) })),
      resourceGroups: resources,
      rawCameraParams
    }
  }

  async function parsePhotoBytes(bytes: Uint8Array, candidateUids: string[], run: number) {
    setStage('loadingWasm', 50)
    await nextTick()
    setStage('decryptingPhoto', 70)
    let decoded: Awaited<ReturnType<typeof decodePhoto<DecodedPhoto>>> | null = null
    const errors: string[] = []
    for (const uid of candidateUids) {
      const attempt = await decodePhoto<DecodedPhoto>(bytes, uid)
      if (attempt.ok && attempt.value) { decoded = attempt; break }
      if (attempt.errorCode && !errors.includes(attempt.errorCode)) errors.push(attempt.errorCode)
    }
    if (run !== runId) return null
    if (!decoded?.value) {
      uidRequired.value = true
      const errorDetails = errors.length ? errors.map(describeError).join('；') : describeError('photo_structure_invalid')
      throw new Error(errorDetails)
    }
    return decoded.value
  }

  async function openForPhoto(selectedPhoto: PhotoItem) {
    const run = ++runId
    isVisible.value = true
    photo.value = selectedPhoto
    uploadFile.value = null
    result.value = null
    error.value = null
    uidRequired.value = false
    try {
      setStage('resolvingUid', 10)
      await nextTick()
      const x6Game = await getSavedX6GameDirectoryHandle()
      if (!x6Game) throw new Error(messages.value.authorizationRequired)
      setStage('readingPhoto', 30)
      await nextTick()
      const bytes = new Uint8Array(await (await selectedPhoto.fileHandle.getFile()).arrayBuffer())
      if (run !== runId) return
      const directoryUids = await listGamePlayPhotoAccounts(x6Game)
      const savedUids = await getSavedCameraParamUids()
      const candidateUids = [...new Set([...directoryUids, ...savedUids])]
      const decoded = await parsePhotoBytes(bytes, candidateUids, run)
      if (!decoded) return
      setStage('parsingCamera', 90)
      presentCameraParams(decoded.camera, decoded.rawCameraParams, decoded.photo)
      setStage('ready', 100)
    } catch (caught) {
      if (run !== runId) return
      error.value = caught instanceof Error ? caught.message : String(caught)
      setStage('error', 100)
    }
  }

  async function openForFile(file: File) {
    const run = ++runId
    isVisible.value = true
    photo.value = { name: file.name } as PhotoItem
    uploadFile.value = file
    result.value = null
    error.value = null
    uidRequired.value = false
    try {
      setStage('readingPhoto', 30)
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (run !== runId) return
      const directoryUids = await (async () => {
        const x6Game = await getSavedX6GameDirectoryHandle()
        return x6Game ? listGamePlayPhotoAccounts(x6Game) : []
      })()
      const savedUids = await getSavedCameraParamUids()
      const candidateUids = [...new Set([...directoryUids, ...savedUids])]
      if (!candidateUids.length) {
        uidRequired.value = true
        throw new Error(describeError('photo_structure_invalid'))
      }
      const decoded = await parsePhotoBytes(bytes, candidateUids, run)
      if (!decoded) return
      setStage('parsingCamera', 90)
      presentCameraParams(decoded.camera, decoded.rawCameraParams, decoded.photo)
      setStage('ready', 100)
    } catch (caught) {
      if (run !== runId) return
      error.value = caught instanceof Error ? caught.message : String(caught)
      setStage('error', 100)
    }
  }

  async function submitUid(uid: string) {
    const selectedPhoto = photo.value
    const normalized = uid.trim()
    if (!selectedPhoto || !normalized) return
    const run = ++runId
    result.value = null
    error.value = null
    uidRequired.value = true
    setStage('readingPhoto', 30)
    try {
      const bytes = uploadFile.value
        ? new Uint8Array(await uploadFile.value.arrayBuffer())
        : 'fileHandle' in selectedPhoto
          ? new Uint8Array(await (await selectedPhoto.fileHandle.getFile()).arrayBuffer())
          : null
      if (!bytes) return
      const decoded = await decodePhoto<DecodedPhoto>(bytes, normalized)
      if (run !== runId) return
      if (!decoded.ok || !decoded.value) {
        uidRequired.value = decoded.errorCode === 'photo_structure_invalid'
        throw new Error(describeError(decoded.errorCode ?? 'photo_structure_invalid'))
      }
      await addSavedCameraParamUid(normalized)
      presentCameraParams(decoded.value.camera, decoded.value.rawCameraParams, decoded.value.photo)
      setStage('ready', 100)
    } catch (caught) {
      if (run !== runId) return
      error.value = caught instanceof Error ? caught.message : String(caught)
      setStage('error', 100)
    }
  }

  function openCameraParamsTool() {
    runId += 1
    isVisible.value = true
    photo.value = null
    uploadFile.value = null
    result.value = null
    error.value = null
    uidRequired.value = false
    progress.value = { stage: 'idle', percent: 0, message: '' }
  }

  async function parseRawCameraParams(raw: string) {
    const run = ++runId
    result.value = null
    error.value = null
    uidRequired.value = false
    setStage('loadingWasm', 40)
    try {
      const decoded = await decodeCameraParams<Record<string, unknown>>(raw)
      if (run !== runId) return
      if (!decoded.ok || !decoded.value) throw new Error(describeError(decoded.errorCode ?? 'camera_decrypt_failed'))
      presentCameraParams(decoded.value, raw)
      setStage('ready', 100)
    } catch (caught) {
      if (run !== runId) return
      error.value = caught instanceof Error ? caught.message : String(caught)
      setStage('error', 100)
    }
  }

  function close() {
    runId += 1
    isVisible.value = false
    photo.value = null
    uploadFile.value = null
    result.value = null
    error.value = null
    uidRequired.value = false
    progress.value = { stage: 'idle', percent: 0, message: '' }
  }

  onScopeDispose(() => { runId += 1 })

  return { photo, isVisible, result, error, uidRequired, progress, openForPhoto, openForFile, submitUid, openCameraParamsTool, parseRawCameraParams, close }
}
