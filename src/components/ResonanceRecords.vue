<script setup lang="ts">
import { useLatestRequest } from '../composables/useLatestRequest'
import { useModuleOperation } from '../composables/useOperationCoordinator'
const trackOperation = useModuleOperation('resonance')
import CollectionActions from './CollectionActions.vue'
import ResonanceCloudActions from './ResonanceCloudActions.vue'
import { computed, nextTick, onMounted, ref, toRaw, watch } from 'vue'
import {
  Bookmark,
  Copy,
  ExternalLink,
  FileUp,
  Plus,
  Terminal,
  Trash2,
  Upload,
  X
} from 'lucide-vue-next'
import ConfirmDialog from './ConfirmDialog.vue'
import type { Language } from '../i18n/types'
import { messages } from '../i18n'
import {
  importFromPearpal,
  PEARPAL_AUTH_FAILED,
  PEARPAL_NO_RECORDS,
  PEARPAL_UID_MISMATCH
} from '../utils/resonance/resonanceImport'
import {
  createResonanceExport,
  parseResonanceFile,
  RESONANCE_FILE_EMPTY,
  RESONANCE_FILE_INVALID
} from '../utils/resonance/resonanceFile'
import {
  getResonancePartIconUrl,
  sortResonanceParts,
  sortResonanceRecords,
  type ResonanceBannerOrder,
  type ResonanceRarityFilter
} from '../utils/resonance/resonanceCatalog'
import {
  parseResonanceCookie,
  resonanceBookmarkScript,
  resonanceConsoleScript
} from '../utils/resonance/resonanceScripts'
import {
  loadResonanceRecords,
  saveResonanceRecords
} from '../utils/resonance/resonanceStorage'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import type { ResonanceLocalizedName, ResonanceRecord } from '../utils/resonance/resonanceTypes'

const props = withDefaults(
  defineProps<{
    language?: Language
    bannerOrder?: ResonanceBannerOrder
    rarityFilter?: ResonanceRarityFilter
    disabled?: boolean
    mobileActionsTarget?: string
  }>(),
  { language: 'zh', bannerOrder: 'newest', rarityFilter: 'all' }
)
const t = computed(() => messages[props.language].resonance)
const emit = defineEmits<{
  notice: [payload: { message: string; tone: 'success' | 'warning' | 'error'; source: 'resonance' }]
  clearNotice: []
  recordsChange: [records: ResonanceRecord[]]
}>()

const PEARPAL_URL = 'https://myl.nuanpaper.com/home'
type CookieMethod = 'bookmark' | 'console'
type ImportMethod = 'pearpal' | 'file'

const records = ref<ResonanceRecord[]>([])
const recordsLoaded = ref(false)
const cloudOpen = ref(false)
const selectedSet = ref<Record<string, 1 | 2>>({})
const showAddDialog = ref(false)
const showClearConfirm = ref(false)
const importing = ref(false)
const previewRequest = useLatestRequest()
/** 关闭、切换输入时取消预览，晚到的结果和错误不能写入新窗口。 */
function invalidatePreview() {
  previewRequest.invalidate()
  importing.value = false
  progressText.value = ''
}
const confirming = ref(false)
const clearing = ref(false)
const cookieMethod = ref<CookieMethod>('bookmark')
const importMethod = ref<ImportMethod>('pearpal')
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const cookieInput = ref('')
const token = ref('')
const roleid = ref('')
const openid = ref('')
const preview = ref<ResonanceRecord[]>([])
const skippedPools = ref(0)
const progressText = ref('')
const dialogRef = ref<HTMLElement | null>(null)

/** 预览渲染完成后平滑滚动正文到底部；遵循减少动态效果设置，并忽略已关闭或替换的预览。 */
watch(preview, async (result) => {
  if (!result.length) return
  await nextTick()
  if (!showAddDialog.value || preview.value !== result) return
  const body = dialogRef.value?.querySelector<HTMLElement>('.resonance-import-body')
  if (body) body.scrollTo({
    top: body.scrollHeight,
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'
  })
})
let previousActiveElement: HTMLElement | null = null
let activeNoticeId: string | null = null
useBodyScrollLock(showAddDialog)

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    if (!confirming.value) closeDialog()
    return
  }
  if (event.key !== 'Tab' || !dialogRef.value) return
  const focusable = [
    ...dialogRef.value.querySelectorAll<HTMLElement>(
      'button, [href], input:not(.visually-hidden), textarea, [tabindex]:not([tabindex="-1"])'
    )
  ].filter((element) => !element.hasAttribute('disabled'))
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(showAddDialog, (visible) => {
  if (visible)
    previousActiveElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
  else {
    previousActiveElement?.focus()
    previousActiveElement = null
  }
})

