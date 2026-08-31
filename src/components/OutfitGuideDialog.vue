<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Archive, FolderOpen, ImagePlus, Sparkles, Tags, X } from 'lucide-vue-next'
import type { OutfitMessages } from '../i18n'

const props = defineProps<{
  visible: boolean
  dismissed: boolean
  messages: OutfitMessages
}>()

const emit = defineEmits<{
  close: [dontShowAgain: boolean]
}>()

const dontShowAgain = ref(false)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const sectionIcons = [ImagePlus, Tags, FolderOpen, Archive]
const featuredIcon = Sparkles
let previousBodyOverflow = ''
let previousActiveElement: HTMLElement | null = null

/** 关闭搭配码引导。参数：无；同时提交当前“不再提示”选项。 */
function closeGuide() {
  emit('close', dontShowAgain.value)
}

/** 处理引导弹窗键盘操作。参数：键盘事件；按 Escape 时关闭弹窗。 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeGuide()
  if (event.key !== 'Tab' || !panelRef.value) return
  const focusable = [...panelRef.value.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')]
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

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      dontShowAgain.value = props.dismissed
      previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      void nextTick(() => closeButtonRef.value?.focus())
    } else {
      document.body.style.overflow = previousBodyOverflow
      previousActiveElement?.focus()
      previousActiveElement = null
    }
  },
  { immediate: true }
)

watch(
  () => props.dismissed,
  (dismissed) => {
    if (props.visible) dontShowAgain.value = dismissed
  }
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="visible"
        class="outfit-guide"
        role="dialog"
        aria-modal="true"
        :aria-label="messages.guideTitle"
        @click.self="closeGuide"
        @keydown="handleKeydown"
      >
        <section ref="panelRef" class="outfit-guide-panel">
          <header>
            <div>
              <p>{{ messages.eyebrow }}</p>
              <h2>{{ messages.guideTitle }}</h2>
            </div>
            <button ref="closeButtonRef" type="button" :title="messages.guideClose" :aria-label="messages.guideClose" @click="closeGuide">
              <X :size="19" aria-hidden="true" />
            </button>
          </header>

          <p class="outfit-guide-intro">{{ messages.guideIntro }}</p>

          <section class="outfit-guide-featured">
            <div class="outfit-guide-section-icon" aria-hidden="true">
              <component :is="featuredIcon" :size="18" />
            </div>
            <div>
              <h3>{{ messages.guideFeaturedSection.title }}</h3>
              <p v-for="item in messages.guideFeaturedSection.items" :key="item">{{ item }}</p>
            </div>
          </section>

          <div class="outfit-guide-sections">
            <section v-for="(section, index) in messages.guideSections" :key="section.title">
              <div class="outfit-guide-section-icon" aria-hidden="true">
                <component :is="sectionIcons[index]" :size="18" />
              </div>
              <div>
                <h3>{{ section.title }}</h3>
                <p v-for="item in section.items" :key="item">{{ item }}</p>
              </div>
            </section>
          </div>

          <footer>
            <label>
              <input v-model="dontShowAgain" type="checkbox" />
              <span>{{ messages.guideDontShowAgain }}</span>
            </label>
            <button class="primary-button" type="button" @click="closeGuide">{{ messages.guideConfirm }}</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
