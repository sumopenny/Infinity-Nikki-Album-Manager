<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { MoreHorizontal } from 'lucide-vue-next'
import { useCompactLayout } from '../composables/useCompactLayout'
defineProps<{ label: string }>()
const compact = useCompactLayout()
const details = ref<HTMLDetailsElement | null>(null)
const closeOutside = (event: PointerEvent) => {
  if (event.target instanceof Node && !details.value?.contains(event.target)) details.value?.removeAttribute('open')
}
onMounted(() => document.addEventListener('pointerdown', closeOutside))
onBeforeUnmount(() => document.removeEventListener('pointerdown', closeOutside))
</script>

<template>
  <div class="outfit-header-actions collection-actions">
    <template v-if="compact"><slot /></template>
    <details v-if="compact" ref="details" class="collection-action-menu" @keydown.esc="details?.removeAttribute('open')" @focusout="!details?.contains($event.relatedTarget as Node) && details?.removeAttribute('open')">
      <summary :aria-label="label"><MoreHorizontal :size="20" /></summary>
      <div class="collection-action-options" @click="details?.removeAttribute('open')"><slot name="secondary" /></div>
    </details>
    <template v-else><slot name="secondary" /><slot /></template>
  </div>
</template>
