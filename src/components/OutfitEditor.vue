<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ImagePlus, Upload, X } from 'lucide-vue-next'
import type { OutfitMessages } from '../outfitMessages'
import { MAX_OUTFIT_CODE_LENGTH, normalizeOutfitCode, type OutfitItem } from '../utils/outfitFileSystem'

const props = defineProps<{
  visible: boolean
  outfit: OutfitItem | null
  tags: string[]
  busy: boolean
  messages: OutfitMessages
}>()

const emit = defineEmits<{
  close: []
  save: [input: { imageFile?: File; code: string; tag: string | null }]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const codeInput = ref<HTMLInputElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const imageFile = ref<File | undefined>()
const previewUrl = ref<string | null>(null)
const code = ref('')
const selectedTag = ref<string | null>(null)
const errorMessage = ref('')
const isDragging = ref(false)
let previousBodyOverflow = ''
let isBodyScrollLockedByEditor = false
let previousActiveElement: HTMLElement | null = null

const hasImage = computed(() => Boolean(imageFile.value || props.outfit))

function revokePreview() {
  if (previewUrl.value?.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
}

async function resetForm() {
  revokePreview()
  imageFile.value = undefined
  code.value = props.outfit?.code ?? ''
  selectedTag.value = props.outfit?.tags[0] ?? null
  errorMessage.value = ''
  isDragging.value = false
  if (props.outfit) {
    try {
      previewUrl.value = URL.createObjectURL(await props.outfit.fileHandle.getFile())
    } catch {
      errorMessage.value = props.messages.imageLoadFailed
    }
  }
}

function isAcceptedImage(file: File): boolean {
  return /\.(jpe?g|png|webp)$/i.test(file.name) || ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
}

function selectFile(file: File | undefined) {
  if (!file) return
  if (!isAcceptedImage(file)) {
    errorMessage.value = props.messages.unsupportedImage
    return
  }
  revokePreview()
  imageFile.value = file
  previewUrl.value = URL.createObjectURL(file)
  errorMessage.value = ''
}

function handleDrop(event: DragEvent) {
  isDragging.value = false
  selectFile(event.dataTransfer?.files[0])
}

function handlePaste(event: ClipboardEvent) {
  if (!props.visible) return
  const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith('image/'))
  if (file) selectFile(file)
}

function handleKeydown(event: KeyboardEvent) {
  if (props.visible && !props.busy && event.key === 'Escape') emit('close')
  if (!props.visible || event.key !== 'Tab' || !panelRef.value) return
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

function updateCode(event: Event) {
  code.value = normalizeOutfitCode((event.target as HTMLInputElement).value)
}

function submit() {
  if (!hasImage.value) {
    errorMessage.value = props.messages.imageRequired
    return
  }
  emit('save', { imageFile: imageFile.value, code: code.value, tag: selectedTag.value })
}

// 打开编辑器时锁定背景滚动，关闭后恢复进入前状态，兼容从大图预览叠加打开。
watch(() => props.visible, (visible) => {
  if (visible) {
    previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
    previousBodyOverflow = document.body.style.overflow
    isBodyScrollLockedByEditor = true
    document.body.style.overflow = 'hidden'
    void resetForm()
    void nextTick(() => codeInput.value?.focus())
  } else {
    document.body.style.overflow = previousBodyOverflow
    isBodyScrollLockedByEditor = false
    revokePreview()
    previousActiveElement?.focus()
    previousActiveElement = null
  }
})

window.addEventListener('paste', handlePaste)
window.addEventListener('keydown', handleKeydown)
onBeforeUnmount(() => {
  window.removeEventListener('paste', handlePaste)
  window.removeEventListener('keydown', handleKeydown)
  if (isBodyScrollLockedByEditor) document.body.style.overflow = previousBodyOverflow
  revokePreview()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="visible" class="outfit-editor" role="dialog" aria-modal="true" :aria-label="messages.editTitle" @click.self="$emit('close')">
        <section ref="panelRef" class="outfit-editor-panel">
          <header>
            <h2>{{ messages.editTitle }}</h2>
            <button type="button" :title="messages.cancel" :aria-label="messages.cancel" :disabled="busy" @click="$emit('close')">
              <X :size="19" aria-hidden="true" />
            </button>
          </header>

          <div class="outfit-editor-content">
            <div class="outfit-image-column">
              <label>{{ messages.imageLabel }}</label>
              <button
                class="outfit-image-dropzone"
                :class="{ 'is-dragging': isDragging, 'has-preview': previewUrl }"
                type="button"
                :disabled="busy"
                @click="fileInput?.click()"
                @dragenter.prevent="isDragging = true"
                @dragover.prevent="isDragging = true"
                @dragleave.prevent="isDragging = false"
                @drop.prevent="handleDrop"
              >
                <img v-if="previewUrl" :src="previewUrl" alt="" />
                <span v-else class="outfit-image-prompt"><ImagePlus :size="30" aria-hidden="true" />{{ messages.imageHint }}</span>
                <span v-if="previewUrl" class="outfit-replace-image"><Upload :size="15" aria-hidden="true" />{{ messages.replaceImage }}</span>
              </button>
              <input
                ref="fileInput"
                class="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                @change="selectFile(($event.target as HTMLInputElement).files?.[0])"
              />
            </div>

            <div class="outfit-fields">
              <label for="outfit-code">{{ messages.codeLabel }}</label>
              <input
                id="outfit-code"
                ref="codeInput"
                :value="code"
                :maxlength="MAX_OUTFIT_CODE_LENGTH"
                :placeholder="messages.codePlaceholder"
                :disabled="busy"
                autocomplete="off"
                @input="updateCode"
              />

              <fieldset>
                <legend>{{ messages.tagLabel }}</legend>
                <div class="outfit-tag-choices">
                  <button
                    v-for="tag in tags"
                    :key="tag"
                    type="button"
                    :class="{ active: selectedTag === tag }"
                    :aria-pressed="selectedTag === tag"
                    :disabled="busy"
                    @click="selectedTag = selectedTag === tag ? null : tag"
                  >
                    {{ tag }}
                  </button>
                </div>
                <p v-if="!tags.length">{{ messages.noTag }}</p>
              </fieldset>
              <p v-if="errorMessage" class="outfit-editor-error">{{ errorMessage }}</p>
            </div>
          </div>

          <footer>
            <button class="confirm-dialog-button ghost" type="button" :disabled="busy" @click="$emit('close')">{{ messages.cancel }}</button>
            <button class="confirm-dialog-button primary" type="button" :disabled="busy" @click="submit">
              {{ busy ? messages.saving : messages.confirm }}
            </button>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
