<script setup lang="ts">
import { computed, nextTick, ref, toRef, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import { useModalPresence } from '../composables/useModalPresence'
import { useModalFocus } from '../composables/useModalFocus'

const props = defineProps<{ compact: boolean; open: boolean; title: string; closeLabel: string; applyLabel: string; tagPicker?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement | null>(null)
const modal = computed(() => props.compact && props.open)
const motion = useModalPresence(modal, toRef(props, 'compact'))
useBodyScrollLock(motion.present)
useModalFocus(motion.present, panel, () => emit('close'))
// v-show 退场被快速重开取消时，present 不变，仍需把焦点送回已解除 inert 的面板。
watch(modal, async (open) => {
  if (!open) return
  await nextTick()
  if (modal.value) panel.value?.focus({ preventScroll: true })
})
</script>

<template>
  <Teleport to="body" :disabled="!compact">
    <Transition :name="compact ? 'mobile-modal' : undefined" :css="compact" @before-enter="motion.beforeEnter" @before-leave="motion.beforeLeave" @after-leave="motion.afterLeave">
    <div v-show="!compact || open" :class="{ 'mobile-filter-overlay': compact, 'mobile-tag-picker': compact && tagPicker }" @click.self="compact && $emit('close')">
      <section ref="panel" :class="{ 'mobile-filter-panel': compact }" :role="compact ? 'dialog' : undefined" :aria-modal="compact ? true : undefined" :aria-label="compact ? title : undefined" :tabindex="compact ? -1 : undefined">
        <header v-if="compact"><h2 v-if="tagPicker">{{ title }}</h2><strong v-else>{{ title }}</strong><button type="button" :aria-label="closeLabel" @click="$emit('close')"><X :size="20" /></button></header>
        <div :class="{ 'mobile-filter-body': compact }"><slot /></div>
        <footer v-if="compact && !tagPicker"><button class="primary-button" type="button" @click="$emit('close')">{{ applyLabel }}</button></footer>
      </section>
    </div>
    </Transition>
  </Teleport>
</template>
