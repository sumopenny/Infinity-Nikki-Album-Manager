<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { ChevronDown, Shirt, X } from 'lucide-vue-next'
import ResonanceDataActions from './ResonanceDataActions.vue'
import DataImportWindow from './DataImportWindow.vue'
import ConfirmDialog from './ConfirmDialog.vue'
import { messages } from '../i18n'
import { useSidebarMenu } from '../composables/useSidebarMenu'
import { useCompactLayout } from '../composables/useCompactLayout'
import { useModuleOperation } from '../composables/useOperationCoordinator'
import { useModalFocus } from '../composables/useModalFocus'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import type { Language } from '../i18n/types'
import {
  loadWardrobeCatalog,
  type WardrobeCatalog,
  type WardrobeEntry,
  type WardrobeKind
} from '../utils/wardrobe/wardrobeCatalog'
import {
  createWardrobeBackup,
  emptyWardrobe,
  loadWardrobe,
  updateWardrobe,
  type WardrobeSnapshot
} from '../utils/wardrobe/wardrobeStorage'
const props = withDefaults(
  defineProps<{
    language?: Language
    disabled?: boolean
    searchQuery?: string
    sidebarTarget?: string
  }>(),
  {
    language: 'zh',
    searchQuery: ''
  }
)
const emit = defineEmits<{
  'update-search': [value: string]
  notice: [payload: { message: string; tone: 'success' | 'warning' | 'error' }]
}>()
const compact = useCompactLayout()
// 顶栏搜索是唯一输入来源；桌面将同一组筛选节点移入现有侧栏。
const query = computed(() => props.searchQuery)
const text = (zh: string, en: string) => (props.language === 'zh' ? zh : en)
const track = useModuleOperation('wardrobe')
const catalog = shallowRef<WardrobeCatalog | null>(null)
const snapshot = ref<WardrobeSnapshot>(emptyWardrobe())
const loaded = ref(false),
  busy = ref(false),
  error = ref(''),
  notice = ref('')
const blocked = computed(() => props.disabled || busy.value || !loaded.value)
const tab = ref<WardrobeKind>('outfit'),
  ownership = ref('all'),
  rarity = ref('all'),
  variant = ref('all'),
  category = ref('all'),
  sort = ref('catalog')
