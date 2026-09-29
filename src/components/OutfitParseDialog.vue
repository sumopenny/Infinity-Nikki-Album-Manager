<script setup lang="ts">
// 搭配码解析窗口：调用解析 API 清洗出部件 ID 与染色数据，再叠加本地图鉴展示部件图标与名称。
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, toRef, watch } from 'vue'
import { RefreshCw, X } from 'lucide-vue-next'
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
import { getClothTypeLabel } from '../utils/outfit/clothType'
import { loadOutfitDetail, type OutfitDetail } from '../utils/outfit/outfitDetails'
import { useBodyScrollLock } from '../utils/bodyScrollLock'

const props = defineProps<{
  visible: boolean
  code: string
  language: Language
  messages: OutfitMessages
}>()

const emit = defineEmits<{ close: [] }>()

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
const selectedDetail = ref<OutfitDetail | null>(null)
const loadedItemImages = ref(new Set<number>())
const failedItemImages = ref(new Set<number>())
const detailImageState = ref<'idle' | 'loaded' | 'failed'>('idle')
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
    const typeLabel = getClothTypeLabel(clothType, props.language)
    const dyeEntry = dyeByItemId.get(itemId)
    const dyes = dyeEntry?.dyes ?? []
    return {
      id: itemId,
      name: typeLabel ? `${baseName}-${typeLabel}` : baseName,
      imageUrl: entry ? getCatalogImageUrl(entry) : null,
      resolved: Boolean(entry),
      outfitId,
      clothType,
      dyes,
      hasSpecialEffect: dyeEntry?.hasSpecialEffect ?? false,
      dyeColors: [...new Set(dyes.map((dye) => dye.color))]
    }
  })
})

async function openItemDetail(item: ParseItemView, event: Event) {
  if (!item.resolved || !item.imageUrl) return
  detailTrigger = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget : null
  detailVisible.value = true
  detailLoading.value = true
  detailImageState.value = 'idle'
  selectedDetail.value = null
  void nextTick(() => detailPanelRef.value?.querySelector('button')?.focus())
  selectedDetail.value = await loadOutfitDetail(item.id, item.outfitId, props.language, item.name, item.dyes, item.clothType, item.hasSpecialEffect)
  detailLoading.value = false
  void nextTick(() => detailPanelRef.value?.querySelector('button')?.focus())
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
    const [catalogIndex, result] = await Promise.all([
      loadItemCatalog(),
      parseOutfitCode(code)
    ])
    if (currentRequest !== requestId) return
    catalog.value = catalogIndex
    decoded.value = result
    status.value = 'success'
  } catch (error) {
    if (currentRequest !== requestId) return
    errorKind.value = error instanceof OutfitCodeParseError ? error.kind : 'unavailable'
    status.value = 'error'
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.visible) return
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
  const focusable = [...activePanel.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hasAttribute('disabled'))
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
watch(() => props.visible, (visible) => {
  if (visible) {
    previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    void startParse()
    void nextTick(() => panelRef.value?.querySelector('button')?.focus())
  } else {
    requestId += 1
    closeItemDetail()
    previousActiveElement?.focus()
    previousActiveElement = null
  }
})

