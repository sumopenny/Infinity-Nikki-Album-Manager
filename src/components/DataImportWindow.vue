<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check } from 'lucide-vue-next'
import ResonanceImportDialog from './ResonanceImportDialog.vue'
import { messages } from '../i18n'
import type { Language } from '../i18n/types'
import { useLatestRequest } from '../composables/useLatestRequest'
import { useModuleOperation } from '../composables/useOperationCoordinator'
import { useModalFocus } from '../composables/useModalFocus'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import {
  fetchPearpalSnapshot,
  PEARPAL_AUTH_FAILED,
  PEARPAL_UID_MISMATCH
} from '../utils/resonance/resonanceImport'
import {
  parseResonanceCookie,
  resonanceBookmarkScript,
  resonanceConsoleScript
} from '../utils/resonance/resonanceScripts'
import { loadResonanceRecords } from '../utils/resonance/resonanceStorage'
import { loadWardrobe } from '../utils/wardrobe/wardrobeStorage'
import { parseDataPreview, saveDataImport, type DataPreview } from '../utils/unifiedDataImport'
import { sortResonanceRecords } from '../utils/resonance/resonanceCatalog'

const props = withDefaults(
  defineProps<{ visible: boolean; language?: Language; disabled?: boolean }>(),
  { language: 'zh' }
)
const emit = defineEmits<{
  close: []
  imported: []
  notice: [message: string, tone: 'success' | 'error' | 'warning']
}>()
const text = (zh: string, en: string) => (props.language === 'zh' ? zh : en)
const t = computed(() => ({
  ...messages[props.language].resonance,
  addTitle: text('导入数据', 'Import data'),
  importing: text('正在获取数据，请稍候…', 'Loading data, please wait…'),
  fileDescription: text(
    '支持原始手账 JSON、共鸣记录 JSON 和衣橱备份（最大 10 MB）。预览后选择要导入的记录；文件未包含的数据类型不可选。',
    'Accepts raw notebook JSON, resonance JSON and wardrobe backups (up to 10 MB). Choose which records to import after previewing; unavailable data types are disabled.'
  )
}))
const method = ref<'pearpal' | 'file'>('pearpal'),
  cookieMethod = ref<'bookmark' | 'console'>('bookmark')
const cookieInput = ref(''),
  roleid = ref(''),
  token = ref(''),
  openid = ref(''),
  fileName = ref('')
const importing = ref(false),
  confirming = ref(false),
  error = ref('')
const panel = ref<HTMLElement | null>(null)
const preview = ref<DataPreview | null>(null)
const selectedResonance = ref(true),
  selectedWardrobe = ref(true)