const limit = ref(48)
const failedImages = ref(new Set<string>())
const variants = computed(() =>
  props.language === 'zh'
    ? ['原套', '焕新', '一进', '二进', '满进']
    : ['Original', 'Glow-up', 'Evo. 1', 'Evo. 2', 'Evo. 3']
)
const categories = computed(() =>
  props.language === 'zh'
    ? [
        '发型',
        '外套',
        '鞋子',
        '发饰',
        '头饰',
        '耳饰',
        '项链',
        '颈饰',
        '连衣裙',
        '胸饰',
        '手持物',
        '袜子',
        '手套',
        '面饰',
        '背饰',
        '上衣',
        '手链',
        '臂饰',
        '挂饰',
        '下装',
        '身体彩绘',
        '戒指'
      ]
    : [
        'Hair',
        'Outerwear',
        'Shoes',
        'Hair accessories',
        'Headwear',
        'Earrings',
        'Necklaces',
        'Chokers',
        'Dresses',
        'Chest accessories',
        'Handhelds',
        'Socks',
        'Gloves',
        'Face decorations',
        'Backpieces',
        'Tops',
        'Bracelets',
        'Arm decorations',
        'Pendants',
        'Bottoms',
        'Body paint',
        'Rings'
      ]
)
// 沿用共鸣侧栏的自定义下拉菜单与选中样式，避免浏览器原生弹层风格不一致。
const openFilter = ref('')
const { menuStyle: filterMenuStyle, positionMenu } = useSidebarMenu(
  () => {
    openFilter.value = ''
  },
  () => document.getElementById('wardrobe-menu-' + openFilter.value)
)
// 桌面菜单移出滚动侧栏，避免 overflow 裁切阴影；不改变侧栏自身滚动。
function toggleFilter(key: string, event: MouseEvent) {
  if (openFilter.value === key) {
    openFilter.value = ''
    return
  }
  positionMenu(event.currentTarget as HTMLElement)
  openFilter.value = key
}
function leaveFilter(event: FocusEvent) {
  const next = event.relatedTarget as Node | null
  const trigger = document.getElementById('wardrobe-filter-' + openFilter.value)
  const menu = document.getElementById('wardrobe-menu-' + openFilter.value)
  if (!next || (!trigger?.contains(next) && !menu?.contains(next))) openFilter.value = ''
}
const filterValues = { ownership, rarity, variant, category, sort }
type FilterKey = keyof typeof filterValues
const filterOptions = computed(() => {
  const all = { value: 'all', label: text('全部', 'All') }
  return [
    {
      key: 'ownership',
      label: text('状态', 'Status'),
      options: [
        all,
        { value: 'owned', label: text('已拥有', 'Owned') },
        ...(tab.value === 'outfit' ? [{ value: 'partial', label: text('收集中', 'Partial') }] : []),
        { value: 'none', label: text('未记录', 'Unrecorded') }
      ]
    },
    {
      key: 'rarity',
      label: text('星级', 'Rarity'),
      options: [all, ...[5, 4, 3, 2, 1].map((n) => ({ value: String(n), label: n + ' ★' }))]
    },
    {
      key: 'variant',
      label: text('版本', 'Variant'),
      options: [all, ...variants.value.map((label, index) => ({ value: String(index), label }))]
    },
    ...(tab.value === 'item'
      ? [
          {
            key: 'category',
            label: text('部位', 'Category'),
            options: [
              all,
              ...categories.value.map((label, index) => ({ value: String(index), label }))
            ]
          }
        ]
      : []),
    {
      key: 'sort',
      label: text('排序', 'Sort'),
      options: [
        { value: 'catalog', label: text('图鉴顺序', 'Catalog order') },
        { value: 'name', label: text('名称', 'Name') },
        { value: 'progress', label: text('收集进度', 'Progress') }
      ]
    }
  ] as { key: FilterKey; label: string; options: { value: string; label: string }[] }[]
})
function closeFilter(event: Event) {
  if (
    !(event.target instanceof Element) ||
    !event.target.closest('.wardrobe-filter-field, .wardrobe-filter-menu')
  )
    openFilter.value = ''
}
function selectFilter(key: FilterKey, value: string) {
  filterValues[key].value = value
  openFilter.value = ''
  document.getElementById('wardrobe-filter-' + key)?.focus()
}
watch([tab, compact], () => {
  openFilter.value = ''
})
onMounted(() => {
  document.addEventListener('click', closeFilter)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', closeFilter)
})
const name = (entry: WardrobeEntry) => entry.name[props.language]
const ownedCount = (entry: WardrobeEntry, data = snapshot.value) =>
  entry.parts.filter((id) => data.entries[id]?.owned).length
const complete = (entry: WardrobeEntry) =>
  entry.parts.length > 0 && ownedCount(entry) === entry.parts.length
const status = (entry: WardrobeEntry) =>
  complete(entry)
    ? text(entry.kind === 'outfit' ? '已集齐' : '已拥有', 'Owned')
    : ownedCount(entry)
      ? text('收集中', 'Partial')
      : text('未记录', 'Unrecorded')
