<script setup lang="ts">
import { ref, toRef, watch } from 'vue'
import { X } from 'lucide-vue-next'
import { useModalFocus } from '../composables/useModalFocus'
import { useBodyScrollLock } from '../utils/bodyScrollLock'

const props = defineProps<{
  visible: boolean
  title: string
  label: string
  placeholder: string
  initialValue: string
  saveLabel: string
  cancelLabel: string
  closeLabel: string
  maxLength: number
  busy: boolean
}>()

const emit = defineEmits<{
  save: [value: string]
  cancel: []
}>()

const value = ref('')
const panelRef = ref<HTMLElement | null>(null)
useBodyScrollLock(toRef(props, 'visible'))
// 备注窗口独占焦点与 Escape，防止快捷键落到后方的大图。
useModalFocus(toRef(props, 'visible'), panelRef, () => {
  if (!props.busy) emit('cancel')
})

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    value.value = props.initialValue
  },
  { immediate: true }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="visible"
        class="note-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.self="emit('cancel')"
        @keydown.left.stop
        @keydown.right.stop
        @keydown.delete.stop
      >
        <section ref="panelRef" class="note-dialog-panel" tabindex="-1">
          <button
            class="note-dialog-close"
            type="button"
            :title="closeLabel"
            :aria-label="closeLabel"
            :disabled="busy"
            @click="emit('cancel')"
            ><X :size="19" aria-hidden="true"
          /></button>
          <header>
            <h2>{{ title }}</h2>
          </header>
          <div class="note-dialog-content">
            <label :for="'photo-note-input'">{{ label }}</label>
            <input
              id="photo-note-input"
              v-model="value"
              :maxlength="maxLength"
              :placeholder="placeholder"
              :disabled="busy"
              @keydown.enter.prevent="emit('save', value)"
            />
            <span>{{ value.length }}/{{ maxLength }}</span>
          </div>
          <footer>
            <button
              type="button"
              class="confirm-dialog-button ghost"
              :disabled="busy"
              @click="emit('cancel')"
              >{{ cancelLabel }}</button
            >
            <button
              type="button"
              class="confirm-dialog-button primary"
              :disabled="busy"
              @click="emit('save', value)"
              >{{ saveLabel }}</button
            >
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
