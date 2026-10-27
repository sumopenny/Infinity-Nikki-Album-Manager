<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Cloud, ChevronDown } from 'lucide-vue-next'
import { useCompactLayout } from '../composables/useCompactLayout'
import DesktopMenuTransition from './DesktopMenuTransition.vue'

defineProps<{ label: string; hideArrow?: boolean }>()
const compact = useCompactLayout()
const opened = ref(false)
const root = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
let restoreFocus = false

function toggle() {
  restoreFocus = false
  opened.value = !opened.value
}

function close(restore = false) {
  restoreFocus = restore
  opened.value = false
  if (restore) void nextTick(finishClose)
}
function finishClose() {
  const current = document.activeElement
  if (
    restoreFocus &&
    !opened.value &&
    (!current || current === document.body || root.value?.contains(current))
  )
    trigger.value?.focus({ preventScroll: true })
  restoreFocus = false
}
function escape(event: KeyboardEvent) {
  // 手机端由外层操作菜单处理 Esc，不拦截其事件。
  if (compact.value) return
  event.stopPropagation()
  event.preventDefault()
  close(true)
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target)) close()
}
watch(compact, () => close())
onMounted(() => document.addEventListener('pointerdown', outside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', outside))
</script>

<template>
  <div
    ref="root"
    class="cloud-actions-menu"
    :class="{ 'is-compact': compact }"
    @keydown.esc="escape"
    @focusout="opened && !root?.contains($event.relatedTarget as Node) && close()"
  >
    <button v-if="!compact" ref="trigger" type="button" :aria-expanded="opened" @click="toggle">
      <Cloud :size="16" aria-hidden="true" />{{ label
      }}<ChevronDown v-if="!hideArrow" :size="14" aria-hidden="true" />
    </button>
    <DesktopMenuTransition>
      <!-- 隐藏而不卸载，确保选择云端操作后其弹窗与会话继续存在。 -->
      <div
        v-show="compact || opened"
        :class="compact ? 'cloud-actions-inline' : 'cloud-actions-options'"
        @click="($event.target as Element).closest('button') && close()"
      >
        <slot />
      </div>
    </DesktopMenuTransition>
  </div>
</template>

<style scoped>
.cloud-actions-menu {
  position: relative;
  flex: none;
}
.cloud-actions-menu > button,
.cloud-actions-options :deep(button) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 6px 10px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-strong);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.cloud-actions-menu button:hover:not(:disabled) {
  border-color: var(--pink-deep);
  color: var(--heading);
}
.cloud-actions-options {
  position: absolute;
  z-index: 35;
  top: calc(100% + 6px);
  right: 0;
  display: grid;
  gap: 4px;
  min-width: 220px;
  max-width: min(280px, 80vw);
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-strong);
  box-shadow: var(--dialog-shadow);
}
.cloud-actions-options :deep(button) {
  width: 100%;
  min-height: 40px;
  padding: 10px 12px;
  justify-content: flex-start;
}
.cloud-actions-options :deep(.cloud-account),
.cloud-actions-options :deep(.resonance-cloud-account) {
  box-sizing: border-box;
  max-width: 240px;
}
.is-compact,
.cloud-actions-inline {
  display: contents;
}
.cloud-actions-inline :deep(button) {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  justify-content: flex-start;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-strong);
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
  white-space: normal;
  text-align: left;
}
@media (min-width: 900px) {
  .cloud-actions-options {
    animation: cleanup-account-menu-in 0.18s var(--ease-spring);
    transform-origin: top right;
  }
}
@media (min-width: 900px) and (prefers-reduced-motion: reduce) {
  .cloud-actions-options {
    animation: none;
  }
}
</style>
