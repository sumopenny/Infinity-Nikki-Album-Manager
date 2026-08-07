<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { ImagePlus, Plus, Upload, X } from 'lucide-vue-next'
import type { OutfitMessages } from '../outfitMessages'
import {
  MAX_OUTFIT_CODE_LENGTH,
  MAX_OUTFIT_TAG_LENGTH,
  MAX_OUTFIT_TAGS,
  normalizeOutfitCode,
  type OutfitItem
} from '../utils/outfitFileSystem'

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
  addTag: [tag: string]
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
const isAddingTag = ref(false)
const tagInput = ref('')
const addTagToggleRef = ref<HTMLButtonElement | null>(null)
const tagEditorRef = ref<HTMLFormElement | null>(null)
const tagInputRef = ref<HTMLInputElement | null>(null)
const tagEditorPosition = ref({ top: '0px', left: '0px' })
const editorOverlayRef = ref<HTMLElement | null>(null)
let previousBodyOverflow = ''
let isBodyScrollLockedByEditor = false
let previousActiveElement: HTMLElement | null = null
let previewRequestId = 0

const hasImage = computed(() => Boolean(imageFile.value || props.outfit))

function revokePreview() {
  previewRequestId += 1
  if (previewUrl.value?.startsWith('blob:')) URL.revokeObjectURL(previewUrl.value)
  previewUrl.value = null
}

async function resetForm() {
  revokePreview()
  const requestId = previewRequestId
  const outfit = props.outfit
  imageFile.value = undefined
  code.value = outfit?.code ?? ''
  selectedTag.value = outfit?.tags[0] ?? null
  errorMessage.value = ''
  isDragging.value = false
  if (outfit) {
    try {
      const file = await outfit.fileHandle.getFile()
      if (requestId !== previewRequestId || !props.visible || props.outfit !== outfit) return
      previewUrl.value = URL.createObjectURL(file)
    } catch {
      if (requestId !== previewRequestId || !props.visible || props.outfit !== outfit) return
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
  if (props.visible && !props.busy && event.key === 'Escape') {
    if (isAddingTag.value) closeTagInput()
    else emit('close')
  }
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

function updateTagEditorPosition() {
  const toggle = addTagToggleRef.value
  if (!toggle) return
  const rect = toggle.getBoundingClientRect()
  const width = Math.min(260, window.innerWidth - 24)
  tagEditorPosition.value = {
    top: `${Math.max(12, Math.min(rect.top, window.innerHeight - 64))}px`,
    left: `${Math.max(12, Math.min(rect.right + 8, window.innerWidth - width - 12))}px`
  }
}

function openTagInput() {
  isAddingTag.value = true
  void nextTick(() => {
    updateTagEditorPosition()
    tagInputRef.value?.focus()
  })
}

function closeTagInput() {
  isAddingTag.value = false
  tagInput.value = ''
}

function submitTag() {
  emit('addTag', tagInput.value)
}

function selectCreatedTag(tag: string) {
  selectedTag.value = tag
  closeTagInput()
}

function handleDocumentPointerDown(event: PointerEvent) {
  if (!isAddingTag.value || !(event.target instanceof Node)) return
  if (event.target === editorOverlayRef.value) return
  if (addTagToggleRef.value?.contains(event.target) || tagEditorRef.value?.contains(event.target)) return
  closeTagInput()
}

function handleEditorBackdropClick() {
  if (isAddingTag.value) closeTagInput()
  else emit('close')
}

defineExpose({ selectCreatedTag })

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
    closeTagInput()
    document.body.style.overflow = previousBodyOverflow
    isBodyScrollLockedByEditor = false
    revokePreview()
    previousActiveElement?.focus()
    previousActiveElement = null
  }
})

window.addEventListener('paste', handlePaste)
window.addEventListener('keydown', handleKeydown)
document.addEventListener('pointerdown', handleDocumentPointerDown)
window.addEventListener('resize', updateTagEditorPosition)
window.addEventListener('scroll', updateTagEditorPosition, true)
onBeforeUnmount(() => {
  window.removeEventListener('paste', handlePaste)
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', updateTagEditorPosition)
  window.removeEventListener('scroll', updateTagEditorPosition, true)
  if (isBodyScrollLockedByEditor) document.body.style.overflow = previousBodyOverflow
  revokePreview()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div ref="editorOverlayRef" v-if="visible" class="outfit-editor" role="dialog" aria-modal="true" :aria-label="messages.editTitle" @click.self="handleEditorBackdropClick">
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
                  <button
                    ref="addTagToggleRef"
                    class="outfit-editor-add-tag"
                    type="button"
                    :title="messages.addTag"
                    :aria-label="messages.addTag"
                    :disabled="busy || tags.length >= MAX_OUTFIT_TAGS"
                    @click="isAddingTag ? closeTagInput() : openTagInput()"
                  >
                    <X v-if="isAddingTag" :size="15" aria-hidden="true" />
                    <Plus v-else :size="15" aria-hidden="true" />
                  </button>
                </div>
                <p v-if="!tags.length">{{ messages.noTag }}</p>
                <Teleport to="body">
                  <Transition name="outfit-tag-editor">
                    <form
                      v-if="isAddingTag"
                      ref="tagEditorRef"
                      class="outfit-tag-editor outfit-tag-editor-popover"
                      :style="tagEditorPosition"
                      @submit.prevent="submitTag"
                    >
                      <input
                        ref="tagInputRef"
                        v-model="tagInput"
                        :maxlength="MAX_OUTFIT_TAG_LENGTH"
                        :placeholder="messages.tagPlaceholder"
                        :disabled="busy"
                        autocomplete="off"
                      />
                      <button type="submit" :disabled="busy">{{ messages.confirmAddTag }}</button>
                    </form>
                  </Transition>
                </Teleport>
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
