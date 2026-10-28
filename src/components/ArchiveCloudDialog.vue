<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ArrowRight, AlertTriangle, LoaderCircle, Download, UserRound } from 'lucide-vue-next'
import CloudDialog from './CloudDialog.vue'
import CloudAuthFields from './CloudAuthFields.vue'
import { useArchiveCloud } from '../composables/useArchiveCloudSync'
import { archiveCloudMessages } from '../i18n/messages/archiveCloud'
import { archiveModules, type ArchiveModule } from '../utils/cloud/archiveSchema'
import { readArchiveLocal } from '../utils/cloud/archiveStorage'
import { exportArchiveBackup } from '../utils/cloud/archiveBackup'
import { hasWardrobeSnapshot } from '../utils/wardrobe/wardrobeSchema'
import { reportError } from '../utils/errorReporting/errorReporter'
import type { ConfirmableStatus } from '../composables/useOperationNotice'

const props = defineProps<{ language: 'zh' | 'en' }>()
const emit = defineEmits<{
  notice: [status: ConfirmableStatus]
  restored: [modules: ArchiveModule[]]
}>()
const sync = useArchiveCloud()
const {
  visible,
  action,
  phase,
  local,
  remote,
  account,
  selected,
  moduleErrors,
  pending,
  busy,
  auth,
  eligible,
  canSubmit,
  error,
  traceId,
  localWardrobe
} = sync
const t = computed(() => archiveCloudMessages[props.language])
const username = ref(''),
  password = ref(''),
  confirmation = ref('')
