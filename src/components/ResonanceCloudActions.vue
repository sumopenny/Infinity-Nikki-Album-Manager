<script setup lang="ts">
import { reportError as captureDiagnosticError } from '../utils/errorReporting/errorReporter'
import CloudDialog from './CloudDialog.vue'
import CloudAuthFields from './CloudAuthFields.vue'
import { useCloudSession } from '../composables/useCloudSession'
import { createUuid } from '../utils/uuid'
import { computed, onMounted, ref } from 'vue'
import { CloudUpload, CloudDownload, LogIn, LogOut, UserPlus, Trash2 } from 'lucide-vue-next'
import { useModuleOperation } from '../composables/useOperationCoordinator'
import { resonanceCloudMessages } from '../i18n/messages/resonanceCloud'
import { cloudRequest, type CloudUser, type CloudSnapshot } from '../utils/resonance/cloudClient'
import { validateCloudRecords } from '../utils/resonance/cloudSchema'
import {
  loadResonanceRecords,
  replaceResonanceRecordsIfUnchanged
} from '../utils/resonance/resonanceStorage'
import type { ResonanceRecord } from '../utils/resonance/resonanceTypes'

const props = defineProps<{ language: 'zh' | 'en'; disabled?: boolean }>()
const emit = defineEmits<{
  lock: [value: boolean]
  restored: [records: ResonanceRecord[]]
  notice: [message: string, tone: 'success' | 'error']
}>()
type Action = 'login' | 'register' | 'upload' | 'download' | 'delete'
const session = useCloudSession()
const user = session.user
const operationUser = ref<CloudUser | null>(null)
const action = ref<Action>('login')
const visible = ref(false)
const busy = ref(false)
const checking = ref(true)
const username = ref('')
const password = ref('')
const confirmation = ref('')
const error = ref('')
const snapshot = ref<CloudSnapshot | null>(null)
const local = ref<ResonanceRecord[]>([])
const localJSON = ref('')
let pending: { requestId: string; revision: number; records?: ResonanceRecord[] } | null = null
const t = computed(() => resonanceCloudMessages[props.language])
const auth = computed(() => action.value === 'login' || action.value === 'register')
const track = useModuleOperation('resonance-cloud')
const message = computed(
  () => t.value.errors[error.value as keyof typeof t.value.errors] || t.value.errors.SERVER_ERROR
)
const needsRefresh = computed(() => ['CONFLICT', 'LOCAL_CHANGED'].includes(error.value))
const canSubmit = computed(
  () =>
    !busy.value &&
    (auth.value ||
      (!!snapshot.value &&
        !['EMPTY_LOCAL', 'EMPTY_CLOUD', 'ACCOUNT_CHANGED', 'LOGIN_REQUIRED'].includes(error.value)))
)
/** 菜单恢复登录只读取同源 HttpOnly 会话，不触碰本地记录。 */
async function refreshSession() {
  await session.refresh()
}
onMounted(async () => {
  try {
    await refreshSession()
  } catch {
    /* 本地模式没有 Pages API 时仍保留本地功能。 */
  } finally {
    checking.value = false
  }
})

/** 操作期间登记全局忙碌；错误只显示稳定错误码映射，不输出凭据。 */
async function run(task: () => Promise<void>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await track(task)
  } catch (cause) {
    captureDiagnosticError(cause, { module: 'resonance-cloud', action: 'cloud-operation' })
    error.value = cause instanceof Error ? cause.message : 'SERVER_ERROR'
    // 登录注册失败保留表单，通过统一顶部提示报告，不在弹窗内重复显示。
    if (auth.value) emit('notice', message.value, 'error')
    if (['LOGIN_REQUIRED', 'ACCOUNT_CHANGED'].includes(error.value)) session.invalidate()
  } finally {
    busy.value = false
  }
}

/** 每次打开固定预览；注册与登录不自动上传或下载。 */
async function open(next: Action) {
  if (props.disabled || checking.value || busy.value) return
  operationUser.value = user.value ? { ...user.value } : null
  action.value = next
  password.value = ''
  confirmation.value = ''
  error.value = ''
  pending = null
  snapshot.value = null
  visible.value = true
  if (!auth.value) await prepare()
}

/** 预览同时读取本地完整数据和云端当前版本，不应用页面筛选。 */
async function prepare() {
  await run(async () => {
    snapshot.value = null
    pending = null
    try {
      local.value = await loadResonanceRecords()
    } catch (cause) {
      throw new Error('LOCAL_READ_FAILED', { cause })
    }
    localJSON.value = JSON.stringify(local.value)
    const remote = await cloudRequest<CloudSnapshot>('snapshot', operationUser.value)
    if (remote.active_snapshot) validateCloudRecords(remote.records)
    snapshot.value = remote
    if (action.value === 'upload') {
      if (!local.value.length) throw new Error('EMPTY_LOCAL')
      validateCloudRecords(local.value)
    } else if (!remote.active_snapshot) throw new Error('EMPTY_CLOUD')
  })
}

/** 关闭即清除内存里的密码；请求执行中不允许取消后切换账户。 */
function close() {
  if (busy.value) return
  visible.value = false
  password.value = ''
  confirmation.value = ''
  pending = null
}

