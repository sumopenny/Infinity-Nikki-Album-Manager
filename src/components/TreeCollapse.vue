<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ open: boolean }>()
const present = ref(props.open)
let closeTimer: ReturnType<typeof setTimeout> | undefined

function clearCloseTimer() {
  if (closeTimer !== undefined) clearTimeout(closeTimer)
  closeTimer = undefined
}

/** 保留退场内容；反向切换仅改变 CSS 目标，让浏览器从当前高度平滑返回。 */
watch(
  () => props.open,
  (open) => {
    clearCloseTimer()
    if (open) {
      present.value = true
    } else if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      present.value = false
    } else {
      // 隐藏页或中途切换系统动画偏好可能没有 transitionend，超时后仍释放节点。
      closeTimer = setTimeout(() => {
        present.value = false
        closeTimer = undefined
      }, 210)
    }
  }
)

function finishClose(event: TransitionEvent) {
  if (
    event.target !== event.currentTarget ||
    event.propertyName !== 'grid-template-rows' ||
    props.open
  )
    return
  clearCloseTimer()
  present.value = false
}

onBeforeUnmount(clearCloseTimer)
</script>

<template>
  <div
    class="tree-collapse"
    :class="{ 'is-open': open }"
    :inert="open ? undefined : true"
    :aria-hidden="!open"
    @transitionend="finishClose"
  >
    <div class="tree-collapse-content"><slot v-if="present" /></div>
  </div>
</template>

<style scoped>
/* 0fr / 1fr 按内容实际高度过渡，父级可自然跟随嵌套分支和动态日期内容。 */
.tree-collapse {
  display: grid;
  grid-template-rows: 0fr;
  opacity: 0;
  transition:
    grid-template-rows 160ms ease-in,
    opacity 160ms ease-in;
}
.tree-collapse.is-open {
  grid-template-rows: 1fr;
  opacity: 1;
  transition-duration: 200ms;
  transition-timing-function: var(--ease-spring);
}
.tree-collapse-content {
  min-height: 0;
  overflow: hidden;
}
@media (prefers-reduced-motion: reduce) {
  .tree-collapse {
    transition: none;
  }
}
</style>
