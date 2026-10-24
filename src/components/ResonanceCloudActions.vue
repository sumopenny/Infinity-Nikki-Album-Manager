<script setup lang="ts">
import { reportError as captureDiagnosticError } from '../utils/errorReporting/errorReporter'
import { createUuid } from '../utils/uuid'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { CloudUpload, CloudDownload, LogIn, LogOut, UserPlus, Trash2, X } from 'lucide-vue-next'
import { useModuleOperation } from '../composables/useOperationCoordinator'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import { useModalPresence } from '../composables/useModalPresence'
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
const user = ref<CloudUser | null>(null)
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
const dialog = ref<HTMLDialogElement | null>(null)
let opener: HTMLElement | null = null
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
// 原生 dialog 保留焦点约束；共用过渡在退场结束后才释放滚动锁和模态层。
const modal = useModalPresence(visible, ref(true))
useBodyScrollLock(modal.present)
watch(visible, async (value) => {
  if (value) {
    await nextTick()
    dialog.value?.showModal()
  }
})
watch(modal.present, (value) => {
  emit('lock', value)
  if (!value) {
    dialog.value?.close()
    opener?.focus()
  }
})

/** 菜单恢复登录只读取同源 HttpOnly 会话，不触碰本地记录。 */
async function refreshSession() {
  const result = await cloudRequest<{ user: CloudUser | null }>('session')
  user.value = result.user
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
    if (['LOGIN_REQUIRED', 'ACCOUNT_CHANGED'].includes(error.value)) user.value = null
  } finally {
    busy.value = false
  }
}

/** 每次打开固定预览；注册与登录不自动上传或下载。 */
async function open(next: Action) {
  if (props.disabled || checking.value || busy.value) return
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
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
    const remote = await cloudRequest<CloudSnapshot>('snapshot', user.value)
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
      if (
        !/^[a-zA-Z0-9_]{4,32}$/.test(username.value.trim()) ||
        [...password.value].length < 6 ||
        [...password.value].length > 128
      )
        throw new Error('CREDENTIAL_FORMAT')
      if (action.value === 'register' && password.value !== confirmation.value)
        throw new Error('PASSWORD_MISMATCH')
      const result = await cloudRequest<{ user: CloudUser }>(action.value, null, {
        username: username.value,
        password: password.value
      })
      user.value = result.user
    } else if (action.value === 'download') {
      // 确认后复查云端；本地比较与写入在同一个 IndexedDB 事务内完成。
      const remote = await cloudRequest<CloudSnapshot>('snapshot', user.value)
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
      await cloudRequest(action.value, user.value, pending)
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
    try {
      await cloudRequest('logout', user.value, {})
      user.value = null
    } catch (cause) {
      await refreshSession()
      if (user.value) throw cause
    }
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
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="resonance-cloud-dialog"
      :aria-label="t[action]"
      @cancel.prevent="close"
    >
      <Transition
        name="confirm-dialog"
        @before-enter="modal.beforeEnter"
        @before-leave="modal.beforeLeave"
        @after-leave="modal.afterLeave"
      >
        <div v-if="visible" class="dialog-overlay resonance-import-dialog" @click.self="close">
          <form
            class="dialog-panel resonance-import-panel resonance-cloud-panel"
            :novalidate="auth"
            @submit.prevent="submit"
          >
            <header
              ><h2>{{ t[action] }}</h2
              ><button type="button" :disabled="busy" :aria-label="t.cancel" @click="close"
                ><X :size="20" /></button
            ></header>
            <div class="resonance-import-body resonance-cloud-body">
              <template v-if="auth">
                <p>{{ t.credentials }}</p>
                <label
                  >{{ t.username
                  }}<input
                    v-model="username"
                    name="username"
                    autocomplete="username"
                    minlength="4"
                    maxlength="32"
                    pattern="[A-Za-z0-9_]{4,32}"
                    required
                    :disabled="busy"
                /></label>
                <label
                  >{{ t.password
                  }}<input
                    v-model="password"
                    name="password"
                    type="password"
                    :autocomplete="action === 'register' ? 'new-password' : 'current-password'"
                    required
                    :disabled="busy"
                /></label>
                <label v-if="action === 'register'"
                  >{{ t.confirmPassword
                  }}<input
                    v-model="confirmation"
                    name="confirmation"
                    type="password"
                    autocomplete="new-password"
                    required
                    :disabled="busy"
                /></label>
                <p>{{ t.persistent }}</p>
              </template>
              <template v-else>
                <p
                  ><strong>{{ t.account }}: {{ user?.username }}</strong></p
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
            </div>
            <footer class="resonance-import-footer">
              <button
                type="button"
                class="confirm-dialog-button ghost"
                :disabled="busy"
                @click="close"
                >{{ t.cancel }}</button
              >
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
              <button
                v-else
                type="submit"
                class="confirm-dialog-button primary"
                :disabled="!canSubmit"
                >{{ busy ? t.working : pending ? t.retry : auth ? t[action] : t.confirm }}</button
              >
            </footer>
          </form>
        </div>
      </Transition>
    </dialog>
  </Teleport>
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
/* 原生模态层只负责焦点和 Escape，外观复用共鸣导入窗口及手机可视区域规则。 */
.resonance-cloud-dialog {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  overflow: hidden;
}
.resonance-cloud-dialog::backdrop {
  background: transparent;
}
.resonance-cloud-panel {
  --dialog-accent: var(--pink-deep);
  width: min(680px, 100%);
  height: auto;
}
.resonance-cloud-body {
  flex: 0 1 auto;
  gap: 16px;
}
.resonance-cloud-panel p {
  font-size: 13px;
}
.resonance-cloud-panel label {
  display: grid;
  gap: 8px;
  font-size: 14px;
}
.resonance-cloud-panel button:focus-visible {
  outline: 2px solid var(--heading);
  outline-offset: 2px;
}
.resonance-cloud-error {
  color: var(--notice-error);
}
.resonance-cloud-panel footer {
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