const base = ref({ resonance: '', wardrobe: '' })
let fileBytes: Promise<{ content: string } | { error: unknown }> | null = null
const request = useLatestRequest()
const track = useModuleOperation('data-import')
const visible = computed(() => props.visible)
useBodyScrollLock(visible)
useModalFocus(visible, panel, close)
const bookmark = computed(() =>
  resonanceBookmarkScript(
    text('请在美鸭梨网站使用此书签。', 'Use this bookmark on the Pear-Pal website.')
  )
)
const canConfirm = computed(
  () =>
    !!preview.value &&
    ((selectedResonance.value && preview.value.resonance !== null) ||
      (selectedWardrobe.value && preview.value.wardrobe !== null))
)
const wardrobeCount = computed(
  () => Object.values(preview.value?.wardrobe?.entries ?? {}).filter((entry) => entry.owned).length
)
function invalidate() {
  request.invalidate()
  importing.value = false
  preview.value = null
  error.value = ''
}
function reset() {
  invalidate()
  cookieInput.value = roleid.value = token.value = openid.value = fileName.value = ''
  fileBytes = null

  method.value = 'pearpal'
  cookieMethod.value = 'bookmark'
  selectedResonance.value = selectedWardrobe.value = true
}
watch(visible, () => reset(), { immediate: true })
watch([roleid, token, openid], invalidate, { flush: 'sync' })
watch(cookieInput, (value) => {
  invalidate()
  if (!value.trim()) return
  try {
    const parsed = parseResonanceCookie(value)
    roleid.value = parsed.roleid
    token.value = parsed.token
    openid.value = parsed.id

    emit('notice', t.value.pasteSuccess, 'success')
  } catch {
    error.value = t.value.pasteFailed
  }
})
watch(method, () => {
  invalidate()
  fileName.value = ''
  fileBytes = null
})
function close() {
  if (!confirming.value) {
    reset()
    emit('close')
  }
}
function selectFile(event: Event) {
  const input = event.target as HTMLInputElement,
    file = input.files?.[0]
  input.value = ''
  invalidate()
  fileName.value = file?.name ?? ''
  // 选取即读取字节，避免手机文件引用失效；解析仍等待“获取预览”。
  fileBytes = !file
    ? null
    : file.size > 10 * 1024 * 1024
      ? Promise.resolve({ error: new Error('FILE_TOO_LARGE') })
      : file.text().then(
          (content) => ({ content }),
          (error) => ({ error })
        )
}
function report(cause: unknown) {
  const message = cause instanceof Error ? cause.message : ''
  if (message === 'MISSING_CREDENTIALS') {
    emit('notice', t.value.credentialsRequired, 'error')
    return
  }
  const errorMessage =
    message === PEARPAL_UID_MISMATCH
      ? t.value.uidMismatch
      : message === PEARPAL_AUTH_FAILED
        ? t.value.authFailed
        : message === 'LOCAL_CHANGED'
          ? text(
              '记录已在其他页面变更，请重新获取预览。',
              'Records changed in another tab. Preview again.'
            )
          : confirming.value
            ? t.value.saveError
            : t.value.fileInvalid
  emit('notice', errorMessage, 'error')
}
async function createPreview() {
  if (props.disabled || importing.value || confirming.value) return
  if (method.value === 'file' && !fileBytes) {
    error.value = t.value.fileRequired
    return
  }
  const current = request.begin()
  importing.value = true
  error.value = ''

  preview.value = null
  const bytes = fileBytes
  try {
    let raw: unknown
    if (method.value === 'file') {
      const result = await bytes!
      if ('error' in result) throw result.error
      raw = JSON.parse(result.content)
    } else {
      const credentials = {
        roleid: roleid.value.trim(),
        token: token.value.trim(),
        id: openid.value.trim()
      }
      if (!credentials.roleid || !credentials.token || !credentials.id)
        throw new Error('MISSING_CREDENTIALS')
      raw = await fetchPearpalSnapshot(credentials, current.signal)
    }
    const parsed = await parseDataPreview(raw)
    const [resonance, wardrobe] = await Promise.all([
      parsed.resonance === null ? null : loadResonanceRecords(),
      parsed.wardrobe === null ? null : loadWardrobe()
    ])
    if (!current.isCurrent()) return
    base.value = { resonance: JSON.stringify(resonance), wardrobe: JSON.stringify(wardrobe) }
    preview.value = parsed
    selectedResonance.value = parsed.resonance !== null
    selectedWardrobe.value = parsed.wardrobe !== null
    await nextTick()
    if (!current.isCurrent()) return
    const body = panel.value?.querySelector<HTMLElement>('.resonance-import-body')
    body?.scrollTo?.({
      top: body.scrollHeight,
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth'
    })
  } catch (cause) {
    if (current.isCurrent()) report(cause)
  } finally {
    if (current.isCurrent()) importing.value = false
  }
}
async function confirm() {
  if (!canConfirm.value || confirming.value || props.disabled) return
  confirming.value = true
  error.value = ''
  try {
    const data = JSON.parse(JSON.stringify(preview.value)) as DataPreview
    await track(() =>
      saveDataImport(
        data,
        { resonance: selectedResonance.value, wardrobe: selectedWardrobe.value },
        base.value
      )
    )
    emit('imported')
    confirming.value = false
    close()
    emit(
      'notice',
      data.skippedPools
        ? t.value.partialImport(data.skippedPools)
        : text('所选记录已导入。', 'Selected records imported.'),
      data.skippedPools ? 'warning' : 'success'
    )
  } catch (cause) {
    report(cause)
  } finally {
    confirming.value = false
  }
}
async function copyScript(kind: 'bookmark' | 'console') {
  try {
    await navigator.clipboard.writeText(
      kind === 'bookmark' ? bookmark.value : resonanceConsoleScript
    )
    emit('notice', t.value.copyCodeSuccess, 'success')
  } catch {
    emit('notice', text('复制代码失败，请重试。', 'Failed to copy code. Please retry.'), 'error')
  }
}
</script>

