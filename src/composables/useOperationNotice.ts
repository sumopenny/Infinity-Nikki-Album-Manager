// 操作通知状态机：统一管理操作忙碌状态、提示文案、错误映射和通知生命周期。
import { computed, ref, watch, type ComputedRef } from 'vue'
import type { LocaleMessages, StatusPrefix, StatusSuffix } from '../i18n'
import type { OperationNoticeTone } from '../components/OperationNotice.vue'
import { DirectoryAccessError } from '../utils/file-system/directoryErrors'

export type StatusTone = OperationNoticeTone

export type ActiveOperation =
  | 'loading'
  | 'refreshing'
  | 'deleting'
  | 'trash'
  | 'saving-outfit'
  | 'importing-outfits'
  | 'exporting-outfits'
  | 'importing-photos'
  | 'exporting-photos'
  | 'updating-outfits'
  | 'mutating-outfits'
  | 'cleanup'

export type StatusState =
  | { type: 'initial' }
  | { type: 'reading' }
  | { type: 'restoring' }
  | { type: 'restoreFailed' }
  | { type: 'restorePathFailed' }
  | { type: 'readFailed' }
  | { type: 'cleared' }
  | { type: 'success'; count: number; prefix: StatusPrefix; suffix?: StatusSuffix }
  | { type: 'custom'; message: string; tone?: StatusTone; loading?: boolean }

export interface ConfirmableStatus {
  message: string
  tone?: StatusTone
  loading?: boolean
}

/** 集中管理操作状态、错误映射和顶部通知生命周期，避免页面组件重复维护计时器与 busy 判断。 */
export function useOperationNotice(locale: ComputedRef<LocaleMessages>) {
  const statusState = ref<StatusState>({ type: 'initial' })
  const activeOperation = ref<ActiveOperation | null>(null)
  const isVisible = ref(false)
  let timer: number | undefined
  let deadline = 0
  let remaining = 0
  let paused = false
  let loading = false

  const isLoading = computed(() => activeOperation.value === 'loading')
  const isRefreshing = computed(() => activeOperation.value === 'refreshing')
  const isDeleting = computed(() => activeOperation.value === 'deleting')
  const isTrashBusy = computed(() => activeOperation.value === 'trash')
  const isSavingOutfit = computed(() => activeOperation.value === 'saving-outfit')
  const isImportingOutfits = computed(() => activeOperation.value === 'importing-outfits')
  const isExportingOutfits = computed(() => activeOperation.value === 'exporting-outfits')
  const isImportingPhotos = computed(() => activeOperation.value === 'importing-photos')
  const isExportingPhotos = computed(() => activeOperation.value === 'exporting-photos')
  const isUpdatingOutfits = computed(() => activeOperation.value === 'updating-outfits')
  const isOutfitMutationBusy = computed(() => activeOperation.value === 'mutating-outfits')
  const isAnyFileOperationBusy = computed(() => activeOperation.value !== null)

  const statusMessage = computed(() => {
    const app = locale.value.app
    const state = statusState.value
    switch (state.type) {
      case 'reading': return app.readingStatus
      case 'restoring': return app.restoringStatus
      case 'restoreFailed': return app.restoreFailedStatus
      case 'restorePathFailed': return app.restorePathFailedStatus
      case 'readFailed': return app.readFailedStatus
      case 'cleared': return app.clearedStatus
      case 'success': return `${app.successStatus(state.count, state.prefix)}${state.suffix ? app.successSuffix(state.suffix) : ''}`
      case 'custom': return state.message
      default: return app.initialStatus
    }
  })

  const statusTone = computed<StatusTone>(() => {
    const state = statusState.value
    if (state.type === 'restoreFailed' || state.type === 'restorePathFailed' || state.type === 'readFailed') return 'error'
    if (state.type === 'success' || state.type === 'cleared') return 'success'
    if (state.type === 'custom') return state.tone ?? 'info'
    return 'info'
  })

  const isStatusLoading = computed(() => {
    const state = statusState.value
    return state.type === 'reading' || state.type === 'restoring' || (state.type === 'custom' && Boolean(state.loading))
  })

  const clearTimer = () => {
    if (timer === undefined) return
    window.clearTimeout(timer)
    timer = undefined
  }

  const hideAfter = (duration: number) => {
    remaining = duration
    deadline = Date.now() + duration
    timer = window.setTimeout(() => {
      isVisible.value = false
      timer = undefined
      remaining = 0
    }, duration)
  }

  const showNotice = (options: { loading?: boolean; duration?: number } = {}) => {
    clearTimer()
    paused = false
    remaining = 0
    loading = Boolean(options.loading)
    isVisible.value = true
    if (!loading && options.duration !== undefined) hideAfter(options.duration)
  }

  const closeNotice = () => {
    clearTimer()
    paused = false
    remaining = 0
    loading = false
    isVisible.value = false
  }

  const pauseNotice = () => {
    if (!isVisible.value || loading || paused) return
    remaining = Math.max(0, deadline - Date.now())
    clearTimer()
    paused = true
  }

  const resumeNotice = () => {
    if (!paused || !isVisible.value || loading) return
    paused = false
    hideAfter(remaining)
  }

  const showStatus = ({ message, tone = 'success', loading: isLoadingStatus = false }: ConfirmableStatus) => {
    statusState.value = { type: 'custom', message, tone, loading: isLoadingStatus }
  }

  const isUserCancelledFilePicker = (error: unknown): boolean => {
    if (!(error instanceof Error)) return false
    return error.name === 'AbortError' || error.message === locale.value.fileSystem.abortSelection
  }

  const createErrorStatus = (error: unknown, fallback: StatusState): StatusState => {
    if (error instanceof DirectoryAccessError && error.code === 'cancelled') {
      return { type: 'custom', message: locale.value.fileSystem.abortSelection, tone: 'info' }
    }
    if (!(error instanceof Error)) return fallback
    if (isUserCancelledFilePicker(error)) return { type: 'custom', message: locale.value.fileSystem.abortSelection, tone: 'info' }
    return { type: 'custom', message: error.message, tone: 'error' }
  }

  const begin = (operation: ActiveOperation) => { activeOperation.value = operation }
  const end = (operation: ActiveOperation) => {
    if (activeOperation.value === operation) activeOperation.value = null
  }
  const isActive = (operation: ActiveOperation) => computed(() => activeOperation.value === operation)

  watch(statusState, (nextStatus) => {
    if (nextStatus.type === 'initial') {
      closeNotice()
      return
    }
    const duration = statusTone.value === 'error' || statusTone.value === 'warning' ? 7200 : 5200
    showNotice({ loading: isStatusLoading.value, duration })
  })

  return {
    statusState,
    statusMessage,
    statusTone,
    isStatusLoading,
    activeOperation,
    isLoading,
    isRefreshing,
    isDeleting,
    isTrashBusy,
    isSavingOutfit,
    isImportingOutfits,
    isExportingOutfits,
    isImportingPhotos,
    isExportingPhotos,
    isUpdatingOutfits,
    isOutfitMutationBusy,
    isAnyFileOperationBusy,
    isVisible,
    showStatus,
    showNotice,
    closeNotice,
    pauseNotice,
    resumeNotice,
    createErrorStatus,
    isUserCancelledFilePicker,
    begin,
    end,
    isActive,
    dispose: clearTimer
  }
}
