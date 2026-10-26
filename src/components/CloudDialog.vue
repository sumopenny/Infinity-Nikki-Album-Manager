<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import { useModalPresence } from '../composables/useModalPresence'
const props = defineProps<{ visible: boolean; busy: boolean; title: string; cancelLabel: string }>()
const emit = defineEmits<{ close: []; submit: []; lock: [value: boolean] }>()
const visible = ref(props.visible)
watch(
  () => props.visible,
  (value) => {
    visible.value = value
  }
)
const dialog = ref<HTMLDialogElement | null>(null)
let opener: HTMLElement | null = null
const modal = useModalPresence(visible, ref(true))
useBodyScrollLock(modal.present)
watch(visible, async (value) => {
  if (value) {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    dialog.value?.showModal()
  }
})
watch(modal.present, (value) => {
  emit('lock', value)
  if (!value) {
    dialog.value?.close()
    opener?.focus()
  }
})
function close() {
  if (!props.busy) emit('close')
}
</script>
<template>
  <Teleport to="body">
    <dialog ref="dialog" class="resonance-cloud-dialog" :aria-label="title" @cancel.prevent="close">
      <Transition
        name="confirm-dialog"
        @before-enter="modal.beforeEnter"
        @before-leave="modal.beforeLeave"
        @after-leave="modal.afterLeave"
      >
        <div v-if="visible" class="dialog-overlay resonance-import-dialog" @click.self="close">
          <form
            class="dialog-panel resonance-import-panel resonance-cloud-panel"
            novalidate
            @submit.prevent="$emit('submit')"
          >
            <header
              ><h2>{{ title }}</h2
              ><button type="button" :disabled="busy" :aria-label="cancelLabel" @click="close"
                ><X :size="20" /></button
            ></header>
            <div class="resonance-import-body resonance-cloud-body"><slot /></div>
            <footer class="resonance-import-footer"><slot name="footer" /></footer>
          </form>
        </div>
      </Transition>
    </dialog>
  </Teleport>
</template>
<style scoped>
/* 原生模态层只负责焦点和 Escape，外观复用共鸣导入窗口及手机可视区域规则。 */
.resonance-cloud-dialog {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  overflow: hidden;
}
.resonance-cloud-dialog::backdrop {
  background: transparent;
}
.resonance-cloud-panel {
  --dialog-accent: var(--pink-deep);
  width: min(680px, 100%);
  height: auto;
}
.resonance-cloud-body {
  flex: 0 1 auto;
  gap: 16px;
}
.resonance-cloud-panel :deep(p) {
  font-size: 13px;
}
.resonance-cloud-panel :deep(label) {
  display: grid;
  gap: 8px;
  font-size: 14px;
}
.resonance-cloud-panel :deep(button:focus-visible) {
  outline: 2px solid var(--heading);
  outline-offset: 2px;
}
.resonance-cloud-body :deep(.resonance-cloud-error) {
  color: var(--notice-error);
}
.resonance-cloud-panel footer {
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
