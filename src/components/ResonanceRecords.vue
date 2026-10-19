<script setup lang="ts">
import { backupBaseName } from '../utils/backup/backupName'
import MobileEmptyScreenshot from './MobileEmptyScreenshot.vue'
import { useCompactLayout } from '../composables/useCompactLayout'
import { useModuleOperation } from '../composables/useOperationCoordinator'
const trackOperation = useModuleOperation('resonance')
import ResonanceDataActions from './ResonanceDataActions.vue'
import DataImportWindow from './DataImportWindow.vue'
import ResonanceCloudActions from './ResonanceCloudActions.vue'
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import ConfirmDialog from './ConfirmDialog.vue'
import WardrobeOutfitDialog from './WardrobeOutfitDialog.vue'
import WardrobeItemDialog from './WardrobeItemDialog.vue'
import { useLatestRequest } from '../composables/useLatestRequest'
import {
  loadWardrobeCatalog,
  type WardrobeCatalog,
  type WardrobeEntry
} from '../utils/wardrobe/wardrobeCatalog'
import { emptyWardrobe, loadWardrobe } from '../utils/wardrobe/wardrobeStorage'
import type { Language } from '../i18n/types'
import { messages } from '../i18n'
import { createResonanceExport } from '../utils/resonance/resonanceFile'
import {
  getResonancePartIconUrl,
  sortResonanceParts,
  sortResonanceRecords,
  type ResonanceBannerOrder,
  type ResonanceRarityFilter
} from '../utils/resonance/resonanceCatalog'
import { loadResonanceRecords, saveResonanceRecords } from '../utils/resonance/resonanceStorage'
import type {
  ResonanceLocalizedName,
  ResonanceRecord,
  ResonanceSet
} from '../utils/resonance/resonanceTypes'

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

const previewCatalog = shallowRef<WardrobeCatalog | null>(null)
const previewSnapshot = ref(emptyWardrobe())
const outfitPreview = shallowRef<WardrobeEntry | null>(null)
const itemPreview = shallowRef<WardrobeEntry | null>(null)
const previewRequest = useLatestRequest()
const itemOutfits = computed(() =>
  (previewCatalog.value?.entries ?? []).filter(
    (entry) =>
      entry.kind === 'outfit' && !!itemPreview.value && entry.parts.includes(itemPreview.value.id)
  )
)
async function openPreview(id: string, kind: 'outfit' | 'item') {
  const request = previewRequest.begin()
  try {
    const [catalog, snapshot] = await Promise.all([loadWardrobeCatalog(), loadWardrobe()])
    if (!request.isCurrent()) return
    const entry = catalog.byId.get(id)
    if (!entry || entry.kind !== kind) throw new Error('DETAIL_UNAVAILABLE')
    previewCatalog.value = catalog
    previewSnapshot.value = snapshot
    if (kind === 'outfit') outfitPreview.value = entry
    else itemPreview.value = entry
  } catch {
    if (request.isCurrent())
      notify(
        'detail-error',
        props.language === 'zh'
          ? '详情加载失败，请稍后重试。'
          : 'Details could not be loaded. Please retry.',
        'error'
      )
  }
}
const records = ref<ResonanceRecord[]>([])
const recordsLoaded = ref(false)
const cloudOpen = ref(false)
const selectedSet = ref<Record<string, 1 | 2>>({})
const compactLayout = useCompactLayout()
const showAddDialog = ref(false)
const showClearConfirm = ref(false)
const clearing = ref(false)
let activeNoticeId: string | null = null
const sortedRecords = computed(() =>
  sortResonanceRecords(records.value, props.bannerOrder, props.rarityFilter)
)
watch(records, (value) => emit('recordsChange', value), { flush: 'sync' })
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
function outfitPulls(record: ResonanceRecord): { total: number; average: number } {
  const obtained = record.sets.flatMap((set) => set.parts).filter((part) => part.pullNumber > 0)
  const total = obtained.reduce((sum, part) => sum + part.pullNumber, 0)
  return { total, average: obtained.length ? total / obtained.length : 0 }
}
/** 两端按套共用统计口径；补录计入拥有进度，但不参与真实抽数和均值。 */
function setSummary(set: ResonanceSet) {
  const parts = set.parts
  const known = parts.filter((part) => part.pullNumber > 0 && !part.manual)
  const total = known.reduce((sum, part) => sum + part.pullNumber, 0)
  return {
    owned: parts.filter((part) => part.pullNumber > 0 || part.manual).length,
    count: parts.length,
    total: known.length ? String(total) : '—',
    average: known.length ? (total / known.length).toFixed(1) : '—',
    manual: parts.some((part) => part.manual)
  }
}

