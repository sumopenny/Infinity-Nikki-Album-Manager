import { reactive, ref } from 'vue'
import type { PhotoItem } from '../utils/photoGrouping'
import type { PhotoTransferProgress } from '../utils/file-system/photoTransfer'

export function usePhotoTransfer() {
  const state = reactive({
    phase: 'idle' as 'idle' | 'preparing' | 'running' | 'completed' | 'cancelled',
    completed: 0,
    total: 0,
    succeeded: 0,
    failedNames: [] as string[],
    succeededPhotos: [] as PhotoItem[],
    kind: 'export' as 'import' | 'export',
    title: ''
  })
  const controller = ref<AbortController | null>(null)
  const movePending = ref<PhotoItem[] | null>(null)

  function begin(kind: 'import' | 'export', title: string) {
    state.phase = 'preparing'
    state.kind = kind
    state.title = title
    state.completed = 0
    state.total = 0
    state.succeeded = 0
    state.failedNames = []
    state.succeededPhotos = []
    movePending.value = null
  }

  function showPrepared(total: number) {
    state.total = total
    state.phase = 'running'
  }

  function updateProgress(progress: PhotoTransferProgress) {
    state.completed = progress.completed
    state.total = progress.total
    state.succeeded = progress.succeeded
    state.failedNames = progress.failedNames
    if (progress.cancelled) state.phase = 'cancelled'
  }

  function createController() {
    controller.value = new AbortController()
    return controller.value
  }

  function markCompleted() {
    state.phase = 'completed'
  }

  function markExportResult(succeededPhotos: PhotoItem[], cancelled: boolean) {
    state.succeededPhotos = succeededPhotos
    state.phase = cancelled ? 'cancelled' : 'completed'
    movePending.value = succeededPhotos.length ? succeededPhotos : null
  }

  function cancel() {
    if (state.phase !== 'running') return
    controller.value?.abort()
  }

  function takeMovePending() {
    state.phase = 'idle'
    const succeededPhotos = movePending.value
    movePending.value = null
    return succeededPhotos
  }

  function clearController() {
    controller.value = null
  }

  return { state, controller, begin, showPrepared, updateProgress, createController, markCompleted, markExportResult, cancel, takeMovePending, clearController }
}