<template>
  <ResonanceImportDialog
    :visible="visible"
    :t="t"
    title-id="data-import-title"
    :import-method="method"
    :cookie-method="cookieMethod"
    show-mobile-credential-tip
    :file-name="fileName"
    :bookmark-script="bookmark"
    :importing="importing"
    :confirming="confirming"
    :disabled="disabled"
    :confirm-disabled="!canConfirm"
    :has-preview="!!preview"
    v-model:cookie-input="cookieInput"
    v-model:roleid="roleid"
    v-model:token="token"
    v-model:openid="openid"
    @panel="panel = $event"
    @close="close"
    @select-method="method = $event"
    @select-cookie-method="cookieMethod = $event"
    @select-file="selectFile"
    @copy-script="copyScript"
    @preview="createPreview"
    @confirm="confirm"
  >
    <p v-if="error" class="data-import-error" role="alert">{{ error }}</p>
    <section v-if="preview" class="resonance-preview">
      <h3
        >{{ t.previewTitle
        }}<template v-if="preview.resonance !== null">
          ({{ preview.resonance.length }})</template
        ></h3
      >
      <p v-if="preview.skippedPools">{{ t.partialImport(preview.skippedPools) }}</p>
      <div v-if="preview.resonance !== null" class="fortune-time-table-wrap resonance-preview-wrap">
        <table class="fortune-time-table"
          ><thead
            ><tr
              ><th>{{ t.previewBanner }}</th
              ><th>{{ t.previewOutfit }}</th
              ><th>{{ t.previewRarity }}</th
              ><th>{{ t.previewSet1 }}</th></tr
            ></thead
          >
          <tbody
            ><tr v-for="record in sortResonanceRecords(preview.resonance)" :key="record.id"
              ><td>{{ record.bannerName[language] }}</td
              ><td>{{ record.outfitName[language] }}</td
              ><td>{{ t.rarity(record.rarity) }}</td
              ><td>{{
                record.sets
                  .flatMap((set) => set.parts)
                  .reduce((sum, part) => sum + Math.max(0, part.pullNumber), 0)
              }}</td></tr
            ></tbody
          >
        </table>
      </div>
      <p v-if="preview.wardrobe !== null">{{
        text(`衣橱：${wardrobeCount} 件已拥有部件`, `Wardrobe: ${wardrobeCount} owned pieces`)
      }}</p>
      <div
        class="data-import-targets"
        role="group"
        :aria-label="text('选择导入内容', 'Choose data to import')"
      >
        <label class="cleanup-account-all"
          ><input
            v-model="selectedResonance"
            type="checkbox"
            :disabled="confirming || preview.resonance === null"
          /><span
            class="date-select-button"
            :class="{ active: selectedResonance }"
            aria-hidden="true"
            ><Check :size="16" /></span
          ><span>{{ text('导入共鸣记录', 'Import resonance records') }}</span></label
        >
        <label class="cleanup-account-all"
          ><input
            v-model="selectedWardrobe"
            type="checkbox"
            :disabled="confirming || preview.wardrobe === null"
          /><span
            class="date-select-button"
            :class="{ active: selectedWardrobe }"
            aria-hidden="true"
            ><Check :size="16" /></span
          ><span>{{ text('导入衣橱记录', 'Import wardrobe records') }}</span></label
        >
      </div>
      <p v-if="preview.resonance === null">{{
        text(
          '数据中没有可导入的共鸣记录，此项不可选。',
          'No importable resonance records; this option is unavailable.'
        )
      }}</p>
      <p v-if="preview.wardrobe === null">{{
        text(
          '数据不包含衣橱清单，此项不可选。',
          'This data does not include a wardrobe list; this option is unavailable.'
        )
      }}</p>
      <p class="data-import-warning">{{
        text(
          '确认后整份覆盖勾选的记录，未勾选的记录保持不变。建议先导出备份。',
          'Confirmation replaces the selected records entirely. Unselected records stay unchanged. Export a backup first.'
        )
      }}</p>
    </section>
  </ResonanceImportDialog>
</template>
<style scoped>
.resonance-preview {
  margin-top: 18px;
}
.resonance-preview h3 {
  margin-bottom: 8px;
}
.resonance-preview-wrap {
  max-height: 240px;
  overflow: auto;
}
/* 保留原生复选框语义，外观复用日期选择按钮；两个选项固定同行。 */
.data-import-targets {
  display: flex;
  flex-wrap: nowrap;
  gap: 12px;
  margin: 16px 0;
}
.data-import-targets label {
  position: relative;
  min-width: 0;
  flex: 0 1 auto;
}
.data-import-targets input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
}
.data-import-targets .date-select-button {
  margin-left: 0;
  flex-shrink: 0;
}
.data-import-targets input:focus-visible + .date-select-button {
  outline: 2px solid var(--pink-deep);
  outline-offset: 2px;
}
.data-import-targets input:disabled ~ span {
  opacity: 0.5;
}
.data-import-targets input:disabled + .date-select-button {
  border-color: var(--line);
  color: transparent;
}
.data-import-error {
  color: var(--notice-error);
}
.data-import-warning {
  color: var(--notice-warning);
}
</style>
