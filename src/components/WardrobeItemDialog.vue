<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ExternalLink, X } from 'lucide-vue-next'
import type { Language } from '../i18n/types'
import type { WardrobeEntry } from '../utils/wardrobe/wardrobeCatalog'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import { useModalFocus } from '../composables/useModalFocus'

const props = defineProps<{
  item: WardrobeEntry | null
  outfits: WardrobeEntry[]
  layer?: number
  language: Language
}>()
const emit = defineEmits<{ close: []; openOutfit: [outfit: WardrobeEntry] }>()
const visible = computed(() => !!props.item)
const panel = ref<HTMLElement | null>(null)
const imageState = ref<'loading' | 'loaded' | 'failed'>('loading')
const imageUrl = computed(() => props.item?.image.replace('/items/icons/', '/items/') ?? '')
const text = (zh: string, en: string) => (props.language === 'zh' ? zh : en)
const close = () => emit('close')
watch(
  () => props.item?.id,
  () => {
    imageState.value = 'loading'
  }
)
useBodyScrollLock(visible)
useModalFocus(visible, panel, close)
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="item"
        class="outfit-detail-overlay"
        :style="{ zIndex: layer ?? 220 }"
        @click.self="close"
      >
        <section
          ref="panel"
          class="outfit-editor-panel outfit-detail-panel is-single-column"
          tabindex="-1"
          role="dialog"
          aria-modal="true"
          aria-labelledby="wardrobe-item-title"
        >
          <header>
            <h2 id="wardrobe-item-title">{{ text('部件详情', 'Item details') }}</h2>
            <button type="button" :aria-label="text('关闭', 'Close')" @click="close">
              <X :size="19" aria-hidden="true" />
            </button>
          </header>
          <div class="outfit-detail-content is-single-column">
            <section class="outfit-detail-summary">
              <div
                class="outfit-detail-image-frame"
                :class="{ 'is-image-loading': imageState === 'loading' }"
                :aria-busy="imageState === 'loading'"
              >
                <img
                  v-if="imageState !== 'failed'"
                  :key="item.id"
                  class="outfit-detail-image"
                  :class="{ 'is-loading': imageState === 'loading' }"
                  :src="imageUrl"
                  :alt="item.name[language]"
                  referrerpolicy="no-referrer"
                  @load="imageState = 'loaded'"
                  @error="imageState = 'failed'"
                />
                <div
                  v-if="imageState === 'loading'"
                  class="outfit-detail-image-placeholder"
                  role="status"
                >
                  <span class="outfit-image-spinner" aria-hidden="true"></span>
                  <span>{{ text('正在加载图片…', 'Loading image…') }}</span>
                </div>
                <div v-else-if="imageState === 'failed'" class="outfit-detail-image is-missing">
                  {{ text('暂无图片', 'No image') }}
                </div>
              </div>
              <dl class="outfit-detail-info">
                <div
                  ><dt>{{ text('所属套装', 'Outfit') }}</dt
                  ><dd>
                    <template v-if="outfits.length">
                      <span v-for="(outfit, index) in outfits" :key="outfit.id">
                        <span v-if="index"> / </span>{{ outfit.name[language] }}
                        <button
                          type="button"
                          class="wardrobe-outfit-link"
                          :aria-label="text('查看套装：', 'View outfit: ') + outfit.name[language]"
                          :title="text('查看套装', 'View outfit')"
                          @click="emit('openOutfit', outfit)"
                          ><ExternalLink :size="15" aria-hidden="true"
                        /></button>
                      </span>
                    </template>
                    <template v-else>{{ text('无所属套装', 'No associated outfit') }}</template>
                  </dd></div
                >
                <div
                  ><dt>{{ text('当前部件', 'Current item') }}</dt
                  ><dd>{{ item.name[language] }}</dd></div
                >
              </dl>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
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
.outfit-detail-image-frame {
  display: block;
  width: fit-content;
  max-width: 100%;
  height: auto;
}
.outfit-detail-image-frame img.outfit-detail-image {
  display: block;
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: min(400px, 55dvh);
}
.outfit-detail-image-frame:has(.is-missing) {
  width: min(273px, 100%);
  min-height: 180px;
}
</style>