const filtered = computed(() => {
  const search = query.value.trim().toLocaleLowerCase()
  const entries = (catalog.value?.entries ?? []).filter(
    (entry) =>
      entry.kind === tab.value &&
      (!search ||
        `${entry.name.zh} ${entry.name.en} ${entry.id}`.toLocaleLowerCase().includes(search)) &&
      (rarity.value === 'all' || entry.quality === Number(rarity.value)) &&
      (variant.value === 'all' || entry.variant === Number(variant.value)) &&
      (tab.value !== 'item' ||
        category.value === 'all' ||
        entry.category === Number(category.value)) &&
      (ownership.value === 'all' ||
        (ownership.value === 'owned'
          ? complete(entry)
          : ownership.value === 'partial'
            ? ownedCount(entry) > 0 && !complete(entry)
            : ownedCount(entry) === 0))
  )
  if (sort.value === 'name') entries.sort((a, b) => name(a).localeCompare(name(b), props.language))
  if (sort.value === 'progress')
    entries.sort(
      (a, b) => ownedCount(b) / (b.parts.length || 1) - ownedCount(a) / (a.parts.length || 1)
    )
  return entries
})
const stats = computed(() => ({
  items: (catalog.value?.entries ?? []).filter((e) => e.kind === 'item' && complete(e)).length,
  outfits: (catalog.value?.entries ?? []).filter((e) => e.kind === 'outfit' && complete(e)).length
}))
watch([tab, query, ownership, rarity, variant, category, sort], () => {
  limit.value = 48
})
// 分类切换与重置按钮使用同一入口，避免版本、星级和排序残留。
watch(tab, resetFilters)
function resetFilters() {
  emit('update-search', '')
  ownership.value = rarity.value = variant.value = category.value = 'all'
  sort.value = 'catalog'
}
function reportError(cause: unknown) {
  error.value =
    cause instanceof Error && cause.message === 'WARDROBE_CHANGED'
      ? text(
          '衣橱已在其他页面变更，请关闭预览后重新导入。',
          'Wardrobe changed in another tab. Close this preview and import again.'
        )
      : text(
          '操作失败，原有数据未被替换。请检查文件、登录信息或网络后重试。',
          'Operation failed. Existing data was not replaced. Check the file, credentials or network and retry.'
        )
}
async function reload() {
  error.value = ''
  loaded.value = false
  try {
    const [data, saved] = await Promise.all([loadWardrobeCatalog(), loadWardrobe()])
    catalog.value = data
    snapshot.value = saved
    loaded.value = true
  } catch (cause) {
    reportError(cause)
  }
}
onMounted(reload)
defineExpose({ reload })