const backupState = ref<'idle' | 'ready' | 'error'>('idle')
watch(visible, () => {
  password.value = ''
  confirmation.value = ''
  backupState.value = 'idle'
})
watch(
  selected,
  () => {
    backupState.value = 'idle'
  },
  { deep: true }
)
watch(sync.logoutNotice, () =>
  emit('notice', { message: t.value.success, tone: 'success', source: 'archive-cloud' })
)
const message = computed(
  () => t.value.errors[error.value as keyof typeof t.value.errors] || t.value.errors.SERVER_ERROR
)
const description = computed(() =>
  action.value === 'upload'
    ? t.value.uploadDescription
    : action.value === 'download'
      ? t.value.downloadDescription
      : t.value.deleteDescription
)
const status = computed(() =>
  sync.backupBusy.value
    ? t.value.backupWorking
    : phase.value === 'preparing'
      ? t.value.preparing
      : phase.value === 'submitting'
        ? action.value === 'upload'
          ? t.value.uploading
          : action.value === 'download'
            ? t.value.downloading
            : t.value.deleting
        : ''
)
const columns = computed(() =>
  action.value === 'upload' ? ['local', 'cloud'] : ['cloud', 'local']
)
const controlsLocked = computed(() => busy.value || !!pending.value || phase.value !== 'ready')
const regionMismatch = computed(
  () =>
    action.value !== 'delete' &&
    selected.value.includes('wardrobe') &&
    localWardrobe.value &&
    remote.value?.wardrobe.summary &&
    localWardrobe.value.regionScope !== remote.value.wardrobe.summary.regionScope
)
const emptyWardrobe = computed(
  () =>
    selected.value.includes('wardrobe') &&
    (action.value === 'upload'
      ? localWardrobe.value?.ownedCount === 0
      : action.value === 'download' && remote.value?.wardrobe.summary?.ownedCount === 0)
)
const warning = computed(() =>
  action.value === 'upload'
    ? selected.value.some((k) => remote.value?.[k].active_snapshot)
    : action.value === 'download' && selected.value.length > 0
)
const region = (value: 'cn' | 'global') => t.value[value]
const formatDate = (value: number) =>
  new Intl.DateTimeFormat(props.language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(value)
function count(module: ArchiveModule, side: string) {
  if (module === 'resonance')
    return side === 'local' ? local.value?.resonance?.length : remote.value?.resonance.count
  return side === 'local'
    ? localWardrobe.value?.ownedCount
    : remote.value?.wardrobe.summary?.ownedCount
}
function exists(module: ArchiveModule, side: string) {
  if (side === 'cloud') return !!remote.value?.[module].active_snapshot
  return module === 'resonance' ? !!local.value?.resonance?.length : !!localWardrobe.value
}
function unavailable(module: ArchiveModule) {
  const code = moduleErrors.value[module]
  return code
    ? t.value.errors[code as keyof typeof t.value.errors] || t.value.unavailable
    : action.value === 'upload'
      ? t.value.emptyLocal
      : t.value.emptyCloud
}
async function submit() {
  if (auth.value) {
    if (busy.value) return
    sync.authBusy.value = true
    error.value = ''
    try {
      await sync.session.authenticate(
        action.value as 'login' | 'register',
        username.value,
        password.value,
        confirmation.value
      )
      const text = action.value === 'login' ? t.value.loginSuccess : t.value.registerSuccess
      sync.authBusy.value = false
      sync.close()
      emit('notice', { message: text, tone: 'success', source: 'archive-cloud' })
    } catch (cause) {
      reportError(cause, { module: 'archive-cloud', action: action.value })
      error.value = cause instanceof Error ? cause.message : 'SERVER_ERROR'
    } finally {
      sync.authBusy.value = false
      password.value = ''
      confirmation.value = ''
    }
    return
  }
  const result = await sync.submit()
  if (!result) return
  const labels = result.modules.map(
    (k) =>
      `${t.value[k]} ${k === 'resonance' ? (result.action === 'upload' ? result.local.resonance!.length : result.remote.resonance.count) : result.action === 'upload' ? localWardrobe.value!.ownedCount : result.remote.wardrobe.summary!.ownedCount} ${k === 'resonance' ? t.value.records : t.value.count}`
  )
  emit('notice', {
    message: `${result.action === 'upload' ? t.value.uploadSuccess : result.action === 'download' ? t.value.downloadSuccess : t.value.deleteSuccess}：${labels.join(' · ')}`,
    tone: 'success',
    source: 'archive-cloud'
  })
  if (result.action === 'download') emit('restored', result.modules)
}
async function backup() {
  if (busy.value || !selected.value.length || pending.value) return
  sync.backupBusy.value = true
  backupState.value = 'idle'
  try {
    const latest = await readArchiveLocal([...selected.value])
    const files = exportArchiveBackup(latest, [...selected.value])
    backupState.value = 'ready'
    emit('notice', {
      message: t.value.backupReady,
      tone: 'success',
      source: 'archive-backup',
      downloadFiles: files
    })
  } catch (cause) {
    reportError(cause, { module: 'archive-cloud', action: 'backup' })
    backupState.value = 'error'
  } finally {
    sync.backupBusy.value = false
  }
}
</script>

<template>
  <CloudDialog
    :visible="visible"
    :busy="busy"
    :title="t[action]"
    :cancel-label="t.cancel"
    :archive="!auth"
    :destructive="action === 'delete'"
    @close="sync.close"
    @submit="submit"
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
      <div class="archive-cloud-intro">
        <p>{{ description }}</p>
        <p class="archive-cloud-account"
          ><UserRound :size="15" aria-hidden="true" />{{ t.account }}:
          <strong>{{ account?.username }}</strong></p
        >
      </div>
      <fieldset
        v-if="remote && local && phase !== 'preparing'"
        class="archive-cloud-selection"
        :disabled="controlsLocked"
      >
        <legend>{{ action === 'delete' ? t.deleteHint : t.selectHint }}</legend>
        <div
          v-for="module in archiveModules"
          :key="module"
          class="archive-cloud-module"
          :class="{
            'is-unavailable': !eligible.includes(module),
            'is-selected': selected.includes(module)
          }"
        >
          <label class="archive-cloud-module-label">
            <input
              type="checkbox"
              v-model="selected"
              :value="module"
              :disabled="!eligible.includes(module)"
            />
            <strong>{{ t[module] }}</strong>
            <span v-if="selected.includes(module)" class="archive-cloud-badge">{{
              action === 'delete' ? t.deleteTarget : t.selected
            }}</span>
          </label>
          <p v-if="!eligible.includes(module)" class="archive-cloud-unavailable">{{
            unavailable(module)
          }}</p>
          <div class="archive-cloud-comparison" :class="{ 'is-delete': action === 'delete' }">
            <template
              v-for="(side, index) in action === 'delete' ? ['cloud'] : columns"
              :key="side"
            >
              <ArrowRight
                v-if="index === 1"
                class="archive-cloud-arrow"
                :size="18"
                aria-hidden="true"
              />
              <section
                :aria-label="`${t[module]} · ${side === 'local' ? t.localColumn : t.cloudColumn}`"
              >
                <div class="archive-cloud-save-heading"
                  ><span>{{ side === 'local' ? t.localColumn : t.cloudColumn }}</span>
                  <span
                    v-if="selected.includes(module) && action !== 'delete'"
                    class="archive-cloud-badge"
                    :class="{ 'is-target': index === 1 }"
                    >{{
                      index === 0
                        ? t.source
                        : exists(module, side)
                          ? t.replaceTarget
                          : t.createTarget
                    }}</span
                  ></div
                >
                <p v-if="exists(module, side)" class="archive-cloud-count"
                  ><strong>{{ count(module, side)?.toLocaleString(language) }}</strong>
                  {{ module === 'resonance' ? t.records : t.count }}</p
                >
                <p v-else class="archive-cloud-empty">{{ t.noSave }}</p>
                <p
                  v-if="module === 'wardrobe' && exists(module, side)"
                  class="archive-cloud-region"
                  >{{
                    region(
                      side === 'local'
                        ? localWardrobe!.regionScope
                        : remote.wardrobe.summary!.regionScope
                    )
                  }}</p
                >
                <p v-if="side === 'cloud' && exists(module, side)" class="archive-cloud-date"
                  >{{ t.updated }}<br /><time
                    :datetime="new Date(remote[module].updated_at).toISOString()"
                    >{{ formatDate(remote[module].updated_at) }}</time
                  ></p
                >
                <details
                  v-if="
                    module === 'wardrobe' &&
                    (side === 'local'
                      ? localWardrobe?.unknownSuitCount
                      : remote.wardrobe.summary?.unknownSuitCount)
                  "
                  class="archive-cloud-details"
                  ><summary
                    >{{ t.unknown }}:
                    {{
                      side === 'local'
                        ? localWardrobe?.unknownSuitCount
                        : remote.wardrobe.summary?.unknownSuitCount
                    }}</summary
                  ><p>{{ t.uncatalogued }}</p></details
                >
              </section>
            </template>
          </div>
        </div>
      </fieldset>
      <div v-if="warning || regionMismatch || emptyWardrobe" class="archive-cloud-warning"
        ><AlertTriangle :size="18" aria-hidden="true" /><div>
          <p v-if="warning">{{ action === 'upload' ? t.uploadRisk : t.downloadRisk }}</p>
          <p v-if="regionMismatch && action !== 'delete'"
            ><strong
              >{{ action === 'download' ? t.regionChange : t.uploadRegionChange }}
              {{
                region(
                  action === 'download'
                    ? remote!.wardrobe.summary!.regionScope
                    : localWardrobe!.regionScope
                )
              }}</strong
            ><span class="archive-cloud-region-change"
              >{{
                region(
                  action === 'download'
                    ? localWardrobe!.regionScope
                    : remote!.wardrobe.summary!.regionScope
                )
              }}<ArrowRight :size="14" aria-hidden="true" />{{
                region(
                  action === 'download'
                    ? remote!.wardrobe.summary!.regionScope
                    : localWardrobe!.regionScope
                )
              }}</span
            ></p
          >
          <p v-if="emptyWardrobe">{{ action === 'upload' ? t.emptyUpload : t.emptyDownload }}</p>
        </div></div
      >
      <p v-if="action === 'delete'" class="archive-cloud-note">{{ t.preserved }}</p>
      <p v-else-if="selected.length > 1" class="archive-cloud-note">{{ t.sharedCommit }}</p>
      <div
        v-if="
          action === 'download' &&
          selected.length &&
          local &&
          ((selected.includes('resonance') && local.resonance?.length) ||
            (selected.includes('wardrobe') &&
              local.wardrobe &&
              hasWardrobeSnapshot(local.wardrobe)))
        "
        class="archive-cloud-backup"
      >
        <p>{{ t.backupHint }}</p
        ><button type="button" :disabled="busy || !!pending" @click="backup"
          ><Download :size="16" aria-hidden="true" />{{ t.exportBackup }}</button
        >
        <p
          v-if="backupState !== 'idle'"
          role="status"
          :class="{ 'archive-cloud-error-text': backupState === 'error' }"
          >{{ backupState === 'ready' ? t.backupReady : t.backupFailed }}</p
        >
      </div>
      <p v-if="phase === 'ready' && !selected.length" class="archive-cloud-note">{{
        t.noSelection
      }}</p>
      <p v-if="status" class="archive-cloud-status" role="status" aria-live="polite"
        ><LoaderCircle :size="18" aria-hidden="true" />{{ status }}</p
      >
    </template>
    <div v-if="error" class="archive-cloud-error" role="alert"
      ><p>{{ message }}</p
      ><p v-if="traceId" class="archive-cloud-trace">{{ t.traceId }}: {{ traceId }}</p></div
    >
    <template #footer>
      <span v-if="!auth && remote" class="archive-cloud-footer-count"
        >{{ t.selected }} {{ selected.length }} {{ t.moduleUnit }}</span
      >
      <button
        type="button"
        class="confirm-dialog-button ghost"
        :disabled="busy"
        @click="sync.close"
        >{{ t.cancel }}</button
      >
      <button
        v-if="!auth && (phase === 'conflict' || phase === 'error')"
        type="button"
        class="confirm-dialog-button ghost"
        :disabled="busy || !sync.session.user.value"
        @click="sync.prepare()"
        >{{ t.refresh }}</button
      >
      <button
        v-else
        type="submit"
        class="confirm-dialog-button primary archive-cloud-confirm"
        :class="{ 'is-danger': action === 'delete' }"
        :disabled="auth ? busy : !canSubmit"
        >{{ busy ? t.working : pending ? t.retry : auth ? t[action] : t.confirm }}</button
      >
    </template>
  </CloudDialog>