const sortedRecords = computed(() =>
  sortResonanceRecords(records.value, props.bannerOrder, props.rarityFilter)
)
watch(records, (value) => emit('recordsChange', value), { flush: 'sync' })
const consoleScript = computed(() => resonanceConsoleScript)
const bookmarkScript = computed(() =>
  resonanceBookmarkScript(
    props.language === 'zh'
      ? '请在美鸭梨网站上使用此书签'
      : 'Please use this bookmark on the Pear-Pal site'
  )
)
const clearConfirmLabel = computed(() => (clearing.value ? t.value.clearing : t.value.clearConfirm))

function displayName(value: ResonanceLocalizedName): string {
  return value[props.language] || value.zh || value.en
}

function notify(id: string, message: string, tone: 'success' | 'warning' | 'error') {
  activeNoticeId = id
  emit('notice', { message, tone, source: 'resonance' })
}

function clearNotice(id?: string) {
  if (!activeNoticeId || (id && activeNoticeId !== id)) return
  activeNoticeId = null
  emit('clearNotice')
}

function currentSet(record: ResonanceRecord) {
  return record.sets[(selectedSet.value[record.id] ?? 1) - 1]
}
function totalPullsLabel(record: ResonanceRecord): string {
  return t.value.pulls(outfitPulls(record).total)
}
function outfitPulls(record: ResonanceRecord): { total: number; average: number } {
  const obtained = record.sets.flatMap((set) => set.parts).filter((part) => part.pullNumber > 0)
  const total = obtained.reduce((sum, part) => sum + part.pullNumber, 0)
  return { total, average: obtained.length ? total / obtained.length : 0 }
}
function toggleSet(record: ResonanceRecord) {
  selectedSet.value[record.id] = (selectedSet.value[record.id] ?? 1) === 1 ? 2 : 1
}

function openDialog() {
  if (props.disabled || cloudOpen.value) return
  clearNotice()
  invalidatePreview()
  showAddDialog.value = true
  preview.value = []
  skippedPools.value = 0
  progressText.value = ''
  importMethod.value = 'pearpal'
  selectedFile.value = null
}

function closeDialog() {
  if (confirming.value) return
  invalidatePreview()
  clearNotice()
  showAddDialog.value = false
  preview.value = []
  skippedPools.value = 0
  progressText.value = ''
  cookieInput.value = ''
  token.value = ''
  roleid.value = ''
  openid.value = ''
  selectedFile.value = null
  if (fileInput.value) fileInput.value.value = ''
}

function selectImportMethod(value: ImportMethod) {
  invalidatePreview()
  importMethod.value = value
  preview.value = []
  skippedPools.value = 0
  clearNotice()
}

function selectFile(event: Event) {
  invalidatePreview()
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
  preview.value = []
  skippedPools.value = 0
  clearNotice()
}

async function createFilePreview() {
  return trackOperation(async () => {
    clearNotice()
    if (!selectedFile.value) {
      notify('file-required', t.value.fileRequired, 'warning')
      return
    }
    const request = previewRequest.begin()
    importing.value = true
    try {
      const result = parseResonanceFile(JSON.parse(await selectedFile.value.text()) as unknown)
      if (!request.isCurrent()) return
      preview.value = result.records
      skippedPools.value = result.skippedPools
    } catch (caught) {
      if (!request.isCurrent()) return
      const message = caught instanceof Error ? caught.message : ''
      notify(
        'file-error',
        message === RESONANCE_FILE_EMPTY
          ? t.value.fileEmpty
          : message === RESONANCE_FILE_INVALID || caught instanceof SyntaxError
            ? t.value.fileInvalid
            : t.value.importError,
        'error'
      )
    } finally {
      if (request.isCurrent()) importing.value = false
    }
  })
}