/** 桌面上下呈现全部套数，移动端只渲染选中套，跨断点保留手机选择。 */
function displayedSets(record: ResonanceRecord) {
  return compactLayout.value ? [currentSet(record)] : record.sets
}

function openDialog() {
  if (props.disabled || cloudOpen.value) return
  clearNotice()
  showAddDialog.value = true
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
    link.download = backupBaseName('共鸣记录') + '.json'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
    notify('export-success', t.value.exportSuccess, 'success')
  } catch {
    notify('export-error', t.value.exportError, 'error')
  }
}

/** 隐藏加载失败的图片，保留原有列表布局。 */
function handleRecordImageError(event: Event) {
  const image = event.currentTarget as HTMLImageElement
  image.hidden = true
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
/** 云端恢复后同步列表并重置套数切换状态。 */
function applyCloudRecords(restored: ResonanceRecord[]) {
  records.value = restored
  selectedSet.value = {}
}
</script>

<template>
  <section class="resonance-page" aria-labelledby="resonance-title">
    <header class="gallery-header resonance-header">
      <div>
        <p class="eyebrow">RESONANCE</p>
        <h2 id="resonance-title">{{ t.title }}</h2>
      </div>
      <ResonanceDataActions
        :t="t"
        :mobile-target="mobileActionsTarget"
        :label="language === 'zh' ? '共鸣操作' : 'Resonance actions'"
        :add-disabled="disabled || cloudOpen"
        :clear-disabled="disabled || cloudOpen || !records.length || clearing"
        :export-disabled="disabled || cloudOpen || !records.length"
        @add="openDialog"
        @clear="requestClearRecords"
        @export="exportRecords"
      >
        <ResonanceCloudActions
          :language="language"
          :disabled="disabled || showAddDialog || showClearConfirm"
          @lock="cloudOpen = $event"
          @restored="applyCloudRecords"
          @notice="(message, tone) => notify('cloud-' + tone, message, tone)"
        />
      </ResonanceDataActions>
    </header>

    <div v-if="!records.length" class="resonance-empty">
      <h3>{{ t.emptyTitle }}</h3>
      <p>{{ t.emptyDescription }}</p>
      <MobileEmptyScreenshot page="resonance" :language="language" />
    </div>

    <div v-else-if="!sortedRecords.length" class="resonance-empty">
      <h3>{{ t.noMatchingRarity }}</h3>
    </div>

    <div v-else class="resonance-list">
      <article
        v-for="record in sortedRecords"
        :id="`resonance-record-${record.id}`"
        :key="record.id"
        class="resonance-record"
      >
        <div class="resonance-record-heading">
          <div class="resonance-record-title-row">
            <h3 :title="`${displayName(record.outfitName)} ${t.rarity(record.rarity)}`">
              <span class="resonance-outfit-title">{{ displayName(record.outfitName) }}</span>
              <span class="resonance-rarity-tag">{{ record.rarity }} ★</span>
            </h3>
            <span class="resonance-banner-name" :title="displayName(record.bannerName)">{{
              displayName(record.bannerName)
            }}</span>
          </div>
          <p class="resonance-overall-summary">
            <span class="resonance-summary-group">
              <span class="resonance-summary-label">{{
                language === 'zh' ? '总抽数' : 'Total pulls'
              }}</span>
              <strong>{{ outfitPulls(record).total }}</strong>
            </span>
            <span class="resonance-summary-group">
              <span class="resonance-summary-label">{{
                language === 'zh' ? '平均抽数' : 'Average pulls'
              }}</span>
              <strong>{{ outfitPulls(record).average.toFixed(1) }}</strong>
            </span>
          </p>
          <p class="resonance-mobile-progress">{{
            t.ownedProgress(
              setSummary(currentSet(record)).owned,
              setSummary(currentSet(record)).count
            )
          }}</p>
        </div>
        <div class="resonance-mobile-details">
          <div class="resonance-set-switch" role="group" :aria-label="t.setSelection">
            <button
              v-for="set in record.sets"
              :key="set.setNumber"
              type="button"
              :aria-pressed="(selectedSet[record.id] ?? 1) === set.setNumber"
              @click="selectedSet[record.id] = set.setNumber"
              >{{ set.setNumber === 1 ? t.setOne : t.setTwo }}</button
            >
          </div>
          <p class="resonance-set-summary" aria-live="polite">
            <span>{{ t.setPulls(setSummary(currentSet(record)).total) }}</span>
            <span>{{ t.knownAverage(setSummary(currentSet(record)).average) }}</span>
          </p>
          <p v-if="setSummary(currentSet(record)).manual" class="resonance-manual-note">{{
            t.manualStatsNote
          }}</p>
        </div>
        <div class="resonance-record-body">
          <button
            type="button"
            class="resonance-outfit-image"
            :aria-label="displayName(record.outfitName)"
            @click="openPreview(record.outfitId, 'outfit')"
            ><img
              referrerpolicy="no-referrer"
              :src="record.outfitImageUrl"
              :alt="displayName(record.outfitName)"
              @error="handleRecordImageError($event)"
          /></button>
          <div class="resonance-sets">
            <section
              v-for="set in displayedSets(record)"
              :key="set.setNumber"
              class="resonance-set-row"
            >
              <div v-if="!compactLayout" class="resonance-desktop-set-heading">
                <h4>{{ set.setNumber === 1 ? t.setOne : t.setTwo }}</h4>
                <span>{{ t.setPulls(setSummary(set).total) }}</span>
                <span>{{ t.knownAverage(setSummary(set).average) }}</span>
                <p v-if="setSummary(set).manual" class="resonance-manual-note">{{
                  t.manualStatsNote
                }}</p>
              </div>
              <div class="resonance-parts">
                <button
                  type="button"
                  :aria-label="displayName(part.name)"
                  @click="openPreview(part.id, 'item')"
                  v-for="part in sortResonanceParts(set.parts)"
                  :key="part.id"
                  class="resonance-part"
                  :class="{
                    'is-even-banner': Number(record.bannerId) % 2 === 0,
                    'is-missing': part.pullNumber === 0 && !part.manual
                  }"
                >
                  <img
                    referrerpolicy="no-referrer"
                    :src="getResonancePartIconUrl(part.id)"
                    :alt="displayName(part.name)"
                    @error="handleRecordImageError($event)"
                  />
                  <span
                    class="resonance-pull-number"
                    :class="{ missing: part.pullNumber === 0 && !part.manual }"
                    >{{ part.manual ? '*' : part.pullNumber }}</span
                  >
                </button>
              </div>
            </section>
          </div>
        </div>
      </article>
    </div>

    <DataImportWindow
      :visible="showAddDialog"
      :language="language"
      :disabled="disabled || !recordsLoaded"
      @close="showAddDialog = false"
      @imported="reload"
      @notice="(message, tone) => notify('data-import', message, tone)"
    />

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
  <WardrobeItemDialog
    :item="itemPreview"
    :outfits="itemOutfits"
    :language="language"
    @close="itemPreview = null"
    @open-outfit="openPreview($event.id, 'outfit')"
  />
  <WardrobeOutfitDialog
    :detail="outfitPreview"
    :catalog="previewCatalog"
    :snapshot="previewSnapshot"
    :language="language"
    @close="outfitPreview = null"
    @open-outfit="openPreview($event.id, 'outfit')"
  />
