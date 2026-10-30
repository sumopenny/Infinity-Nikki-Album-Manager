<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
const props = defineProps<{ count: number }>()
const root = ref<HTMLElement | null>(null)
const active = ref(false)
const height = ref(0)
let observer: IntersectionObserver | undefined
let resize: ResizeObserver | undefined
function estimate() {
  const element = root.value
  if (!element || active.value) return
  const style = getComputedStyle(element)
  const columns = Math.max(1, style.gridTemplateColumns.split(' ').length)
  const gap = parseFloat(style.rowGap) || 12
  const width = (element.clientWidth - gap * (columns - 1)) / columns
  height.value = Math.ceil(props.count / columns) * (width + gap)
}
onMounted(() => {
  estimate()
  if (!('IntersectionObserver' in window)) { active.value = true; return }
  observer = new IntersectionObserver(async ([entry]) => {
    if (!entry) return
    if (!entry.isIntersecting && root.value?.contains(document.activeElement)) return
    if (!entry.isIntersecting && root.value && active.value)
      height.value = root.value.getBoundingClientRect().height
    active.value = entry.isIntersecting
    if (active.value) { await nextTick(); if (root.value) height.value = root.value.getBoundingClientRect().height }
  }, { rootMargin: '1000px 0px' })
  observer.observe(root.value!)
  if (typeof ResizeObserver !== 'undefined') {
    resize = new ResizeObserver(estimate)
    resize.observe(root.value!)
  }
})
onBeforeUnmount(() => { observer?.disconnect(); resize?.disconnect() })
</script>
<template>
  <div ref="root" class="photo-grid" :style="active ? undefined : { height: `${height}px`, minHeight: '1px' }">
    <slot v-if="active" />
  </div>
</template>

<style scoped>
.photo-grid + .photo-grid { margin-top: 14px; }
</style>
