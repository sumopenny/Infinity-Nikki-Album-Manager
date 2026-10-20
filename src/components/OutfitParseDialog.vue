<script setup lang="ts">
import CatalogImage from './CatalogImage.vue'
// 搭配码解析窗口：调用解析 API 清洗出部件 ID 与染色数据，再叠加本地图鉴展示部件图标与名称。
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, toRef, watch } from 'vue'
import { ExternalLink, RefreshCw, X } from 'lucide-vue-next'
import type { Language, OutfitMessages } from '../i18n'
import {
  getCatalogEntryName,
  getCatalogImageUrl,
  loadItemCatalog,
  type ItemCatalogEntry
} from '../utils/outfit/itemCatalog'
import {
  OutfitCodeParseError,
  parseOutfitCode,
  type LookbookDecodeResult
} from '../utils/outfit/outfitCodeParser'
import { getClothTypeLabel, inferClothTypeFromItemId } from '../utils/outfit/clothType'
import {
  createOutfitDetailPreview,
  loadLocalOutfitDetail,
  loadOutfitDetail,
  type OutfitDetail
} from '../utils/outfit/outfitDetails'
import { useLatestRequest } from '../composables/useLatestRequest'
import { useBodyScrollLock } from '../utils/bodyScrollLock'

import WardrobeOutfitDialog from './WardrobeOutfitDialog.vue'
import {
  loadWardrobeCatalog,
  type WardrobeCatalog,
  type WardrobeEntry
} from '../utils/wardrobe/wardrobeCatalog'
import { emptyWardrobe, loadWardrobe } from '../utils/wardrobe/wardrobeStorage'

const wardrobeCatalog = shallowRef<WardrobeCatalog | null>(null)
const wardrobeSnapshot = ref(emptyWardrobe())
const outfitPreview = shallowRef<WardrobeEntry | null>(null)
const associatedOutfit = computed(() => {
  const id = selectedDetail.value?.outfitId
  const entry = id ? wardrobeCatalog.value?.byId.get(String(id)) : null
  return entry?.kind === 'outfit' ? entry : null
})

const props = defineProps<{
  visible: boolean
  code: string
  language: Language
  messages: OutfitMessages
}>()

const emit = defineEmits<{ close: []; copy: [code: string] }>()

interface ParseItemView {
  id: number
  name: string
  imageUrl: string | null
  resolved: boolean
  outfitId: number | null
  clothType: number | null
  dyes: LookbookDecodeResult['dyeItems'][number]['dyes']
  hasSpecialEffect: boolean
  dyeColors: string[]
}

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorKind = ref<'invalid' | 'unavailable'>('unavailable')
const decoded = ref<LookbookDecodeResult | null>(null)
const catalog = shallowRef<Map<number, ItemCatalogEntry> | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const detailPanelRef = ref<HTMLElement | null>(null)
const detailVisible = ref(false)
const detailLoading = ref(false)
const detailRequest = useLatestRequest()
const selectedDetail = ref<OutfitDetail | null>(null)
const loadedItemImages = ref(new Set<number>())
const failedItemImages = ref(new Set<number>())
const detailImageState = ref<'idle' | 'loaded' | 'failed'>('idle')
let detailItem: ParseItemView | null = null
let detailTrigger: HTMLButtonElement | null = null
let requestId = 0
let previousActiveElement: HTMLElement | null = null

useBodyScrollLock(toRef(props, 'visible'))

const requestCode = computed(() => decoded.value?.code || props.code)

const items = computed<ParseItemView[]>(() => {
  const result = decoded.value
  if (!result) return []
  const catalogIndex = catalog.value
  const dyeByItemId = new Map(result.dyeItems.map((entry) => [entry.itemId, entry]))

  return result.wearingClothes.map(({ itemId, clothType, outfitId }) => {
    const entry = catalogIndex?.get(itemId)
    const baseName = entry ? getCatalogEntryName(entry, props.language) : String(itemId)
    const resolvedClothType = clothType ?? inferClothTypeFromItemId(itemId)
    const typeLabel = getClothTypeLabel(resolvedClothType, props.language)
    const dyeEntry = dyeByItemId.get(itemId)
    const dyes = dyeEntry?.dyes ?? []
    return {
      id: itemId,
      name: typeLabel ? `${baseName}(${typeLabel})` : baseName,
      imageUrl: entry ? getCatalogImageUrl(entry) : null,
      resolved: Boolean(entry),
      outfitId,
      clothType: resolvedClothType,
      dyes,
      hasSpecialEffect: dyeEntry?.hasSpecialEffect ?? false,
      dyeColors: [...new Set(dyes.map((dye) => dye.color))]
    }
  })
})

