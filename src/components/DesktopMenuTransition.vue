<script setup lang="ts">
import { useCompactLayout } from '../composables/useCompactLayout'

const compact = useCompactLayout()

/** 退场保留菜单节点，但立即停止其点击和键盘交互；快速重开时恢复。 */
function beforeLeave(element: Element) {
  element.setAttribute('inert', '')
}

function beforeEnter(element: Element) {
  element.removeAttribute('inert')
}
</script>

<template>
  <Transition
    name="desktop-menu"
    :css="!compact"
    @before-enter="beforeEnter"
    @before-leave="beforeLeave"
  >
    <slot />
  </Transition>
</template>