</template>

<style scoped>
.archive-cloud-intro,
.archive-cloud-selection,
.archive-cloud-warning,
.archive-cloud-note,
.archive-cloud-backup,
.archive-cloud-status,
.archive-cloud-error,
.archive-cloud-footer-count {
  --archive-secondary: #756662;
  --archive-warning: #765019;
  --archive-danger: #a13e48;
  min-width: 0;
}
.archive-cloud-intro p,
.archive-cloud-module p,
.archive-cloud-warning p,
.archive-cloud-backup p,
.archive-cloud-error p {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
}
.archive-cloud-intro .archive-cloud-account {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
  color: var(--archive-secondary);
  font-size: 13px;
}
.archive-cloud-account strong {
  color: var(--heading);
  overflow-wrap: anywhere;
}
.archive-cloud-selection {
  padding: 0;
  margin: 0;
  border: 0;
  display: grid;
  gap: 12px;
}
.archive-cloud-selection legend {
  font-size: 13px;
  line-height: 1.6;
  color: var(--archive-secondary);
  margin-bottom: 12px;
  padding: 0;
}
.archive-cloud-module {
  border: 1px solid var(--line);
  border-radius: 14px;
  padding: 16px 18px;
}
.archive-cloud-module.is-selected {
  border-color: var(--pink-deep);
}
.archive-cloud-module .archive-cloud-module-label {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  font-size: 15px;
}
.archive-cloud-module-label input {
  width: 18px;
  height: 18px;
  margin: 0;
  accent-color: #9d545f;
  flex: none;
}
.archive-cloud-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 5px;
  background: var(--soft-accent);
  color: var(--text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.6;
}
.archive-cloud-badge.is-target {
  background: var(--yellow-soft);
  color: var(--archive-warning);
}
.archive-cloud-comparison {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 18px minmax(0, 1fr);
  align-items: start;
  gap: 16px;
  margin-top: 8px;
}
.archive-cloud-comparison.is-delete {
  grid-template-columns: minmax(0, 1fr);
}
.archive-cloud-save-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  margin-bottom: 10px;
  font-size: 12px;
  color: var(--archive-secondary);
}
.archive-cloud-arrow {
  margin-top: 36px;
  color: var(--archive-secondary);
}
.archive-cloud-count {
  color: var(--archive-secondary);
}
.archive-cloud-count strong {
  color: var(--heading);
  font-size: 26px;
  line-height: 1.2;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}
