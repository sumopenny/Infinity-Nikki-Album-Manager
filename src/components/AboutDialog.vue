<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Images, Shirt, SquareCheckBig, X } from 'lucide-vue-next'
import { ABOUT_VERSION, type LocaleMessages } from '../i18n'

const props = defineProps<{
  visible: boolean
  dismissed: boolean
  messages: LocaleMessages['about']
  topBarMessages: LocaleMessages['topBar']
}>()

const emit = defineEmits<{
  close: [dontShowAgain: boolean]
}>()

const dontShowAgain = ref(false)
const panelRef = ref<HTMLElement | null>(null)
// 当前版本号对应的日志标签，用于给最新版本加“当前版本”标识
const currentVersionLabel = `v${ABOUT_VERSION}`
// 功能卡片图标，按 i18n 功能列表顺序展示
const featureIcons = [Images, SquareCheckBig, Shirt]
let previousBodyOverflow = ''
let previousActiveElement: HTMLElement | null = null

/** 关闭关于窗口。参数：无；同时提交当前“不再提示”选项。 */
function closeDialog() {
  emit('close', dontShowAgain.value)
}

/** 处理关于窗口键盘操作。参数：键盘事件；按 Escape 关闭弹窗，Tab 在弹窗内循环聚焦。 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') closeDialog()
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
      // 不自动聚焦关闭按钮，避免叉号周围出现焦点边框
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
        class="help-dialog about-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="messages.title"
        @click.self="closeDialog"
        @keydown="handleKeydown"
      >
        <section ref="panelRef" class="help-dialog-panel about-dialog-panel">
          <button class="about-dialog-close" type="button" :title="messages.closeAria" :aria-label="messages.closeAria" @click="closeDialog">
            <X :size="19" aria-hidden="true" />
          </button>

          <div class="about-dialog-body">
            <section>
              <h3>{{ messages.changelogTitle }}</h3>
              <div
                v-for="entry in messages.changelog"
                :key="entry.version"
                class="about-changelog-entry"
                :class="{ 'is-current': entry.version === currentVersionLabel }"
              >
                <span class="about-changelog-version">{{ entry.version }}</span>
                <p>{{ entry.text }}</p>
              </div>
            </section>
            <section>
              <h3>{{ messages.introTitle }}</h3>
              <p>{{ messages.intro }}</p>
            </section>
            <section>
              <h3>{{ messages.featuresTitle }}</h3>
              <div class="about-feature-grid">
                <div v-for="(item, index) in messages.features" :key="item" class="about-feature-card">
                  <span class="about-feature-icon">
                    <component :is="featureIcons[index] ?? featureIcons[0]" :size="17" aria-hidden="true" />
                  </span>
                  <p>{{ item }}</p>
                </div>
              </div>
            </section>
            <div class="about-dialog-grid">
              <section>
                <h3>{{ topBarMessages.helpMouseTitle }}</h3>
                <p v-for="item in topBarMessages.helpMouseItems" :key="item">{{ item }}</p>
              </section>
              <section>
                <h3>{{ topBarMessages.helpKeyboardTitle }}</h3>
                <p v-for="item in topBarMessages.helpKeyboardItems" :key="item">{{ item }}</p>
              </section>
            </div>
          </div>

          <footer class="about-dialog-footer">
            <label>
              <input v-model="dontShowAgain" type="checkbox" />
              <span>{{ messages.dontShowAgain }}</span>
            </label>
            <button class="primary-button" type="button" @click="closeDialog">{{ messages.confirm }}</button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
