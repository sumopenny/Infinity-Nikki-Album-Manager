<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { MoreHorizontal } from 'lucide-vue-next'
import { useCompactLayout } from '../composables/useCompactLayout'
defineProps<{ label: string; mobileTarget?: string }>()
defineOptions({ inheritAttrs: false })
const compact = useCompactLayout()
const details = ref<HTMLDetailsElement | null>(null)
const closeOutside = (event: PointerEvent) => {
  if (event.target instanceof Node && !details.value?.contains(event.target)) details.value?.removeAttribute('open')
}
onMounted(() => document.addEventListener('pointerdown', closeOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOutside))
</script>

<template>
  <!-- 手机将原操作节点移入标签栏，保留事件、繁忙状态和桌面顺序。 -->
  <Teleport :to="mobileTarget || 'body'" :disabled="!compact || !mobileTarget" defer>
  <div v-bind="$attrs" class="outfit-header-actions collection-actions" :class="{ 'collection-icon-actions': mobileTarget }">
    <template v-if="compact"><slot /></template>
    <details v-if="compact" ref="details" class="collection-action-menu" @keydown.esc="details?.removeAttribute('open')" @focusout="!details?.contains($event.relatedTarget as Node) && details?.removeAttribute('open')">
      <summary :aria-label="label" :title="label"><MoreHorizontal :size="20" aria-hidden="true" /></summary>
      <div class="collection-action-options" @click="details?.removeAttribute('open')"><slot name="secondary" /></div>
    </details>
    <template v-else><slot name="secondary" /><slot /></template>
  </div>
  </Teleport>
</template>