function exportRecords() {
  if (props.disabled || cloudOpen.value) return
  if (!records.value.length) return
  try {
    const blob = new Blob([JSON.stringify(createResonanceExport(records.value), null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nikki-cube-resonance-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    notify('export-success', t.value.exportSuccess, 'success')
  } catch {
    notify('export-error', t.value.exportError, 'error')
  }
}

function selectCookieMethod(value: CookieMethod) {
  cookieMethod.value = value
}
function hideBrokenImage(event: Event) {
  ;(event.target as HTMLImageElement).hidden = true
}

watch(cookieInput, (value) => {
  if (!value) {
    clearNotice('cookie-parse')
    return
  }
  if (value.length < 10) return
  try {
    const parsed = parseResonanceCookie(value)
    token.value = parsed.token
    openid.value = parsed.id
    roleid.value = parsed.roleid
    const hasUid = Boolean(parsed.roleid)
    notify(
      hasUid ? 'cookie-paste' : 'cookie-no-uid',
      hasUid ? t.value.pasteSuccess : `${t.value.pasteSuccess} ${t.value.pasteSuccessNoUid}`,
      hasUid ? 'success' : 'warning'
    )
  } catch {
    notify('cookie-parse', t.value.pasteFailed, 'error')
  }
})

watch(
  [token, openid, roleid],
  () => {
    invalidatePreview()
    preview.value = []
    skippedPools.value = 0
  },
  { flush: 'sync' }
)

watch(roleid, (value) => {
  if (value.trim()) clearNotice('cookie-no-uid')
})

async function copyScript(kind: CookieMethod) {
  clearNotice()
  const code = kind === 'bookmark' ? bookmarkScript.value : consoleScript.value
  try {
    await navigator.clipboard.writeText(code)
  } catch {
    notify('copy-script-error', t.value.importError, 'error')
  }
}

async function createPreview() {
  return trackOperation(async () => {
    const request = previewRequest.begin()
    importing.value = true
    clearNotice()
    preview.value = []
    skippedPools.value = 0
    progressText.value = ''
    try {
      const credentials = {
        token: token.value.trim(),
        roleid: roleid.value.trim(),
        id: openid.value.trim()
      }
      if (!credentials.token || !credentials.id || !credentials.roleid)
        throw new Error('MISSING_CREDENTIALS')
      const result = await importFromPearpal(
        credentials,
        (value) => {
          if (request.isCurrent())
            progressText.value = t.value.processBanner(value.current, value.total)
        },
        request.signal
      )
      if (!request.isCurrent()) return
      preview.value = result.records
      skippedPools.value = result.skippedPools
      if (!preview.value.length) throw new Error(PEARPAL_NO_RECORDS)
    } catch (caught) {
      if (!request.isCurrent()) return
      const message = caught instanceof Error ? caught.message : ''
      const displayMessage =
        message === 'MISSING_CREDENTIALS'
          ? t.value.credentialsRequired
          : message === PEARPAL_UID_MISMATCH
            ? t.value.uidMismatch
            : message === PEARPAL_AUTH_FAILED
              ? t.value.authFailed
              : message === PEARPAL_NO_RECORDS
                ? t.value.noRecords
                : message || t.value.importError
      notify('preview-error', displayMessage, 'error')
    } finally {
      if (request.isCurrent()) {
        importing.value = false
        progressText.value = ''
      }
    }
  })
}

async function confirmImport() {
  return trackOperation(async () => {
    if (props.disabled || confirming.value || !preview.value.length) return
    if (!recordsLoaded.value) {
      notify(
        'load-error',
        props.language === 'zh'
          ? '共鸣记录读取失败，请刷新页面后重试。'
          : 'Records could not be loaded. Reload the page and retry.',
        'error'
      )
      return
    }
    confirming.value = true
    clearNotice()
    try {
      const importedRecords = preview.value.map((record) => toRaw(record))
      const importedCount = preview.value.length
      const skippedCount = skippedPools.value
      // 本次预览整批替换全部共鸣记录；事务提交成功后才更新页面。
      await saveResonanceRecords(importedRecords)
      records.value = importedRecords
      confirming.value = false
      closeDialog()
      notify(
        'import-success',
        skippedCount ? t.value.partialImport(skippedCount) : t.value.importSuccess(importedCount),
        skippedCount ? 'warning' : 'success'
      )
    } catch {
      notify('save-error', t.value.saveError, 'error')
    } finally {
      confirming.value = false
    }
  })
}

function requestClearRecords() {
  if (!records.value.length || clearing.value) return
  clearNotice()
  showClearConfirm.value = true
}

function closeClearConfirm() {
  if (!clearing.value) {
    clearNotice()
    showClearConfirm.value = false
  }
}

async function clearRecords() {
  return trackOperation(async () => {
    if (props.disabled || clearing.value || !records.value.length) return
    clearing.value = true
    clearNotice()
    try {
      await saveResonanceRecords([])
      records.value = []
      selectedSet.value = {}
      showClearConfirm.value = false
      notify('clear-success', t.value.clearSuccess, 'success')
    } catch {
      notify('clear-error', t.value.clearError, 'error')
    } finally {
      clearing.value = false
    }
  })
}

async function reload() {
  return trackOperation(async () => {
    try {
      records.value = await loadResonanceRecords()
      recordsLoaded.value = true
    } catch {
      notify(
        'load-error',
        props.language === 'zh'
          ? '共鸣记录读取失败，请刷新页面后重试。'
          : 'Records could not be loaded. Reload the page and retry.',
        'error'
      )
    }
  })
}
onMounted(reload)
defineExpose({ reload })
</script>

<template>
  <section class="resonance-page" aria-labelledby="resonance-title">
    <header class="gallery-header resonance-header">
      <div>
        <p class="eyebrow">RESONANCE</p>
        <h2 id="resonance-title">{{ t.title }}</h2>
      </div>
      <CollectionActions persistent-secondary :mobile-target="mobileActionsTarget" class="resonance-actions" :label="language === 'zh' ? '共鸣操作' : 'Resonance actions'"><button class="primary-button" type="button" :aria-label="t.addData" :title="t.addData" :disabled="disabled || cloudOpen" @click="openDialog"><Plus :size="16" aria-hidden="true" /><span class="collection-action-label">{{ t.addData }}</span></button><template #secondary>
        <ResonanceCloudActions :language="language" :disabled="disabled || showAddDialog || showClearConfirm" @lock="cloudOpen = $event" @restored="records = $event; selectedSet = {}" @notice="(message, tone) => notify('cloud-' + tone, message, tone)" />
        <button type="button" :disabled="disabled || cloudOpen || !records.length || clearing" @click="requestClearRecords"><Trash2 :size="16" aria-hidden="true" />{{ t.clearRecords }}</button>
        <button type="button" :disabled="disabled || cloudOpen || !records.length" @click="exportRecords"><Upload :size="16" aria-hidden="true" />{{ t.exportData }}</button>

</template></CollectionActions>
    </header>

    <div v-if="!records.length" class="resonance-empty">
      <h3>{{ t.emptyTitle }}</h3>
      <p>{{ t.emptyDescription }}</p>
      <button class="primary-button desktop-only" type="button" :disabled="disabled || cloudOpen" @click="openDialog"><Plus :size="16" aria-hidden="true" />{{ t.addData }}</button>
    </div>

    <div v-else-if="!sortedRecords.length" class="resonance-empty">
      <h3>{{ t.noMatchingRarity }}</h3>
    </div>

    <div v-else class="resonance-list">
      <article v-for="record in sortedRecords" :id="`resonance-record-${record.id}`" :key="record.id" class="resonance-record">
        <div class="resonance-record-heading">
          <div class="resonance-record-title-row">
            <h3 :title="`${displayName(record.outfitName)} ${t.rarity(record.rarity)}`">{{ displayName(record.outfitName) }} {{ t.rarity(record.rarity) }}</h3>
            <span class="resonance-banner-name" :title="displayName(record.bannerName)">{{ displayName(record.bannerName) }}</span>
          </div>
          <p>{{ totalPullsLabel(record) }} <span aria-hidden="true">|</span> {{ t.average(outfitPulls(record).average.toFixed(1)) }}</p>
        </div>
        <div class="resonance-record-body">
          <div class="resonance-outfit-image"><img :src="record.outfitImageUrl" :alt="displayName(record.outfitName)" referrerpolicy="no-referrer" @error="hideBrokenImage" /></div>
          <div class="resonance-parts">
            <div
              v-for="part in sortResonanceParts(currentSet(record).parts)"
              :key="part.id"
              class="resonance-part"
              :class="{ 'is-even-banner': Number(record.bannerId) % 2 === 0, 'is-missing': part.pullNumber === 0 && !part.manual }"
            >
              <img :src="getResonancePartIconUrl(part.id)" :alt="displayName(part.name)" referrerpolicy="no-referrer" @error="hideBrokenImage" />
              <span class="resonance-pull-number" :class="{ missing: part.pullNumber === 0 && !part.manual }">{{ part.manual ? '*' : part.pullNumber }}</span>
            </div>
          </div>
        </div>
        <button class="resonance-second-set" type="button" @click="toggleSet(record)">
          {{ (selectedSet[record.id] ?? 1) === 1 ? t.secondSet : t.firstSet }}
        </button>
      </article>
    </div>

    <Teleport to="body">
      <Transition name="confirm-dialog">
        <div
          v-if="showAddDialog"
          class="dialog-overlay resonance-import-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="resonance-import-title"
          @click.self="closeDialog"
          @keydown="handleKeydown"
        >
          <section ref="dialogRef" class="dialog-panel resonance-import-panel">
            <header class="resonance-import-header">
              <h2 id="resonance-import-title">{{ t.addTitle }}</h2>
              <button type="button" :aria-label="t.close" :title="t.close" :disabled="confirming" @click="closeDialog">
                <X :size="19" aria-hidden="true" />
              </button>
            </header>

            <div class="resonance-import-body">
              <div class="resonance-choice-row" role="group" :aria-label="t.importMethod">
                <button type="button" class="resonance-choice" :aria-pressed="importMethod === 'pearpal'" @click="selectImportMethod('pearpal')">{{ t.fromPearpal }}</button>
                <button type="button" class="resonance-choice" :aria-pressed="importMethod === 'file'" @click="selectImportMethod('file')">{{ t.fromFile }}</button>
              </div>
              <section v-if="importMethod === 'file'" class="parse-tools-section resonance-info-card resonance-file-card">
                <p>{{ t.fileDescription }}</p>
                <div class="resonance-file-picker">
                  <input ref="fileInput" class="visually-hidden" type="file" accept=".json,application/json" :aria-label="t.chooseFile" @change="selectFile" />
                  <button type="button" class="resonance-file-button" @click="fileInput?.click()">
                    <FileUp :size="16" aria-hidden="true" />{{ t.chooseFile }}
                  </button>
                  <span class="resonance-file-name" :class="{ 'has-file': selectedFile }" role="status" :title="selectedFile?.name">
                    {{ selectedFile?.name || t.noFileSelected }}
                  </span>
                </div>
              </section>
              <section v-if="importMethod === 'pearpal'">
                <h3>{{ t.loginPearpal }}</h3>
                <div class="parse-tools-section resonance-info-card">
                  <p>{{ t.loginPearpalDesc }} <a :href="PEARPAL_URL" target="_blank" rel="noreferrer noopener">{{ t.pearpalSite }}<ExternalLink :size="12" aria-hidden="true" /></a></p>
                </div>
              </section>

              <section v-if="importMethod === 'pearpal'">
                <h3>{{ t.getCookie }}</h3>
                <p class="resonance-hint">{{ t.getCookieDesc }}</p>
                <p class="resonance-source-attribution"><strong>{{ t.sourceAttributionLabel }}</strong><span>{{ t.sourceAttribution }}</span></p>
                <div class="resonance-choice-row" role="group" :aria-label="t.cookieMethods">
                  <button type="button" class="resonance-choice" :aria-pressed="cookieMethod === 'bookmark'" @click="selectCookieMethod('bookmark')"><Bookmark :size="14" aria-hidden="true" />{{ t.bookmarkMethod }}</button>
                  <button type="button" class="resonance-choice" :aria-pressed="cookieMethod === 'console'" @click="selectCookieMethod('console')"><Terminal :size="14" aria-hidden="true" />{{ t.consoleMethod }}</button>
                </div>

                <div class="parse-tools-section resonance-cookie-guide">
                  <h4>{{ t.cookieStepsTitle }}</h4>
                  <ol v-if="cookieMethod === 'bookmark'" class="resonance-steps">
                    <li>
                      {{ t.bookmarkStep1 }}
                      <a class="resonance-inline-action" :href="bookmarkScript" @click.prevent="copyScript('bookmark')"><Bookmark :size="14" aria-hidden="true" />{{ t.pearpalSite }} Cookie</a>
                    </li>
                    <li>{{ t.bookmarkStep2 }}</li>
                    <li>{{ t.bookmarkStep3 }}</li>
                    <li>{{ t.bookmarkStep4 }}</li>
                    <li>{{ t.bookmarkStep5 }}</li>
                  </ol>
                  <template v-else>
                    <ol class="resonance-steps">
                      <li>{{ t.consoleStep2 }}</li>
                      <li>{{ t.consoleStep3 }}</li>
                      <li>
                        {{ t.consoleStep4 }}
                        <button class="resonance-inline-action" type="button" @click="copyScript('console')"><Copy :size="14" aria-hidden="true" />{{ t.copyCode }}</button>
                      </li>
                      <li>{{ t.consoleStep5 }}</li>
                      <li>{{ t.consoleStep6 }}</li>
                    </ol>
                  </template>
                  <p v-if="cookieMethod === 'bookmark'" class="resonance-hint">{{ t.bookmarkTip }}</p>
                  <p class="resonance-security-note">{{ t.securityNote }}</p>

                  <label class="photo-params-paste resonance-paste">
                    <span>{{ t.pasteHere }}</span>
                    <textarea v-model="cookieInput" rows="3" spellcheck="false" placeholder='{"roleid":"123456","token":"...","id":"654321"}'></textarea>
                  </label>

                  <div class="resonance-form">
                    <label><span>{{ t.roleId }}</span><input v-model="roleid" autocomplete="off" inputmode="numeric" /></label>
                    <label><span>{{ t.token }}</span><input v-model="token" type="password" autocomplete="off" /></label>
                    <label><span>{{ t.openId }}</span><input v-model="openid" autocomplete="off" /></label>
                  </div>
                </div>
              </section>

              <p v-if="progressText" class="resonance-status-line is-progress" role="status">{{ progressText }}</p>
              <p v-if="preview.length && skippedPools" class="resonance-status-line is-warning" role="status">{{ t.partialImport(skippedPools) }}</p>

              <section v-if="preview.length" class="resonance-preview">
                <h3>{{ t.previewTitle }} ({{ preview.length }})</h3>
                <p class="resonance-status-line is-warning">{{ t.replaceAllNotice }}</p>
                <div class="fortune-time-table-wrap resonance-preview-wrap">
                  <table class="fortune-time-table">
                    <thead>
                      <tr>
                        <th>{{ t.previewBanner }}</th>
                        <th>{{ t.previewOutfit }}</th>
                        <th>{{ t.previewRarity }}</th>
                        <th>{{ t.previewSet1 }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="record in sortResonanceRecords(preview)" :key="record.id">
                        <td>{{ displayName(record.bannerName) }}</td>
                        <td>{{ displayName(record.outfitName) }}</td>
                        <td>{{ t.rarity(record.rarity) }}</td>
                        <td>{{ outfitPulls(record).total }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
            </div>

            <footer class="resonance-import-footer">
              <button v-if="!preview.length" class="primary-button" type="button" :disabled="importing" @click="importMethod === 'file' ? createFilePreview() : createPreview()">{{ importing ? t.importing : t.import }}</button>
              <button v-else class="primary-button" type="button" :disabled="confirming" @click="confirmImport">{{ confirming ? t.saving : t.confirmImport }}</button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>

    <ConfirmDialog
      :visible="showClearConfirm"
      :title="t.clearTitle"
      :message="t.clearMessage"
      tone="danger"
      :confirm-label="clearConfirmLabel"
      :cancel-label="t.clearCancel"
      :close-label="t.close"
      @confirm="clearRecords"
      @cancel="closeClearConfirm"
    />
  </section>
</template>

<style scoped>
.resonance-page { min-width: 0; }
.resonance-header { margin-bottom: 18px; }
.resonance-actions { flex-wrap: wrap; }
.resonance-empty { display: grid; min-height: 280px; place-items: center; align-content: center; gap: 10px; padding: 32px; border: 1px dashed var(--line); border-radius: var(--ui-radius); color: var(--muted); text-align: center; }
.resonance-empty h3, .resonance-empty p { margin: 0; }
/* 空列表按钮沿用公共高度，图标与文字在按钮内部横向、垂直居中。 */
.resonance-empty > button { align-items: center; justify-content: center; gap: 6px; }
.resonance-record { scroll-margin-top: calc(var(--sidebar-sticky-top) + 12px); margin-bottom: 16px; padding: 18px; border: 1px solid var(--line); border-radius: var(--ui-radius); background: var(--surface); }
/* 标题独占一行；两侧允许收缩并省略长名称，窄屏仍保持卡池居右。 */
.resonance-record-title-row { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
.resonance-record-title-row h3 { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.resonance-record-heading h3, .resonance-record-heading p { margin: 0; }
.resonance-record-heading p { margin-top: 7px; color: var(--muted); font-size: 13px; }
.resonance-banner-name { max-width: 45%; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--muted); font-size: 13px; text-align: right; }
.resonance-record-body { display: flex; gap: 18px; margin-top: 18px; align-items: flex-start; }
.resonance-outfit-image { width: min(180px, 28%); aspect-ratio: 448 / 656; overflow: hidden; border-radius: 8px; background: var(--frame-bg) url('../../img/back.png') center / cover no-repeat; }
.resonance-outfit-image img, .resonance-part img { width: 100%; height: 100%; object-fit: cover; }
.resonance-outfit-image img[hidden], .resonance-part img[hidden] { display: none; }
.resonance-parts { display: grid; flex: 1; grid-template-columns: repeat(auto-fill, minmax(74px, 1fr)); gap: 10px; }
.resonance-part { position: relative; aspect-ratio: 1; overflow: visible; border-radius: 8px; background: var(--frame-bg) url('../../img/pinkCardBg.png') center / contain no-repeat; }
.resonance-part.is-even-banner { background-image: url('../../img/purpleCardBg.png'); }
.resonance-part.is-missing { background-image: url('../../img/silverCardBg.png'); }
.resonance-part img {
  /* 本次修复：消除行内图片的基线留白，避免撑高方形卡片导致背景上下露底。 */
  display: block;
  border-radius: 8px;
}
.resonance-pull-number { position: absolute; right: -4px; bottom: -4px; display: grid; width: 25px; height: 25px; place-items: center; border: 2px solid var(--surface); border-radius: 50%; background: var(--pink-deep); color: #fff; font-size: 11px; font-weight: 800; }
.resonance-pull-number.missing { background: var(--muted); }
.resonance-second-set { margin-top: 14px; border: 0; background: transparent; color: var(--pink-deep); font-size: 13px; font-weight: 700; cursor: pointer; }
.resonance-choice-row { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.resonance-choice { display: inline-flex; align-items: center; gap: 6px; }
.resonance-cookie-guide { display: grid; gap: 10px; margin-top: 12px; }
.resonance-cookie-guide h4, .resonance-cookie-guide p { margin: 0; }
.resonance-steps { margin: 0; padding-left: 22px; }
.resonance-steps li + li { margin-top: 6px; }
.resonance-inline-action { display: inline-flex; align-items: center; gap: 5px; }
.resonance-security-note { color: var(--muted); font-size: 13px; }
.resonance-paste { display: grid; gap: 6px; }
.resonance-paste textarea { width: 100%; resize: vertical; }
.resonance-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.resonance-form label { display: grid; min-width: 0; gap: 5px; }
.resonance-form input { width: 100%; min-width: 0; }
.resonance-preview { margin-top: 18px; }
.resonance-preview h3 { margin-bottom: 8px; }
.resonance-preview-wrap { max-height: 240px; overflow: auto; }
.resonance-import-footer { display: flex; justify-content: flex-end; gap: 8px; padding-top: 12px; }
@media (max-width: 600px) {
  .resonance-record { padding: 14px; }
  .resonance-record-body { gap: 12px; }
  .resonance-outfit-image { width: 35%; }
  .resonance-parts { grid-template-columns: repeat(3, minmax(52px, 1fr)); gap: 8px; }
  .resonance-form { grid-template-columns: 1fr; }
}
</style>