</template>

<style scoped>
button.resonance-outfit-image,
button.resonance-part {
  padding: 0;
  border: 1px solid transparent;
  font: inherit;
  color: inherit;
  cursor: pointer;
  box-shadow: var(--photo-shadow);
  transition:
    border-color var(--motion-fast) ease,
    box-shadow var(--motion-fast) ease;
}
button.resonance-outfit-image:hover,
button.resonance-outfit-image:focus-visible {
  border-color: var(--wardrobe-card-hover-border);
  box-shadow: var(--photo-hover-shadow);
  outline: none;
}
button.resonance-part:hover,
button.resonance-part:focus-visible {
  border-color: color-mix(in srgb, var(--pink-deep) 55%, var(--line));
  box-shadow: var(--photo-hover-shadow);
  outline: none;
}

.resonance-page {
  min-width: 0;
}
.resonance-header {
  margin-bottom: 18px;
}
.resonance-empty {
  display: grid;
  min-height: 280px;
  place-items: center;
  align-content: center;
  gap: 10px;
  padding: 32px;
  border: 1px dashed var(--line);
  border-radius: var(--ui-radius);
  color: var(--muted);
  text-align: center;
}
.resonance-empty h3,
.resonance-empty p {
  margin: 0;
}
.resonance-record {
  scroll-margin-top: calc(var(--sidebar-sticky-top) + 12px);
  margin-bottom: 16px;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: var(--ui-radius);
  background: var(--surface);
}
/* 桌面标题两侧允许收缩并省略长名称；移动布局在下方覆盖为纵向摘要。 */
.resonance-record-title-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}
.resonance-record-title-row h3 {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}
.resonance-outfit-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 星级沿用衣橱胶囊配色，尺寸适配共鸣记录标题。 */
.resonance-rarity-tag {
  flex: none;
  padding: 2px 9px;
  border-radius: 999px;
  color: #966719;
  background: #fff0c5;
  font-size: 0.78em;
  font-weight: 500;
  line-height: 1.5;
  white-space: nowrap;
}
:root[data-theme='dark'] .resonance-rarity-tag {
  color: #f8d78c;
  background: #59451f;
}
.resonance-record-heading h3,
.resonance-record-heading p {
  margin: 0;
}
.resonance-record-heading p {
  margin-top: 7px;
  color: var(--muted);
  font-size: 13px;
}
.resonance-overall-summary {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 4px 20px;
  font-variant-numeric: tabular-nums;
}
.resonance-summary-group {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  white-space: nowrap;
}
.resonance-summary-group strong {
  color: var(--heading);
  font-weight: 600;
}
.resonance-banner-name {
  max-width: 45%;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--muted);
  font-size: 13px;
  text-align: right;
}
.resonance-record-body {
  display: flex;
  gap: 18px;
  margin-top: 18px;
  align-items: flex-start;
}
.resonance-outfit-image {
  flex-shrink: 0;
  width: min(180px, 28%);
  aspect-ratio: 448 / 656;
  overflow: hidden;
  border-radius: 8px;
  background: var(--frame-bg) url('../../img/back.png') center / cover no-repeat;
}
.resonance-outfit-image img,
.resonance-part img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.resonance-outfit-image img[hidden],
.resonance-part img[hidden] {
  display: none;
}
.resonance-sets {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 18px;
}
.resonance-set-row {
  min-width: 0;
}
.resonance-desktop-set-heading {
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin-bottom: 10px;
  color: var(--muted);
  font-size: 13px;
  line-height: 1.5;
  font-variant-numeric: tabular-nums;
}
.resonance-desktop-set-heading h4 {
  margin: 0;
  color: var(--text);
  font-size: inherit;
}
.resonance-desktop-set-heading .resonance-manual-note {
  flex-basis: 100%;
  margin: 0;
  font-size: 12px;
}
.resonance-parts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(74px, 1fr));
  gap: 10px;
}
.resonance-part {
  position: relative;
  aspect-ratio: 1;
  overflow: visible;
  border-radius: 8px;
  background: var(--frame-bg) url('../../img/pinkCardBg.png') center / contain no-repeat;
}
.resonance-part.is-even-banner {
  background-image: url('../../img/purpleCardBg.png');
}
.resonance-part.is-missing {
  background-image: url('../../img/silverCardBg.png');
}
.resonance-part img {
  /* 本次修复：消除行内图片的基线留白，避免撑高方形卡片导致背景上下露底。 */
  display: block;
  border-radius: 8px;
}
.resonance-pull-number {
  position: absolute;
  right: -4px;
  bottom: -4px;
  display: grid;
  width: 25px;
  height: 25px;
  place-items: center;
  border: 2px solid var(--surface);
  border-radius: 50%;
  background: var(--pink-deep);
  color: #fff;
  font-size: 11px;
  font-weight: 800;
}
.resonance-pull-number.missing {
  background: var(--muted);
}
/* 移动卡片由同一张立绘组成摘要，当前套部件独占整行；桌面同时展示两套。 */
.resonance-mobile-details,
.resonance-record-heading .resonance-mobile-progress {
  display: none;
}
@media (max-width: 899px) {
  .resonance-record {
    position: relative;
    display: grid;
    grid-template-columns: 76px minmax(0, 1fr);
    gap: 14px 12px;
    padding: 14px;
  }
  .resonance-record-heading {
    grid-column: 2;
    grid-row: 1;
    align-self: center;
    min-width: 0;
    padding-right: 76px;
  }
  .resonance-record-title-row {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
  }
  .resonance-record-title-row h3 {
    flex: none;
    max-width: 100%;
    font-size: 16px;
    line-height: 1.4;
  }
  .resonance-outfit-title {
    white-space: normal;
    overflow-wrap: anywhere;
  }
  .resonance-banner-name {
    max-width: 100%;
    white-space: normal;
    overflow-wrap: anywhere;
    text-align: left;
    font-size: 12px;
    line-height: 1.5;
  }
  /* 整体统计沿用两套合计，置于卡池名和当前套进度之间；每个指标完整换行。 */
  .resonance-record-heading .resonance-overall-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    font-size: 12px;
    line-height: 1.5;
    font-variant-numeric: tabular-nums;
  }
  .resonance-overall-summary > span {
    white-space: nowrap;
    color: var(--text);
  }
  .resonance-record-heading .resonance-mobile-progress {
    display: block;
    font-size: 12px;
  }
  .resonance-record-body,
  .resonance-sets,
  .resonance-set-row {
    display: contents;
  }
  .resonance-outfit-image {
    grid-column: 1;
    grid-row: 1;
    width: 100%;
    align-self: start;
  }
  .resonance-mobile-details {
    display: block;
    grid-column: 1 / -1;
    min-width: 0;
  }
  /* 套数切换固定在卡片右上角，竖向排列，不再独占下方整行。 */
  .resonance-set-switch {
    position: absolute;
    top: 14px;
    right: 14px;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
    width: 70px;
    padding: 3px;
    border: 1px solid var(--line-soft);
    border-radius: 12px;
    background: var(--frame-bg);
  }
  .resonance-set-switch button {
    min-height: 36px;
    min-width: 0;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .resonance-set-switch button[aria-pressed='true'] {
    background: var(--surface);
    color: var(--pink-deep);
    font-weight: 700;
    box-shadow: 0 1px 4px rgb(0 0 0 / 6%);
  }
  .resonance-set-switch button:focus-visible {
    outline: 2px solid var(--pink-deep);
    outline-offset: -2px;
  }
  .resonance-set-summary {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 6px 12px;
    margin: 0;
    color: var(--text);
    font-size: 13px;
    line-height: 1.5;
    font-variant-numeric: tabular-nums;
  }
  .resonance-manual-note {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 12px;
    line-height: 1.5;
  }
  .resonance-parts {
    grid-column: 1 / -1;
    min-width: 0;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 8px;
    padding: 0 4px 4px 0;
  }
}
@media (max-width: 359px) {
  .resonance-parts {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
</style>