const dialog = ref<'import' | 'detail' | null>(null)
const dialogOpen = computed(() => dialog.value === 'detail')
const importOpen = computed(() => dialog.value === 'import')
const anyDialogOpen = computed(() => dialog.value !== null)
// 异步加载完成且工具栏节点实际挂载后，才启用手机操作区传送。
const mobileActionsHost = ref<HTMLElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const detail = shallowRef<WardrobeEntry | null>(null)
function closeDialog() {
  if (!busy.value) {
    dialog.value = null
    error.value = ''
  }
}
useBodyScrollLock(dialogOpen)
useModalFocus(dialogOpen, panel, closeDialog)
function openImport() {
  error.value = ''
  notice.value = ''
  dialog.value = 'import'
}
function openDetail(entry: WardrobeEntry) {
  detail.value = entry
  dialog.value = 'detail'
  error.value = ''
}
async function exportBackup() {
  if (blocked.value) return
  busy.value = true
  error.value = ''
  try {
    await track(async () => {
      const latest = await loadWardrobe()
      const url = URL.createObjectURL(
        new Blob([createWardrobeBackup(latest)], { type: 'application/json' })
      )
      const a = document.createElement('a')
      a.href = url
      a.download = `nikki-wardrobe-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      snapshot.value = latest
    })
  } catch (cause) {
    reportError(cause)
  } finally {
    busy.value = false
  }
}
const importText = computed(() => ({
  ...messages[props.language].resonance,
  clearRecords: text('清空记录', 'Clear records'),
  clearConfirm: text('清空记录', 'Clear records'),
  clearTitle: text('清空衣橱记录', 'Clear wardrobe records'),
  clearMessage: text(
    '将清空全部衣橱拥有记录，服装图鉴和共鸣记录不受影响。此操作无法撤销，请先导出数据备份。',
    'Clear all wardrobe ownership. The catalog and resonance records are unaffected. This cannot be undone; export a backup first.'
  )
}))
const showClearConfirm = ref(false),
  clearBase = ref('')
const hasRecords = computed(
  () => Object.keys(snapshot.value.entries).length > 0 || snapshot.value.unknownSuitIds.length > 0
)
async function requestClear() {
  if (blocked.value || !hasRecords.value) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try {
    clearBase.value = JSON.stringify(await track(loadWardrobe))
    showClearConfirm.value = true
  } catch (cause) {
    reportError(cause)
  } finally {
    busy.value = false
  }
}
async function clearRecords() {
  if (blocked.value) return
  busy.value = true
  error.value = ''
  try {
    snapshot.value = await track(() => updateWardrobe(() => emptyWardrobe(), clearBase.value))
    showClearConfirm.value = false
    notice.value = text('已清空衣橱记录。', 'Wardrobe records cleared.')
  } catch (cause) {
    showClearConfirm.value = false
    reportError(cause)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="wardrobe-page" aria-labelledby="wardrobe-title">
    <header class="gallery-header wardrobe-header">
      <div
        ><p class="eyebrow">WARDROBE</p
        ><h2 id="wardrobe-title">{{ text('个人衣橱', 'Personal wardrobe') }}</h2></div
      >
      <ResonanceDataActions
        :t="importText"
        :label="text('衣橱操作', 'Wardrobe actions')"
        :mobile-target="mobileActionsHost ? '#wardrobe-filter-actions' : undefined"
        :add-disabled="blocked || showClearConfirm"
        :clear-disabled="blocked || !hasRecords || anyDialogOpen"
        :export-disabled="blocked || !hasRecords"
        @add="openImport"
        @clear="requestClear"
        @export="exportBackup"
      />
    </header>
    <p v-if="error && !anyDialogOpen" class="wardrobe-error" role="alert"
      >{{ error }}
      <button v-if="!loaded" class="confirm-dialog-button ghost" @click="reload">{{
        text('重试', 'Retry')
      }}</button></p
    >
    <p v-if="notice && !anyDialogOpen" role="status" class="wardrobe-notice">{{ notice }}</p>
    <p v-if="!loaded && !error" role="status">{{ text('正在加载衣橱…', 'Loading wardrobe…') }}</p>
    <template v-if="loaded">
      <div class="wardrobe-summary">
        <span
          >{{ text('已拥有单品', 'Owned pieces') }} <strong>{{ stats.items }}</strong></span
        >
        <span
          >{{ text('集齐套装', 'Complete outfits') }} <strong>{{ stats.outfits }}</strong></span
        >
      </div>
      <p v-if="!snapshot.updatedAt" class="wardrobe-hint">{{
        text(
          '导入奇想手账，查看你的衣橱。未记录不代表游戏中未拥有。',
          'Import your notebook to view your wardrobe. Unrecorded does not mean missing in game.'
        )
      }}</p>
      <Teleport :to="sidebarTarget || 'body'" :disabled="compact || !sidebarTarget">
        <div :class="{ 'wardrobe-sidebar-controls': !compact && sidebarTarget }">
          <div class="wardrobe-toolbar">
            <div id="wardrobe-filter-actions" ref="mobileActionsHost" class="mobile-only"></div>
            <nav
              :class="!compact && sidebarTarget ? 'sidebar-mode-switch' : 'favorites-tabs'"
              :aria-label="text('衣橱分类', 'Wardrobe category')"
            >
              <button
                type="button"
                :aria-pressed="tab === 'outfit'"
                :class="{ active: tab === 'outfit' }"
                @click="tab = 'outfit'"
                >{{ text('套装', 'Outfits') }}</button
              >
              <button
                type="button"
                :aria-pressed="tab === 'item'"
                :class="{ active: tab === 'item' }"
                @click="tab = 'item'"
                >{{ text('单品', 'Pieces') }}</button
              >
            </nav>
          </div>
          <div class="wardrobe-filters">
            <div v-for="filter in filterOptions" :key="filter.key" class="wardrobe-filter-field">
              <span>{{ filter.label }}</span>
              <div
                class="action-sort-select-wrap wardrobe-filter-select"
                @keydown.esc.stop.prevent="
                  openFilter = ''
                  ;($event.currentTarget as HTMLElement).querySelector('button')?.focus()
                "
                @focusout="leaveFilter"
              >
                <button
                  :id="'wardrobe-filter-' + filter.key"
                  type="button"
                  class="cleanup-account-select action-sort-select"
                  :class="{ open: openFilter === filter.key }"
                  :aria-label="
                    filter.label +
                    ': ' +
                    filter.options.find((option) => option.value === filterValues[filter.key].value)
                      ?.label
                  "
                  aria-haspopup="menu"
                  :aria-expanded="openFilter === filter.key"
                  @click="toggleFilter(filter.key, $event)"
                >
                  <span>{{
                    filter.options.find((option) => option.value === filterValues[filter.key].value)
                      ?.label
                  }}</span
                  ><ChevronDown :size="14" aria-hidden="true" />
                </button>
                <Teleport to="body" :disabled="compact">
                  <div
                    v-if="openFilter === filter.key"
                    class="cleanup-account-menu wardrobe-filter-menu"
                    :id="'wardrobe-menu-' + filter.key"
                    :style="compact ? undefined : filterMenuStyle"
                    @focusout="leaveFilter"
                    @keydown.esc.stop.prevent="
                      selectFilter(filter.key, filterValues[filter.key].value)
                    "
                    role="menu"
                    :aria-label="filter.label"
                  >
                    <button
                      v-for="option in filter.options"
                      :key="option.value"
                      type="button"
                      role="menuitemradio"
                      :aria-checked="filterValues[filter.key].value === option.value"
                      :class="{ active: filterValues[filter.key].value === option.value }"
                      @click="selectFilter(filter.key, option.value)"
                      >{{ option.label }}</button
                    >
                  </div>
                </Teleport>
              </div>
            </div>
            <button class="confirm-dialog-button ghost" type="button" @click="resetFilters">{{
              text('重置', 'Reset')
            }}</button>
          </div>
        </div>
      </Teleport>
      <p class="wardrobe-hint">{{
        text(
          `共 ${filtered.length} 项 · 每个版本独立展示`,
          `${filtered.length} results · Each variant has its own card`
        )
      }}</p>
      <div v-if="filtered.length" class="wardrobe-grid" :class="{ 'is-pieces': tab === 'item' }">
        <article v-for="entry in filtered.slice(0, limit)" :key="entry.id" class="wardrobe-card">
          <button
            class="wardrobe-card-open"
            type="button"
            :disabled="blocked"
            :aria-label="name(entry) + ' · ' + variants[entry.variant] + ' · ' + status(entry)"
            @click="openDetail(entry)"
          >
            <div class="wardrobe-cover">
              <img
                v-if="!failedImages.has(entry.id)"
                :src="entry.image"
                alt=""
                loading="lazy"
                referrerpolicy="no-referrer"
                @error="failedImages.add(entry.id)"
              />
              <span v-else class="wardrobe-image-fallback"
                ><Shirt :size="32" />{{ text('暂无图片', 'No image') }}</span
              >
              <span class="wardrobe-variant">{{ variants[entry.variant] }}</span>
            </div>
            <div class="wardrobe-card-body"
              ><small>{{ entry.quality }} ★</small><h3>{{ name(entry) }}</h3
              ><span :class="complete(entry) ? 'wardrobe-owned' : ''"
                >{{ status(entry) }}
                <small v-if="entry.kind === 'outfit'"
                  >{{ ownedCount(entry) }}/{{ entry.parts.length }}</small
                ></span
              ><progress
                v-if="entry.kind === 'outfit'"
                :value="ownedCount(entry)"
                :max="entry.parts.length || 1"
                :aria-label="text('收集进度', 'Collection progress')"
              ></progress
            ></div>
          </button>
        </article>
      </div>
      <div v-else class="wardrobe-empty"
        ><Shirt :size="32" /><p>{{ text('没有符合条件的服装', 'No matching clothes') }}</p
        ><button class="primary-button" @click="resetFilters">{{
          text('重置筛选', 'Reset filters')
        }}</button></div
      >
      <div v-if="filtered.length > limit" class="wardrobe-more"
        ><button class="confirm-dialog-button ghost" type="button" @click="limit += 48">{{
          text('加载更多', 'Load more')
        }}</button></div
      >
    </template>

    <DataImportWindow
      :visible="importOpen"
      :language="language"
      :disabled="disabled || !loaded"
      @close="dialog = null"
      @imported="reload"
      @notice="(message, tone) => emit('notice', { message, tone })"
    />
    <ConfirmDialog
      :visible="showClearConfirm"
      :title="importText.clearTitle"
      :message="importText.clearMessage"
      tone="danger"
      :confirm-label="busy ? importText.clearing : importText.clearConfirm"
      :cancel-label="importText.clearCancel"
      :close-label="importText.close"
      @confirm="clearRecords"
      @cancel="!busy && (showClearConfirm = false)"
    />
    <Teleport to="body">
      <Transition name="confirm-dialog">
        <div v-if="dialogOpen" class="dialog-overlay" @click.self="closeDialog">
          <section
            ref="panel"
            class="dialog-panel wardrobe-dialog"
            tabindex="-1"
            role="dialog"
            aria-modal="true"
            aria-labelledby="wardrobe-dialog-title"
          >
            <header
              ><h2 id="wardrobe-dialog-title">{{ detail ? name(detail) : '' }}</h2
              ><button
                type="button"
                :disabled="busy"
                :aria-label="text('关闭', 'Close')"
                @click="closeDialog"
                ><X :size="20" /></button
            ></header>
            <div class="wardrobe-dialog-body">
              <p v-if="error" class="wardrobe-error" role="alert">{{ error }}</p
              ><p v-if="notice" role="status">{{ notice }}</p>
              <template v-if="dialog === 'detail' && detail">
                <p
                  >{{ variants[detail.variant] }} · {{ detail.quality }} ★ ·
                  {{ ownedCount(detail) }}/{{ detail.parts.length }}</p
                >
                <div class="wardrobe-detail-parts"
                  ><div
                    v-for="id in detail.parts"
                    :key="id"
                    class="wardrobe-part"
                    :class="{ 'is-owned': snapshot.entries[id]?.owned }"
                    ><img
                      v-if="catalog?.byId.get(id) && !failedImages.has(id)"
                      :src="catalog.byId.get(id)!.image"
                      alt=""
                      loading="lazy"
                      referrerpolicy="no-referrer"
                      @error="failedImages.add(id)"
                    /><Shirt v-else :size="28" /><span>{{
                      catalog?.byId.get(id) ? name(catalog.byId.get(id)!) : id
                    }}</span
                    ><small>{{
                      snapshot.entries[id]?.owned
                        ? text('已拥有', 'Owned')
                        : text('未记录', 'Unrecorded')
                    }}</small></div
                  ></div
                >
              </template>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
/* 衣橱只补充内容布局，按钮、操作菜单、弹窗和颜色沿用公共样式。 */
.wardrobe-page {
  min-width: 0;
}
.wardrobe-summary,
.wardrobe-toolbar,
.wardrobe-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.wardrobe-summary {
  padding: 16px 0;
  border-bottom: 1px solid var(--line-soft);
}
.wardrobe-summary strong {
  margin-left: 8px;
  font-size: 22px;
  color: var(--heading);
}
.wardrobe-toolbar {
  justify-content: space-between;
  margin: 18px 0 12px;
}
.wardrobe-filter-field {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
}
.wardrobe-hint {
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}
.wardrobe-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}
.wardrobe-grid.is-pieces {
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
}
.wardrobe-card {
  min-width: 0;
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line-soft);
  border-radius: var(--ui-radius);
  box-shadow: var(--photo-shadow);
}
.wardrobe-card:hover {
  box-shadow: var(--photo-hover-shadow);
}
.wardrobe-card-open {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  color: var(--text);
  background: transparent;
  text-align: left;
}
.wardrobe-cover {
  position: relative;
  /* 套装素材为 448 × 656，按原图比例预留空间，避免 contain 产生侧边留白。 */
  aspect-ratio: 448 / 656;
  background: var(--frame-bg) url('../../img/back.png') center / cover no-repeat;
}
.is-pieces .wardrobe-cover {
  aspect-ratio: 1;
}
.wardrobe-cover img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.wardrobe-grid:not(.is-pieces) .wardrobe-cover img {
  /* 套装图使用块级布局，消除行内图片的底部基线空隙。 */
  display: block;
}
.wardrobe-variant {
  position: absolute;
  top: 10px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background: var(--surface);
  font-size: 12px;
  left: 10px;
}
.wardrobe-card-body {
  display: grid;
  gap: 6px;
  padding: 12px;
}
.wardrobe-card-body h3 {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  color: var(--heading);
}
.wardrobe-card-body small {
  font-size: 11px;
  color: var(--muted);
}
.wardrobe-card-body > span {
  font-size: 12px;
}
.wardrobe-owned,
.wardrobe-notice {
  color: var(--notice-success);
}
progress {
  width: 100%;
  height: 5px;
  accent-color: var(--notice-success);
  border: 0;
  border-radius: 999px;
  overflow: hidden;
}
progress::-webkit-progress-bar {
  background: var(--line-soft);
}
progress::-webkit-progress-value {
  background: var(--notice-success);
}
.wardrobe-empty,
.wardrobe-image-fallback {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--muted);
}
.wardrobe-empty {
  padding: 60px 20px;
}
.wardrobe-image-fallback {
  height: 100%;
  font-size: 12px;
}
.wardrobe-more {
  display: flex;
  justify-content: center;
  padding: 24px;
}
.wardrobe-dialog {
  --dialog-width: min(760px, 100%);
  --dialog-max-height: calc(100dvh - 40px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.wardrobe-dialog > header {
  flex-shrink: 0;
}
.wardrobe-dialog-body {
  min-height: 0;
  overflow: auto;
  padding: 20px 24px;
  display: grid;
  gap: 16px;
  line-height: 1.7;
}
.wardrobe-error {
  color: var(--notice-error);
}
.wardrobe-detail-parts {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 12px;
}
.wardrobe-part {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--line);
  border-radius: var(--radius-sm);
  color: var(--text);
  background: var(--surface);
}
.wardrobe-part.is-owned {
  border-color: var(--notice-success);
  background: color-mix(in srgb, var(--notice-success) 10%, var(--surface));
}
.wardrobe-part img {
  width: 80px;
  height: 80px;
  object-fit: contain;
}
.wardrobe-part span {
  font-size: 12px;
}
.wardrobe-sidebar-controls .wardrobe-toolbar {
  margin: 0 0 16px;
}
.wardrobe-sidebar-controls .sidebar-mode-switch {
  width: 100%;
}
.wardrobe-sidebar-controls .wardrobe-filters {
  flex-direction: column;
  align-items: stretch;
}
.wardrobe-sidebar-controls .wardrobe-filter-field {
  justify-content: space-between;
}
.wardrobe-sidebar-controls .wardrobe-filter-select {
  min-width: 0;
  width: 70%;
}
@media (max-width: 899px) {
  .wardrobe-header {
    display: none;
  }
  .wardrobe-toolbar .favorites-tabs {
    width: auto;
    flex: 1;
    order: 0;
  }
  #wardrobe-filter-actions {
    order: 1;
  }

  .wardrobe-grid,
  .wardrobe-grid.is-pieces {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .wardrobe-summary {
    gap: 8px 16px;
  }
  .wardrobe-toolbar {
    align-items: stretch;
  }
  .wardrobe-filters {
    gap: 10px;
  }
  .wardrobe-filter-field {
    flex: 1 1 calc(50% - 10px);
    min-width: 0;
  }
  .wardrobe-filter-select {
    flex: 1;
    min-width: 0;
    width: 0;
  }
  .wardrobe-card-body {
    padding: 10px;
  }
  .wardrobe-dialog-body {
    padding: 16px;
  }
}
</style>
