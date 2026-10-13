<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MoreHorizontal } from 'lucide-vue-next'
import { useCompactLayout } from '../composables/useCompactLayout'
defineProps<{ label: string; mobileTarget?: string }>()
defineOptions({ inheritAttrs: false })
const compact = useCompactLayout()
const menu = ref<HTMLElement | null>(null)
const trigger = ref<HTMLButtonElement | null>(null)
const menuOpen = ref(false)
let restoreFocus = false

/** 仅显式关闭时还原焦点；选择操作或点击外部由新目标接管焦点。 */
function closeMenu(restore = false) {
  restoreFocus = restore
  menuOpen.value = false
}

function finishClose() {
  const current = document.activeElement
  if (restoreFocus && !menuOpen.value && (!current || current === document.body || menu.value?.contains(current))) trigger.value?.focus({ preventScroll: true })
  restoreFocus = false
}

/** 用受控状态保留退场节点，避免原生 details 立即隐藏菜单而截断动画。 */
function toggleMenu() {
  restoreFocus = false
  menuOpen.value = !menuOpen.value
}

const closeOutside = (event: PointerEvent) => {
  if (event.target instanceof Node && !menu.value?.contains(event.target)) closeMenu()
}
watch(compact, () => closeMenu())
onMounted(() => document.addEventListener('pointerdown', closeOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOutside))
</script>

<template>
  <!-- 手机将原操作节点移入标签栏，保留事件、繁忙状态和桌面顺序。 -->
  <Teleport :to="mobileTarget || 'body'" :disabled="!compact || !mobileTarget" defer>
  <div v-bind="$attrs" class="outfit-header-actions collection-actions" :class="{ 'collection-icon-actions': mobileTarget }">
    <template v-if="compact"><slot /></template>
    <div v-if="compact" ref="menu" class="collection-action-menu" @keydown.esc.stop.prevent="closeMenu(true)" @focusout="menuOpen && !menu?.contains($event.relatedTarget as Node) && closeMenu()">
      <button ref="trigger" class="collection-action-trigger" type="button" :aria-label="label" :title="label" :aria-expanded="menuOpen" @click="toggleMenu"><MoreHorizontal :size="20" aria-hidden="true" /></button>
      <Transition name="mobile-action-menu" @after-leave="finishClose" @before-enter="element => element.removeAttribute('inert')" @before-leave="element => element.setAttribute('inert', '')">
        <div v-if="menuOpen" class="collection-action-options" @click="closeMenu()"><slot name="secondary" /></div>
      </Transition>
    </div>
    <template v-else><slot name="secondary" /><slot /></template>
  </div>
  </Teleport>
</template>
