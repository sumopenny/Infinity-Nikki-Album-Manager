<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { CloudUpload, CloudDownload, LogIn, LogOut, UserPlus, Trash2 } from 'lucide-vue-next'
import CloudDialog from './CloudDialog.vue'
import CloudAuthFields from './CloudAuthFields.vue'
import { useCloudSession } from '../composables/useCloudSession'
import { useWardrobeCloudSync, type WardrobeCloudAction } from '../composables/useWardrobeCloudSync'
import { useModuleOperation } from '../composables/useOperationCoordinator'
import { wardrobeCloudMessages } from '../i18n/messages/wardrobeCloud'
import type { WardrobeSnapshot } from '../utils/wardrobe/wardrobeSchema'
import { reportError } from '../utils/errorReporting/errorReporter'

const props = defineProps<{ language: 'zh' | 'en'; disabled?: boolean }>()
const emit = defineEmits<{
  lock: [value: boolean]
  restored: [data: WardrobeSnapshot]
  notice: [message: string, tone: 'success' | 'error']
}>()
const session = useCloudSession()
const user = session.user
const sync = useWardrobeCloudSync()
const { phase, localSummary, remote, account, pending, traceId } = sync
const t = computed(() => wardrobeCloudMessages[props.language])
const track = useModuleOperation('wardrobe-cloud')
const action = ref<WardrobeCloudAction | 'login' | 'register'>('login')
const auth = computed(() => action.value === 'login' || action.value === 'register')
const visible = ref(false),
  checking = ref(true),
  authBusy = ref(false)
const username = ref(''),
  password = ref(''),
  confirmation = ref(''),
  authError = ref('')
const busy = computed(() => authBusy.value || sync.busy.value)
const error = computed(() => (auth.value ? authError.value : sync.error.value))
const message = computed(
  () => t.value.errors[error.value as keyof typeof t.value.errors] || t.value.errors.SERVER_ERROR
)
const canSubmit = computed(() => !busy.value && (auth.value || sync.canSubmit.value))
const regionMismatch = computed(
  () =>
    remote.value?.summary &&
    localSummary.value &&
    remote.value.summary.regionScope !== localSummary.value.regionScope
)
const sourceEmpty = computed(() =>
  action.value === 'upload'
    ? localSummary.value?.ownedCount === 0
    : action.value === 'download' && remote.value?.summary?.ownedCount === 0
)
const regionName = (value: 'cn' | 'global') => t.value[value]
onMounted(async () => {
  try {
    await session.refresh()
  } catch {
    /* 云端不可用时保留本地功能。 */
  } finally {
    checking.value = false
  }
})
function invalidateSession() {
  if (['ACCOUNT_CHANGED', 'LOGIN_REQUIRED'].includes(error.value)) session.invalidate()
}
async function prepare() {
  if (auth.value || !user.value) return
  await track(() => sync.prepare(action.value as WardrobeCloudAction, user.value!))
  invalidateSession()
}
async function open(next: typeof action.value) {
  if (props.disabled || busy.value || checking.value) return
  sync.reset()
  password.value = ''
  confirmation.value = ''
  authError.value = ''
  action.value = next
  visible.value = true
  if (!auth.value) await prepare()
}
function close() {
  if (busy.value) return
  visible.value = false
  password.value = ''
  confirmation.value = ''
  sync.reset()
}
async function submit() {
  if (!canSubmit.value) return
  if (auth.value) {
    authBusy.value = true
    authError.value = ''
    try {
      await track(() =>
        session.authenticate(
          action.value as 'login' | 'register',
          username.value,
          password.value,
          confirmation.value
        )
      )
      visible.value = false
      password.value = ''
      confirmation.value = ''
      emit(
        'notice',
        action.value === 'login' ? t.value.loginSuccess : t.value.registerSuccess,
        'success'
      )
    } catch (cause) {
      reportError(cause, { module: 'wardrobe-cloud', action: action.value })
      authError.value = cause instanceof Error ? cause.message : 'SERVER_ERROR'
      emit('notice', message.value, 'error')
    } finally {
      authBusy.value = false
    }
    return
  }
  const restored = await track(sync.submit)
  invalidateSession()
  if (restored !== undefined) {
    visible.value = false
    if (restored) emit('restored', restored)
    emit('notice', t.value.success, 'success')
  }
}
async function logout() {
  if (props.disabled || busy.value) return
  authBusy.value = true
  try {
    await track(session.logout)
    emit('notice', t.value.success, 'success')
  } catch (cause) {
    reportError(cause, { module: 'wardrobe-cloud', action: 'logout' })
    emit('notice', t.value.errors.NETWORK, 'error')
  } finally {
    authBusy.value = false
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
    <span class="cloud-account" :title="user.username">{{ t.account }}: {{ user.username }}</span>
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
        ><strong>{{ t.account }}: {{ account?.username }}</strong></p
      >
      <p>{{
        action === 'upload'
          ? t.uploadWarning
          : action === 'download'
            ? t.downloadWarning
            : t.deleteWarning
      }}</p>
      <p v-if="localSummary"
        >{{ t.local }}: {{ localSummary.ownedCount }} {{ t.count }} ·
        {{ regionName(localSummary.regionScope) }} · {{ t.unknown }}:
        {{ localSummary.unknownSuitCount }}</p
      >
      <p v-if="remote"
        >{{ t.remote }}:
        <template v-if="remote.summary"
          >{{ remote.summary.ownedCount }} {{ t.count }} ·
          {{ regionName(remote.summary.regionScope) }} · {{ t.unknown }}:
          {{ remote.summary.unknownSuitCount }}</template
        ><template v-else>{{ t.noSave }}</template></p
      >
      <p v-if="remote?.summary"
        >{{ t.updated }}: {{ new Date(remote.updated_at).toLocaleString(language) }}</p
      >
      <p v-if="regionMismatch && action !== 'delete'" class="wardrobe-cloud-region"
        ><strong
          >{{ action === 'download' ? t.regionChange : t.uploadRegionChange }}
          {{
            regionName(
              action === 'download' ? remote!.summary!.regionScope : localSummary!.regionScope
            )
          }}</strong
        ></p
      >
      <p v-if="sourceEmpty">{{ t.emptyWarning }}</p>
      <p v-if="remote">{{ t.ready }}</p>
      <p v-if="error" class="cloud-error" role="alert">{{ message }}</p>
      <p v-if="error && traceId">{{ t.traceId }}: {{ traceId }}</p>
    </template>
    <template #footer>
      <button type="button" class="confirm-dialog-button ghost" :disabled="busy" @click="close">{{
        t.cancel
      }}</button>
      <button
        v-if="!auth && (phase === 'conflict' || phase === 'error')"
        type="button"
        class="confirm-dialog-button ghost"
        :disabled="busy || !user"
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
.cloud-account {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--muted);
  padding: 8px;
}
.cloud-error {
  color: var(--notice-error);
}
.wardrobe-cloud-region {
  color: var(--heading);
}
</style>