async function openItemDetail(item: ParseItemView, event?: Event) {
  if (!item.resolved || !item.imageUrl) return
  const request = detailRequest.begin()
  detailItem = item
  if (event)
    detailTrigger = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null
  detailVisible.value = true
  detailLoading.value = true
  const preview = createOutfitDetailPreview(item.id, props.language, item.name)
  // 图鉴重试不重新下载相同图片；仅在图片地址变化时重置加载状态。
  if (selectedDetail.value?.detailImageUrl !== preview.detailImageUrl)
    detailImageState.value = 'idle'
  selectedDetail.value = preview
  void nextTick(() => detailPanelRef.value?.querySelector('button')?.focus())
  try {
    try {
      const local = await loadLocalOutfitDetail(
        item.id,
        item.outfitId,
        props.language,
        item.name,
        item.dyes,
        item.clothType,
        item.hasSpecialEffect
      )
      if (!request.isCurrent()) return
      selectedDetail.value = local
    } catch {
      // 本地图鉴失败仍保留即时预览，后续读取可重试。
    }
    const result = await loadOutfitDetail(
      item.id,
      item.outfitId,
      props.language,
      item.name,
      item.dyes,
      item.clothType,
      item.hasSpecialEffect
    )
    if (!request.isCurrent()) return
    selectedDetail.value = result
    void loadWardrobeCatalog()
      .then((value) => {
        if (request.isCurrent()) wardrobeCatalog.value = value
      })
      .catch(() => {
        if (request.isCurrent() && selectedDetail.value) selectedDetail.value.loadError = true
      })
    void nextTick(() => {
      if (request.isCurrent()) detailPanelRef.value?.querySelector('button')?.focus()
    })
  } catch {
    if (request.isCurrent() && selectedDetail.value) selectedDetail.value.loadError = true
  } finally {
    if (request.isCurrent()) detailLoading.value = false
  }
}

async function openAssociatedOutfit() {
  const entry = associatedOutfit.value
  if (!entry) return
  const currentDetail = selectedDetail.value
  try {
    const snapshot = await loadWardrobe()
    if (!detailVisible.value || selectedDetail.value !== currentDetail) return
    wardrobeSnapshot.value = snapshot
    outfitPreview.value = entry
  } catch {
    if (selectedDetail.value === currentDetail && currentDetail) currentDetail.loadError = true
  }
}

function markItemImageLoaded(itemId: number) {
  loadedItemImages.value.add(itemId)
  failedItemImages.value.delete(itemId)
}

function markItemImageFailed(itemId: number) {
  failedItemImages.value.add(itemId)
}

function markDetailImageLoaded() {
  detailImageState.value = 'loaded'
}

function markDetailImageFailed() {
  detailImageState.value = 'failed'
}

function closeItemDetail() {
  outfitPreview.value = null
  detailRequest.invalidate()
  const trigger = detailTrigger
  detailVisible.value = false
  detailLoading.value = false
  selectedDetail.value = null
  trigger?.focus()
  void nextTick(() => trigger?.focus())
  detailTrigger = null
}

/** 解析当前搭配码；重复解析会作废旧请求结果，避免慢响应覆盖新状态。 */
async function startParse() {
  closeItemDetail()
  const currentRequest = (requestId += 1)
  const code = props.code
  decoded.value = null
  status.value = 'loading'

  if (!code) {
    errorKind.value = 'invalid'
    status.value = 'error'
    return
  }

  try {
    // 图鉴仅补充名称与图片，不阻塞部件和染色；失败或旧请求完成均不覆盖当前解析状态。
    void loadItemCatalog()
      .then((catalogIndex) => {
        if (currentRequest === requestId) catalog.value = catalogIndex
      })
      .catch(() => {
        // 保留部件 ID 和染色结果，再次解析时图鉴加载器会重试。
      })
    const result = await parseOutfitCode(code)
    if (currentRequest !== requestId) return
    decoded.value = result
    status.value = 'success'
  } catch (error) {
    if (currentRequest !== requestId) return
    errorKind.value = error instanceof OutfitCodeParseError ? error.kind : 'unavailable'
    status.value = 'error'
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.visible || event.defaultPrevented || outfitPreview.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    if (detailVisible.value) {
      closeItemDetail()
      return
    }
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const activePanel = detailVisible.value ? detailPanelRef.value : panelRef.value
  if (!activePanel) return
  const focusable = [
    ...activePanel.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')
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

// 打开窗口时开始解析并把焦点移入面板，关闭后把焦点还给来源按钮。
watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      previousActiveElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : null
      void startParse()
      void nextTick(() => panelRef.value?.querySelector('button')?.focus())
    } else {
      requestId += 1
      closeItemDetail()
      previousActiveElement?.focus()
      previousActiveElement = null
    }
  },
  { immediate: true }
)