.archive-cloud-module .archive-cloud-region {
  margin-top: 4px;
  font-size: 13px;
  color: var(--archive-secondary);
}
.archive-cloud-module .archive-cloud-date {
  margin-top: 10px;
  color: var(--archive-secondary);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.archive-cloud-empty,
.archive-cloud-unavailable {
  color: var(--archive-secondary);
}
.archive-cloud-module .archive-cloud-unavailable {
  font-size: 13px;
  margin: 4px 0 12px;
}
.archive-cloud-details {
  margin-top: 8px;
  font-size: 12px;
  color: var(--archive-secondary);
}
.archive-cloud-details summary {
  padding: 8px 0;
  cursor: pointer;
}
.archive-cloud-details p {
  font-size: 12px;
}
.archive-cloud-warning {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--yellow-soft);
  color: var(--archive-warning);
}
.archive-cloud-warning > svg {
  flex: none;
  margin-top: 3px;
}
.archive-cloud-warning p + p {
  margin-top: 10px;
}
.archive-cloud-warning strong {
  font-weight: 600;
}
.archive-cloud-region-change {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  font-size: 13px;
}
p.archive-cloud-note {
  margin: 0;
  font-size: 13px;
  color: var(--archive-secondary);
  line-height: 1.7;
}
.archive-cloud-backup p {
  font-size: 13px;
  color: var(--archive-secondary);
}
.archive-cloud-backup button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 6px 0;
  border: 0;
  border-radius: 4px;
  background: transparent;
  color: var(--heading);
  font-size: 14px;
  text-decoration: underline;
  text-underline-offset: 4px;
}
.archive-cloud-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  min-height: 44px;
  font-size: 14px;
  color: var(--archive-secondary);
}
.archive-cloud-status svg {
  flex: none;
  animation: archive-cloud-spin 1s linear infinite;
}
.archive-cloud-error {
  border: 1px solid var(--archive-danger);
  border-radius: 12px;
  padding: 14px 16px;
  color: var(--archive-danger);
}
.archive-cloud-error .archive-cloud-trace {
  font-size: 12px;
  margin-top: 8px;
  overflow-wrap: anywhere;
}
.archive-cloud-backup .archive-cloud-error-text {
  color: var(--archive-danger);
}
.archive-cloud-footer-count {
  margin-right: auto;
  color: var(--archive-secondary);
  font-size: 12px;
}
.archive-cloud-module input:focus-visible,
.archive-cloud-details summary:focus-visible {
  outline: 2px solid var(--heading);
  outline-offset: 4px;
}
:where(:root[data-theme='dark']) .archive-cloud-intro,
:where(:root[data-theme='dark']) .archive-cloud-selection,
:where(:root[data-theme='dark']) .archive-cloud-warning,
:where(:root[data-theme='dark']) .archive-cloud-note,
:where(:root[data-theme='dark']) .archive-cloud-backup,
:where(:root[data-theme='dark']) .archive-cloud-status,
:where(:root[data-theme='dark']) .archive-cloud-error,
:where(:root[data-theme='dark']) .archive-cloud-footer-count {
  --archive-secondary: #c9b9b5;
  --archive-warning: #f0d294;
  --archive-danger: #ffb2b9;
}
:where(:root[data-theme='dark']) .archive-cloud-module-label input {
  accent-color: #efb0b2;
}
@keyframes archive-cloud-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .archive-cloud-status svg {
    animation: none;
  }
}
@media (max-width: 540px) {
  .archive-cloud-comparison {
    gap: 10px;
    grid-template-columns: minmax(0, 1fr) 16px minmax(0, 1fr);
  }
  .archive-cloud-module {
    padding: 12px;
  }
  .archive-cloud-count strong {
    font-size: 23px;
  }
  .archive-cloud-module .archive-cloud-date {
    font-size: 11px;
  }
  .archive-cloud-footer-count {
    flex-basis: 100%;
  }
  .archive-cloud-save-heading {
    min-height: 42px;
    align-content: start;
  }
}
@media (max-width: 360px) {
  .archive-cloud-comparison {
    grid-template-columns: minmax(0, 1fr);
  }
  .archive-cloud-arrow {
    margin: 0;
    transform: rotate(90deg);
  }
  .archive-cloud-save-heading {
    min-height: 0;
  }
}
</style>