window.addEventListener('keydown', handleKeydown)
onBeforeUnmount(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="visible" class="outfit-editor" role="dialog" aria-modal="true" :aria-label="messages.parseTitle" @click.self="$emit('close')">
        <section ref="panelRef" class="outfit-editor-panel outfit-parse-panel">
          <header>
            <h2>{{ messages.parseTitle }}</h2>
            <button type="button" :title="messages.parseClose" :aria-label="messages.parseClose" @click="$emit('close')">
              <X :size="19" aria-hidden="true" />
            </button>
          </header>

          <div class="outfit-parse-content">
            <p v-if="requestCode" class="outfit-parse-code" :title="requestCode">{{ requestCode }}</p>

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
              <p>{{ errorKind === 'invalid' ? messages.parseInvalidCode : messages.parseUnavailable }}</p>
              <button class="primary-button outfit-parse-retry" type="button" @click="startParse">
                <RefreshCw :size="15" aria-hidden="true" />
                <span>{{ messages.parseRetry }}</span>
              </button>
            </div>

            <div v-else-if="items.length" class="outfit-parse-grid">
              <article v-for="item in items" :key="item.id" class="outfit-parse-item" :title="item.name">
                <button
                  v-if="item.imageUrl"
                  class="outfit-parse-item-button"
                  type="button"
                  :aria-label="messages.parseOpenDetail(item.name)"
                  @click="openItemDetail(item, $event)"
                >
                  <img
                    class="outfit-parse-item-icon"
                    :class="{ 'is-loading': !loadedItemImages.has(item.id), 'is-failed': failedItemImages.has(item.id) }"
                    :src="item.imageUrl"
                    :alt="item.name"
                    loading="lazy"
                    referrerpolicy="no-referrer"
                    @load="markItemImageLoaded(item.id)"
                    @error="markItemImageFailed(item.id)"
                  />
                  <span v-if="!loadedItemImages.has(item.id) && !failedItemImages.has(item.id)" class="outfit-image-spinner" aria-hidden="true"></span>
                  <span v-else-if="failedItemImages.has(item.id)" class="outfit-image-failure" aria-hidden="true">?</span>
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
            <span class="outfit-parse-credit">
              {{ messages.parseServicePrefix }}<a href="https://github.com/RanAxro/nikki_albums" target="_blank" rel="noopener noreferrer">{{ messages.parseServiceNikkiAlbums }}</a>{{ messages.parseServiceAnd }}<a href="https://github.com/dastrokes/gongeo.us-nikki-tracker" target="_blank" rel="noopener noreferrer">{{ messages.parseServiceNikkiTracker }}</a>{{ messages.parseServiceSuffix }}
            </span>
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
            <button type="button" :title="messages.detailClose" :aria-label="messages.detailClose" @click="closeItemDetail">
              <X :size="19" aria-hidden="true" />
            </button>
          </header>
          <div v-if="detailLoading" class="outfit-detail-loading" role="status" aria-live="polite">
            <span class="outfit-parse-spinner" aria-hidden="true"></span>
            <p>{{ messages.detailLoading }}</p>
          </div>
          <div
            v-else-if="selectedDetail"
            class="outfit-detail-content"
            :class="{ 'is-single-column': !selectedDetail.dyes.length }"
          >
            <section class="outfit-detail-summary">
              <div class="outfit-detail-image-frame">
                <img
                  v-if="selectedDetail.detailImageUrl && detailImageState !== 'failed'"
                  class="outfit-detail-image"
                  :class="{ 'is-loading': detailImageState === 'idle' }"
                  :src="selectedDetail.detailImageUrl"
                  :alt="selectedDetail.outfitName || selectedDetail.itemName"
                  referrerpolicy="no-referrer"
                  @load="markDetailImageLoaded"
                  @error="markDetailImageFailed"
                />
                <span v-if="selectedDetail.detailImageUrl && detailImageState === 'idle'" class="outfit-image-spinner outfit-detail-image-spinner" aria-hidden="true"></span>
                <div v-else-if="!selectedDetail.detailImageUrl || detailImageState === 'failed'" class="outfit-detail-image is-missing">?</div>
              </div>
              <dl class="outfit-detail-info">
                <div><dt>{{ messages.detailOutfit }}</dt><dd>{{ selectedDetail.outfitName || messages.detailOutfitUnavailable }}</dd></div>
                <div><dt>{{ messages.detailCurrentItem }}</dt><dd>{{ selectedDetail.itemName }}</dd></div>
                <div><dt>{{ messages.detailEvolution }}</dt><dd>{{ selectedDetail.evolution }}</dd></div>
                <div><dt>{{ messages.detailDyeCondition }}</dt><dd>{{ selectedDetail.dyeCondition }}</dd></div>
              </dl>
              <p v-if="selectedDetail.loadError" class="outfit-detail-error" role="alert">{{ messages.detailLoadFailed }}</p>
            </section>
            <section v-if="selectedDetail.dyes.length" class="outfit-detail-dyes">
              <h3>{{ messages.detailDyes }}</h3>
              <div class="outfit-detail-table-wrap">
                <table>
                  <thead><tr><th>{{ messages.detailArea }}</th><th>{{ messages.detailPalette }}</th><th>{{ messages.detailSlot }}</th><th>{{ messages.detailColor }}</th></tr></thead>
                  <tbody>
                    <tr v-for="(dye, index) in selectedDetail.dyes" :key="`${dye.area}-${index}`">
                      <td>{{ dye.area }}</td><td>{{ dye.paletteId }} {{ dye.paletteName }}</td><td>{{ dye.slot ?? '—' }}</td>
                      <td><span class="outfit-detail-color"><i :style="{ backgroundColor: dye.color }"></i><code>{{ dye.color }}</code></span></td>
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
</template>