/** 注册/登录、版本化覆盖、事务恢复均在用户确认后执行。 */
async function submit() {
  if (!canSubmit.value) return
  if (needsRefresh.value) {
    await prepare()
    return
  }
  await run(async () => {
    if (auth.value) {
      await session.authenticate(
        action.value as 'login' | 'register',
        username.value,
        password.value,
        confirmation.value
      )
    } else if (action.value === 'download') {
      // 确认后复查云端；本地比较与写入在同一个 IndexedDB 事务内完成。
      const remote = await cloudRequest<CloudSnapshot>('snapshot', operationUser.value)
      if (remote.revision !== snapshot.value?.revision) throw new Error('CONFLICT')
      if (!remote.active_snapshot) throw new Error('EMPTY_CLOUD')
      validateCloudRecords(remote.records)
      try {
        await replaceResonanceRecordsIfUnchanged(localJSON.value, remote.records)
      } catch (cause) {
        if (cause instanceof Error && cause.message === 'LOCAL_CHANGED') throw cause
        throw new Error('LOCAL_SAVE_FAILED', { cause })
      }
      emit('restored', remote.records)
    } else {
      if (!snapshot.value) throw new Error('CONFLICT')
      if (!pending) {
        if (
          action.value === 'upload' &&
          JSON.stringify(await loadResonanceRecords()) !== localJSON.value
        )
          throw new Error('LOCAL_CHANGED')
        pending = {
          requestId: createUuid(),
          revision: snapshot.value.revision,
          ...(action.value === 'upload' ? { records: JSON.parse(localJSON.value) } : {})
        }
      }
      // 超时重试使用同一请求 ID 和数据，服务端先查询提交回执再决定是否写入。
      await cloudRequest(action.value, operationUser.value, pending)
    }
    pending = null
    password.value = ''
    confirmation.value = ''
    visible.value = false
    emit(
      'notice',
      action.value === 'login'
        ? t.value.loginSuccess
        : action.value === 'register'
          ? t.value.registerSuccess
          : t.value.success,
      'success'
    )
  })
}

/** 退出只撤销本设备会话，保留共鸣数据；不明确的网络结果通过 session 再核实。 */
async function logout() {
  if (props.disabled || busy.value) return
  await run(async () => {
    await session.logout()
    emit('notice', t.value.success, 'success')
  })
  if (error.value) {
    action.value = 'login'
    visible.value = true
  }
}
</script>

<template>
  <template v-if="!user">
    <button type="button" :disabled="disabled || busy || checking" @click="open('login')"
      ><LogIn :size="16" aria-hidden="true" />{{ t.login }}</button
    >
    <button type="button" :disabled="disabled || busy || checking" @click="open('register')"
      ><UserPlus :size="16" aria-hidden="true" />{{ t.register }}</button
    >
  </template>
  <template v-else>
    <span class="resonance-cloud-account" :title="user.username"
      >{{ t.account }}: {{ user.username }}</span
    >
    <button type="button" :disabled="disabled || busy" @click="open('upload')"
      ><CloudUpload :size="16" aria-hidden="true" />{{ t.upload }}</button
    >
    <button type="button" :disabled="disabled || busy" @click="open('download')"
      ><CloudDownload :size="16" aria-hidden="true" />{{ t.download }}</button
    >
    <button type="button" :disabled="disabled || busy" @click="open('delete')"
      ><Trash2 :size="16" aria-hidden="true" />{{ t.delete }}</button
    >
    <button type="button" :disabled="disabled || busy" @click="logout"
      ><LogOut :size="16" aria-hidden="true" />{{ t.logout }}</button
    >
  </template>
  <CloudDialog
    :visible="visible"
    :busy="busy"
    :title="t[action]"
    :cancel-label="t.cancel"
    @close="close"
    @submit="submit"
    @lock="emit('lock', $event)"
  >
    <CloudAuthFields
      v-if="auth"
      :language="language"
      :registering="action === 'register'"
      :busy="busy"
      v-model:username="username"
      v-model:password="password"
      v-model:confirmation="confirmation"
    />
    <template v-else>
      <p
        ><strong>{{ t.account }}: {{ operationUser?.username }}</strong></p
      >
      <p>{{
        action === 'upload'
          ? t.uploadWarning
          : action === 'download'
            ? t.downloadWarning
            : t.deleteWarning
      }}</p>
      <p v-if="snapshot"
        >{{ t.local }}: {{ local.length }} {{ t.count }} · {{ t.remote }}:
        {{ snapshot.records.length }} {{ t.count }}</p
      >
      <p v-if="snapshot">{{ t.ready }}</p>
    </template>
    <p v-if="error && !auth" class="resonance-cloud-error" role="alert">{{ message }}</p>

    <template #footer>
      <button type="button" class="confirm-dialog-button ghost" :disabled="busy" @click="close">{{
        t.cancel
      }}</button>
      <button
        v-if="!auth && !snapshot && !busy"
        type="button"
        class="confirm-dialog-button ghost"
        @click="prepare"
        >{{ t.refresh }}</button
      >
      <button
        v-if="needsRefresh"
        type="button"
        class="confirm-dialog-button ghost"
        :disabled="busy"
        @click="prepare"
        >{{ t.refresh }}</button
      >
      <button v-else type="submit" class="confirm-dialog-button primary" :disabled="!canSubmit">{{
        busy ? t.working : pending ? t.retry : auth ? t[action] : t.confirm
      }}</button>
    </template>
  </CloudDialog>
</template>

<style scoped>
.resonance-cloud-account {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--muted);
  padding: 8px;
}
</style>
