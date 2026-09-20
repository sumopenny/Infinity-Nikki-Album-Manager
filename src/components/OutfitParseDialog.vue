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
  dyeColors: string[]
}

const status = ref<'loading' | 'success' | 'error'>('loading')
const errorKind = ref<'invalid' | 'unavailable'>('unavailable')
const decoded = ref<LookbookDecodeResult | null>(null)
const catalog = shallowRef<Map<number, ItemCatalogEntry> | null>(null)
const panelRef = ref<HTMLElement | null>(null)
let requestId = 0
let previousActiveElement: HTMLElement | null = null

useBodyScrollLock(toRef(props, 'visible'))

const requestCode = computed(() => decoded.value?.code || props.code)

const items = computed<ParseItemView[]>(() => {
  const result = decoded.value
  if (!result) return []
  const catalogIndex = catalog.value
  const dyeByItemId = new Map(result.dyeItems.map((entry) => [entry.itemId, entry.dyes]))

  return result.wearingClothes.map((id) => {
    const entry = catalogIndex?.get(id)
    return {
      id,
      name: entry ? getCatalogEntryName(entry, props.language) : String(id),
      imageUrl: entry ? getCatalogImageUrl(entry) : null,
      resolved: Boolean(entry),
      dyeColors: (dyeByItemId.get(id) ?? []).map((dye) => dye.color)
    }
  })
})

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
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !panelRef.value) return
  const focusable = [...panelRef.value.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')]
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
                <img
                  v-if="item.imageUrl"
                  class="outfit-parse-item-icon"
                  :src="item.imageUrl"
                  :alt="item.name"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                />
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
  </Teleport>
</template>