window.addEventListener('keydown', handleKeydown)
watch(
  () => [props.code, props.language],
  () => {
    if (props.visible) void startParse()
  }
)
onBeforeUnmount(() => {
  requestId++
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="visible"
        class="outfit-editor"
        role="dialog"
        aria-modal="true"
        :aria-label="messages.parseTitle"
        @click.self="$emit('close')"
      >
        <section ref="panelRef" class="outfit-editor-panel outfit-parse-panel">
          <header>
            <div class="outfit-parse-heading">
              <h2>{{ messages.parseTitle }}</h2>
              <p
                v-if="requestCode"
                class="outfit-parse-code"
                :title="messages.operations.copyCode"
                :aria-label="messages.operations.copyCode"
                role="button"
                tabindex="0"
                @click="emit('copy', requestCode)"
                @keydown.enter.prevent="emit('copy', requestCode)"
                @keydown.space.prevent="emit('copy', requestCode)"
              >
                {{ requestCode }}
              </p>
            </div>
            <button
              type="button"
              :title="messages.parseClose"
              :aria-label="messages.parseClose"
              @click="$emit('close')"
            >
              <X :size="19" aria-hidden="true" />
            </button>
          </header>

          <div class="outfit-parse-content">
            <template v-if="status === 'loading'">
              <div class="outfit-parse-status" role="status" aria-live="polite">
                <span class="outfit-parse-spinner" aria-hidden="true"></span>
                <p>{{ messages.parseLoading }}</p>
              </div>
              <div class="outfit-parse-grid" aria-hidden="true">
                <span v-for="index in 10" :key="index" class="outfit-parse-skeleton"></span>
              </div>
            </template>

            <div v-else-if="status === 'error'" class="outfit-parse-status" role="alert">
              <p>{{
                errorKind === 'invalid' ? messages.parseInvalidCode : messages.parseUnavailable
              }}</p>
              <button class="primary-button outfit-parse-retry" type="button" @click="startParse">
                <RefreshCw :size="15" aria-hidden="true" />
                <span>{{ messages.parseRetry }}</span>
              </button>
            </div>

            <div v-else-if="items.length" class="outfit-parse-grid">
              <article
                v-for="(item, imageIndex) in items"
                :key="item.id"
                class="outfit-parse-item"
                :title="item.name"
              >
                <button
                  v-if="item.imageUrl"
                  class="outfit-parse-item-button"
                  type="button"
                  :aria-label="messages.parseOpenDetail(item.name)"
                  @click="openItemDetail(item, $event)"
                >
                  <CatalogImage
                    :language="language"
                    class="outfit-parse-item-icon"
                    :class="{
                      'is-loading':
                        !loadedItemImages.has(item.id) && !failedItemImages.has(item.id),
                      'is-failed': failedItemImages.has(item.id)
                    }"
                    referrerpolicy="no-referrer"
                    :src="item.imageUrl"
                    :alt="item.name"
                    :index="imageIndex"
                    @load="markItemImageLoaded(item.id)"
                    @error="markItemImageFailed(item.id)"
                    @retry="failedItemImages.delete(item.id)"
                  />
                  <span
                    v-if="!loadedItemImages.has(item.id) && !failedItemImages.has(item.id)"
                    class="outfit-image-spinner"
                    aria-hidden="true"
                  ></span>
                </button>
                <span v-else class="outfit-parse-item-icon is-missing" aria-hidden="true">?</span>
                <p class="outfit-parse-item-name">{{ item.name }}</p>
                <div v-if="item.dyeColors.length" class="outfit-parse-dyes">
                  <span
                    v-for="(color, index) in item.dyeColors"
                    :key="`${item.id}-${index}`"
                    class="outfit-parse-dye-dot"
                    :style="{ backgroundColor: color }"
                    :title="color"
                  ></span>
                </div>
              </article>
            </div>

            <p v-else class="outfit-parse-empty">{{ messages.parseEmpty }}</p>
          </div>

          <footer v-if="status === 'success' && items.length" class="outfit-parse-footer">
            <span>{{ messages.parseItemCount(items.length) }}</span>
          </footer>
        </section>
      </div>
    </Transition>
    <Transition name="confirm-dialog">
      <div
        v-if="visible && detailVisible"
        class="outfit-detail-overlay"
        role="dialog"
        aria-modal="true"
        :aria-label="messages.detailTitle"
        @click.self="closeItemDetail"
      >
        <section
          ref="detailPanelRef"
          class="outfit-editor-panel outfit-detail-panel"
          :class="{ 'is-single-column': !selectedDetail?.dyes.length }"
        >
          <header>
            <h2>{{ messages.detailTitle }}</h2>
            <button
              type="button"
              :title="messages.detailClose"
              :aria-label="messages.detailClose"
              @click="closeItemDetail"
            >
              <X :size="19" aria-hidden="true" />
            </button>
          </header>
          <div
            v-if="selectedDetail"
            class="outfit-detail-content"
            :class="{ 'is-single-column': !selectedDetail.dyes.length }"
          >
            <section class="outfit-detail-summary">
              <div
                class="outfit-detail-image-frame"
                :class="{
                  'is-image-loading': selectedDetail.detailImageUrl && detailImageState === 'idle'
                }"
                :aria-busy="!!selectedDetail.detailImageUrl && detailImageState === 'idle'"
              >
                <CatalogImage
                  :language="language"
                  v-if="selectedDetail.detailImageUrl"
                  class="outfit-detail-image"
                  loading="eager"
                  fetchpriority="high"
                  :class="{ 'is-loading': detailImageState === 'idle' }"
                  referrerpolicy="no-referrer"
                  :src="selectedDetail.detailImageUrl"
                  :alt="selectedDetail.itemName"
                  @load="markDetailImageLoaded"
                  @error="markDetailImageFailed"
                  @retry="detailImageState = 'idle'"
                />
                <div
                  v-if="selectedDetail.detailImageUrl && detailImageState === 'idle'"
                  class="outfit-detail-image-placeholder"
                  role="status"
                >
                  <span class="outfit-image-spinner" aria-hidden="true"></span>
                  <span>{{ language === 'zh' ? '正在加载图片…' : 'Loading image…' }}</span>
                </div>
                <div
                  v-else-if="!selectedDetail.detailImageUrl"
                  class="outfit-detail-image is-missing"
                  >{{ language === 'zh' ? '暂无图片' : 'No image' }}</div
                >
              </div>
              <dl class="outfit-detail-info">
                <div
                  ><dt>{{ messages.detailOutfit }}</dt
                  ><dd
                    >{{ selectedDetail.outfitName || messages.detailOutfitUnavailable }}
                    <button
                      v-if="associatedOutfit"
                      type="button"
                      class="wardrobe-outfit-link"
                      :aria-label="messages.detailOutfit + ': ' + selectedDetail.outfitName"
                      :title="messages.detailOutfit"
                      @click="openAssociatedOutfit"
                    >
                      <ExternalLink :size="15" aria-hidden="true" />
                    </button> </dd
                ></div>
                <div
                  ><dt>{{ messages.detailCurrentItem }}</dt
                  ><dd>{{ selectedDetail.itemName }}</dd></div
                >
                <div
                  ><dt>{{ messages.detailEvolution }}</dt
                  ><dd>{{ selectedDetail.evolution }}</dd></div
                >
                <div
                  ><dt>{{ messages.detailDyeCondition }}</dt
                  ><dd>{{ selectedDetail.dyeCondition }}</dd></div
                >
              </dl>
              <p v-if="selectedDetail.loadError" class="outfit-detail-error" role="alert">
                {{ messages.detailLoadFailed }}
                <button
                  type="button"
                  :disabled="detailLoading"
                  @click="detailItem && openItemDetail(detailItem)"
                  >{{ messages.parseRetry }}</button
                >
              </p>
            </section>
            <section v-if="selectedDetail.dyes.length" class="outfit-detail-dyes">
              <h3>{{ messages.detailDyes }}</h3>
              <div class="outfit-detail-table-wrap">
                <table>
                  <thead
                    ><tr
                      ><th>{{ messages.detailArea }}</th
                      ><th>{{ messages.detailPalette }}</th
                      ><th>{{ messages.detailSlot }}</th
                      ><th>{{ messages.detailColor }}</th></tr
                    ></thead
                  >
                  <tbody>
                    <tr v-for="(dye, index) in selectedDetail.dyes" :key="`${dye.area}-${index}`">
                      <td>{{ dye.area }}</td
                      ><td>{{
                        dye.paletteId < 0 ? dye.paletteName : `${dye.paletteId} ${dye.paletteName}`
                      }}</td
                      ><td>{{ dye.slot ?? '—' }}</td>
                      <td
                        ><span class="outfit-detail-color"
                          ><i :style="{ backgroundColor: dye.color }"></i
                          ><code>{{ dye.color }}</code></span
                        ></td
                      >
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
  <WardrobeOutfitDialog
    :detail="outfitPreview"
    @open-outfit="outfitPreview = $event"
    :catalog="wardrobeCatalog"
    :snapshot="wardrobeSnapshot"
    :language="language"
    @close="outfitPreview = null"
  />
</template>

<style scoped>
.wardrobe-outfit-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  vertical-align: middle;
  margin-left: 4px;
  padding: 4px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--pink-deep);
  cursor: pointer;
}
.wardrobe-outfit-link:hover,
.wardrobe-outfit-link:focus-visible {
  background: var(--soft);
  outline: 1px solid var(--pink-deep);
}
</style>
