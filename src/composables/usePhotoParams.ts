import { formatCameraParams } from '../utils/photo-params/formatCameraParams'
import { nextTick, onScopeDispose, ref, type ComputedRef, type Ref } from 'vue'
import type { Language } from '../i18n'
import type { PhotoParamsMessages } from '../i18n/messages/photoParams'
import type { PhotoItem } from '../utils/photoGrouping'
import { listGamePlayPhotoAccounts } from '../utils/file-system/directoryAccess'
import { addSavedCameraParamUid, getSavedCameraParamUids, getSavedX6GameDirectoryHandle } from '../utils/file-system/directoryStorage'
import { decodeCameraParams, decodePhoto } from '../utils/photo-params/wasmClient'
import type { PhotoParamsProgress, PhotoParamsResult, PhotoParamsStage } from '../utils/photo-params/types'

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

  function requiresUid(errorCode: string | undefined): boolean {
    return errorCode === 'photo_structure_invalid'
  }

  function presentCameraParams(camera: Record<string, unknown>, rawCameraParams: string, photoData?: Record<string, unknown>) {
    result.value = formatCameraParams(camera, rawCameraParams, language.value, messages.value, photoData)
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
      // 只有“未找到有效 UID 账号”才需要用户输入 UID；其它照片结构或参数错误直接展示错误信息。
      uidRequired.value = errors.length > 0 && errors.every((code) => requiresUid(code))
      const errorDetails = errors.length ? errors.map(describeError).join('；') : describeError('photo_parse_failed')
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
    // UID 输入只在解析器明确报告 UID 无效时显示；其它异常不能留下旧的输入表单状态。
    uidRequired.value = false
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
        uidRequired.value = requiresUid(decoded.errorCode)
        throw new Error(describeError(decoded.errorCode ?? 'photo_parse_failed'))
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
