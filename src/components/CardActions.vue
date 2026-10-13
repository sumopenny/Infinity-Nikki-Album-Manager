<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MoreHorizontal } from 'lucide-vue-next'
import { useCompactLayout } from '../composables/useCompactLayout'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import { useModalFocus } from '../composables/useModalFocus'
defineProps<{ label: string; title: string; closeLabel: string; disabled?: boolean }>()
const compact = useCompactLayout()
const open = ref(false)
useBodyScrollLock(computed(() => compact.value && open.value))
const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
function close() { open.value = false; trigger.value?.focus() }
useModalFocus(computed(() => compact.value && open.value), panel, close)
watch(compact, close)
</script>

<template>
  <button v-if="compact" ref="trigger" class="card-menu-trigger" type="button" :aria-label="`${label}: ${title}`" :disabled="disabled" :aria-expanded="open" @click.stop="open = !open"><MoreHorizontal :size="19" /></button>
  <div v-else class="desktop-card-actions" @click.stop><slot /></div>
  <Teleport v-if="compact" to="body">
    <div v-if="open" class="card-action-overlay" @click.self="close" @keydown.esc.stop="close">
      <section ref="panel" class="card-action-panel" tabindex="-1" role="dialog" aria-modal="true" :aria-label="`${label}: ${title}`">
        <header><strong>{{ title }}</strong><button type="button" @click="close">{{ closeLabel }}</button></header>
        <div @click.capture="close"><slot /></div>
      </section>
    </div>
  </Teleport>
</template>
