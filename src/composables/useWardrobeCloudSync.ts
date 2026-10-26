import { computed, onBeforeUnmount, ref, shallowRef } from 'vue'
import { reportError } from '../utils/errorReporting/errorReporter'
import { CloudRequestError, type CloudUser } from '../utils/cloud/cloudClient'
import { createUuid } from '../utils/uuid'
import {
  loadWardrobe,
  readWardrobeSnapshot,
  replaceWardrobeIfUnchanged
} from '../utils/wardrobe/wardrobeStorage'
import {
  wardrobeBaseline,
  hasWardrobeSnapshot,
  type WardrobeSnapshot
} from '../utils/wardrobe/wardrobeSchema'
import {
  normalizeCloudWardrobe,
  summarizeWardrobe,
  type WardrobeCloudHead,
  type WardrobeCloudWrite
} from '../utils/wardrobe/wardrobeCloudSchema'
import {
  getWardrobeHead,
  getWardrobeSnapshot,
  writeWardrobeSnapshot
} from '../utils/wardrobe/wardrobeCloudClient'

export type WardrobeCloudAction = 'upload' | 'download' | 'delete'
type Phase = 'idle' | 'preparing' | 'ready' | 'submitting' | 'conflict' | 'uncertain' | 'error'

/** 数据流程独立于弹窗；预览、请求和账号固定，超时不能换成最新本地数据。 */
export function useWardrobeCloudSync() {
  const phase = ref<Phase>('idle')
  const error = ref('')
  const traceId = ref('')
  const local = shallowRef<WardrobeSnapshot | null>(null)
  const remote = shallowRef<WardrobeCloudHead | null>(null)
  const account = shallowRef<CloudUser | null>(null)
  const action = ref<WardrobeCloudAction>('upload')
  const pending = shallowRef<WardrobeCloudWrite | null>(null)
  const busy = computed(() => phase.value === 'preparing' || phase.value === 'submitting')
  const canSubmit = computed(() => phase.value === 'ready' || phase.value === 'uncertain')
  const localSummary = computed(() => (local.value ? summarizeWardrobe(local.value) : null))
  let baseline = ''
  let version = 0
  onBeforeUnmount(() => {
    version++
  })
  function reset() {
    version++
    phase.value = 'idle'
    error.value = ''
    traceId.value = ''
    local.value = null
    remote.value = null
    pending.value = null
    account.value = null
  }
  function failure(cause: unknown, stage: 'prepare' | 'submit') {
    reportError(cause, { module: 'wardrobe-cloud', action: action.value, stage })
    error.value = cause instanceof Error ? cause.message : 'SERVER_ERROR'
    traceId.value = cause instanceof CloudRequestError ? (cause.traceId ?? '') : ''
    phase.value = ['CONFLICT', 'LOCAL_CHANGED'].includes(error.value)
      ? 'conflict'
      : pending.value &&
          ['NETWORK', 'SERVER_ERROR', 'UPLOAD_PENDING', 'RATE_LIMIT'].includes(error.value)
        ? 'uncertain'
        : 'error'
  }
  async function prepare(next: WardrobeCloudAction, user: CloudUser) {
    if (busy.value) return
    reset()
    action.value = next
    account.value = { ...user }
    phase.value = 'preparing'
    const current = version
    try {
      const [saved, head] = await Promise.all([
        loadWardrobe()
          .then(() => readWardrobeSnapshot())
          .catch((cause) => {
            throw new Error('LOCAL_READ_FAILED', { cause })
          }),
        getWardrobeHead(account.value)
      ])
      if (current !== version) return
      local.value = saved
      baseline = wardrobeBaseline(saved)
      remote.value = head
      if (next === 'upload') {
        if (!hasWardrobeSnapshot(saved)) throw new Error('EMPTY_LOCAL')
        normalizeCloudWardrobe(saved)
      } else if (!head.active_snapshot) throw new Error('EMPTY_CLOUD')
      phase.value = 'ready'
    } catch (cause) {
      if (current === version) failure(cause, 'prepare')
    }
  }
  async function submit(): Promise<WardrobeSnapshot | null | undefined> {
    if (!canSubmit.value || !account.value || !remote.value || !local.value) return
    phase.value = 'submitting'
    error.value = ''
    traceId.value = ''
    const current = version
    const user = account.value
    try {
      let restored: WardrobeSnapshot | null = null
      if (action.value === 'download') {
        const snapshot = await getWardrobeSnapshot(user)
        if (snapshot.revision !== remote.value.revision) throw new Error('CONFLICT')
        if (!snapshot.data) throw new Error('EMPTY_CLOUD')
        try {
          restored = await replaceWardrobeIfUnchanged(baseline, snapshot.data)
        } catch (cause) {
          if (cause instanceof Error && cause.message === 'LOCAL_CHANGED') throw cause
          throw new Error('LOCAL_SAVE_FAILED', { cause })
        }
      } else {
        if (!pending.value) {
          if (action.value === 'upload') {
            const latest = await readWardrobeSnapshot().catch((cause) => {
              throw new Error('LOCAL_READ_FAILED', { cause })
            })
            if (wardrobeBaseline(latest) !== baseline) throw new Error('LOCAL_CHANGED')
          }
          pending.value = {
            requestId: createUuid(),
            revision: remote.value.revision,
            ...(action.value === 'upload'
              ? { schemaVersion: 1, data: normalizeCloudWardrobe(local.value) }
              : {})
          }
        }
        await writeWardrobeSnapshot(action.value, user, pending.value)
      }
      if (current !== version) return
      pending.value = null
      phase.value = 'idle'
      return restored
    } catch (cause) {
      if (current === version) failure(cause, 'submit')
    }
  }
  return {
    phase,
    error,
    traceId,
    localSummary,
    remote,
    account,
    action,
    pending,
    busy,
    canSubmit,
    prepare,
    submit,
    reset
  }
}
