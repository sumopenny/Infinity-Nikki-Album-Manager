<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useBodyScrollLock } from '../utils/bodyScrollLock'

const props = defineProps<{ compact: boolean; open: boolean; title: string; closeLabel: string; applyLabel: string }>()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
const modal = computed(() => props.compact && props.open)
useBodyScrollLock(modal)
let previousFocus: HTMLElement | null = null
watch(modal, async (open) => {
  if (open) {
    previousFocus = document.activeElement as HTMLElement | null
    await nextTick()
    panel.value?.focus()
  } else previousFocus?.focus()
})

/** 筛选面板保持焦点在当前层；标签输入浮层和确认窗口仍使用各自的事件。 */
function handleKeydown(event: KeyboardEvent) {
  if (!modal.value || event.defaultPrevented) return
  if (event.key === 'Escape') { event.stopPropagation(); emit('close') }
  if (event.key !== 'Tab') return
  const targets = [...(panel.value?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select, [tabindex="0"]') ?? [])]
    .filter(element => element.getClientRects().length)
  const first = targets[0], last = targets.at(-1)
  if (!first) { event.preventDefault(); return }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.value)) { event.preventDefault(); first.focus() }
}
</script>

<template>
  <Teleport to="body" :disabled="!compact">
    <div v-show="!compact || open" :class="{ 'mobile-filter-overlay': compact }" @click.self="compact && $emit('close')" @keydown="handleKeydown">
      <section ref="panel" :class="{ 'mobile-filter-panel': compact }" :role="compact ? 'dialog' : undefined" :aria-modal="compact ? true : undefined" :aria-label="compact ? title : undefined" :tabindex="compact ? -1 : undefined">
        <header v-if="compact"><strong>{{ title }}</strong><button type="button" :aria-label="closeLabel" @click="$emit('close')"><X :size="20" /></button></header>
        <div :class="{ 'mobile-filter-body': compact }"><slot /></div>
        <footer v-if="compact"><button class="primary-button" type="button" @click="$emit('close')">{{ applyLabel }}</button></footer>
      </section>
    </div>
  </Teleport>
</template>
