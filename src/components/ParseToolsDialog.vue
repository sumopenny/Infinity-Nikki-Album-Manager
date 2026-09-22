<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ScanSearch, X } from 'lucide-vue-next'
import { useBodyScrollLock } from '../utils/bodyScrollLock'

const props = defineProps<{
  visible: boolean
  cameraParams: string
  outfitCode: string
  outfitMaxLength: number
  busy: boolean
  messages: {
    title: string
    close: string
    cameraTitle: string
    outfitTitle: string
    cameraPlaceholder: string
    outfitPlaceholder: string
    cameraSubmit: string
    outfitSubmit: string
    busyHint: string
  }
}>()

const emit = defineEmits<{
  close: []
  'update:cameraParams': [value: string]
  'update:outfitCode': [value: string]
  'parse-camera': [value: string]
  'parse-outfit': [value: string]
}>()

const panelRef = ref<HTMLElement | null>(null)
let previousActiveElement: HTMLElement | null = null
useBodyScrollLock(computed(() => props.visible))

function closeDialog() {
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (!props.visible) return
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDialog()
    return
  }
  if (event.key !== 'Tab' || !panelRef.value) return
  const focusable = [...panelRef.value.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hasAttribute('disabled'))
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(() => props.visible, (visible) => {
  if (visible) {
    previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    void nextTick(() => panelRef.value?.querySelector('input')?.focus())
  } else {
    previousActiveElement?.focus()
    previousActiveElement = null
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="visible" class="dialog-overlay parse-tools-dialog" role="dialog" aria-modal="true" :aria-label="messages.title" @click.self="closeDialog" @keydown="handleKeydown">
        <section ref="panelRef" class="dialog-panel parse-tools-panel">
          <header>
            <h2>{{ messages.title }}</h2>
            <button type="button" :title="messages.close" :aria-label="messages.close" @click="closeDialog"><X :size="19" aria-hidden="true" /></button>
          </header>
          <div class="parse-tools-body">
            <p v-if="busy" class="parse-tools-hint">{{ messages.busyHint }}</p>
            <form class="parse-tools-section" @submit.prevent="emit('parse-camera', cameraParams.trim())">
              <h3>{{ messages.cameraTitle }}</h3>
              <div class="outfit-parse-form parse-tools-form-row">
                <input :value="cameraParams" :placeholder="messages.cameraPlaceholder" :aria-label="messages.cameraPlaceholder" :disabled="busy" autocomplete="off" @input="emit('update:cameraParams', ($event.target as HTMLInputElement).value)" />
                <button class="outfit-parse-submit" type="submit" :disabled="busy || !cameraParams.trim()"><ScanSearch :size="16" aria-hidden="true" />{{ messages.cameraSubmit }}</button>
              </div>
            </form>
            <form class="parse-tools-section" @submit.prevent="emit('parse-outfit', outfitCode.trim())">
              <h3>{{ messages.outfitTitle }}</h3>
              <div class="outfit-parse-form parse-tools-form-row">
                <input :value="outfitCode" :maxlength="outfitMaxLength" :placeholder="messages.outfitPlaceholder" :aria-label="messages.outfitPlaceholder" :disabled="busy" autocomplete="off" @input="emit('update:outfitCode', ($event.target as HTMLInputElement).value)" />
                <button class="outfit-parse-submit" type="submit" :disabled="busy || !outfitCode.trim()"><ScanSearch :size="16" aria-hidden="true" />{{ messages.outfitSubmit }}</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
