<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { LocaleMessages } from '../i18n'
import type { PhotoItem } from '../utils/dateGrouping'

const props = defineProps<{
  photo: PhotoItem | null
  hasPrevious: boolean
  hasNext: boolean
  isDeleting: boolean
  messages: LocaleMessages['lightbox']
  dateMessages: LocaleMessages['date']
}>()

const emit = defineEmits<{
  close: []
  previous: []
  next: []
  deleteCurrent: []
}>()

const displayedPhoto = ref<PhotoItem | null>(null)
const imageAspectRatio = ref<number | null>(null)
const viewportSize = ref({ width: 0, height: 0 })
let previewLoadToken = 0

const isPreviewLoading = computed(() => Boolean(props.photo && displayedPhoto.value?.id !== props.photo.id))

const imageOrientation = computed(() => {
  if (!imageAspectRatio.value) return 'pending'
  if (imageAspectRatio.value < 0.95) return 'portrait'
  if (imageAspectRatio.value > 1.05) return 'landscape'
  return 'square'
})

const lightboxPanelClass = computed(() => `lightbox-panel--${imageOrientation.value}`)

const lightboxPanelWidth = computed(() => {
  if (!imageAspectRatio.value || !viewportSize.value.width || !viewportSize.value.height) return null

  const viewportWidth = viewportSize.value.width
  const viewportHeight = viewportSize.value.height
  const availableWidth = Math.max(0, viewportWidth - getClampedValue(24, viewportWidth * 0.08, 64))
  const horizontalPadding = getClampedValue(10, viewportWidth * 0.02, 18) * 2
  const imageHeightOffset = getClampedValue(128, viewportHeight * 0.2, 180)
  const imageMaxHeight = Math.max(160, viewportHeight - imageHeightOffset)
  const preferredWidth = imageMaxHeight * imageAspectRatio.value + horizontalPadding
  const minWidth = Math.min(availableWidth, imageOrientation.value === 'portrait' ? 300 : 420)

  return Math.round(Math.min(Math.max(preferredWidth, minWidth), availableWidth, 1120))
})

const lightboxPanelStyle = computed(() =>
  lightboxPanelWidth.value ? { '--lightbox-panel-width': `${lightboxPanelWidth.value}px` } : undefined
)

function getClampedValue(min: number, preferred: number, max: number) {
  return Math.min(Math.max(preferred, min), max)
}

function updateViewportSize() {
  viewportSize.value = {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight
  }
}

function updateDisplayedPhoto(nextPhoto: PhotoItem) {
  const image = new Image()
  const currentToken = ++previewLoadToken

  image.onload = () => {
    if (currentToken !== previewLoadToken) return
    if (image.naturalWidth && image.naturalHeight) {
      imageAspectRatio.value = image.naturalWidth / image.naturalHeight
    }
    displayedPhoto.value = nextPhoto
  }

  image.onerror = () => {
    if (currentToken !== previewLoadToken) return
    displayedPhoto.value = nextPhoto
  }

  image.src = nextPhoto.url
}

watch(
  () => props.photo,
  (nextPhoto) => {
    updateViewportSize()

    if (!nextPhoto) {
      previewLoadToken += 1
      displayedPhoto.value = null
      imageAspectRatio.value = null
      return
    }

    updateDisplayedPhoto(nextPhoto)
  },
  { immediate: true }
)

function handleKeydown(event: KeyboardEvent) {
  if (!props.photo) return

  if (event.key === 'Escape') {
    emit('close')
  }

  if (event.key === 'ArrowLeft' && props.hasPrevious) {
    emit('previous')
  }

  if (event.key === 'ArrowRight' && props.hasNext) {
    emit('next')
  }

  if (event.key === 'Delete' && !props.isDeleting && !isPreviewLoading.value) {
    event.preventDefault()
    emit('deleteCurrent')
  }
}

onMounted(() => {
  updateViewportSize()
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', updateViewportSize)
  window.visualViewport?.addEventListener('resize', updateViewportSize)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', updateViewportSize)
  window.visualViewport?.removeEventListener('resize', updateViewportSize)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="displayedPhoto" class="lightbox" role="dialog" aria-modal="true" @click.self="$emit('close')">
      <button
        class="lightbox-nav lightbox-prev"
        type="button"
        :aria-label="messages.previousAria"
        :disabled="!hasPrevious"
        @click="$emit('previous')"
      >
        ‹
      </button>

      <div class="lightbox-panel" :class="lightboxPanelClass" :style="lightboxPanelStyle">
        <button class="close-button" type="button" :aria-label="messages.closeAria" @click="$emit('close')">×</button>
        <img :src="displayedPhoto.url" :alt="displayedPhoto.name" />
        <div class="lightbox-footer">
          <div class="lightbox-caption">
            <strong>{{ dateMessages.displayDate(displayedPhoto.dateKey) }} {{ displayedPhoto.timeText }}</strong>
            <span>{{ displayedPhoto.fileSizeText }}</span>
          </div>
          <button class="lightbox-delete" type="button" :disabled="isDeleting || isPreviewLoading" @click="$emit('deleteCurrent')">
            {{ isDeleting ? messages.deleting : messages.deleteCurrent }}
          </button>
        </div>
      </div>

      <button
        class="lightbox-nav lightbox-next"
        type="button"
        :aria-label="messages.nextAria"
        :disabled="!hasNext"
        @click="$emit('next')"
      >
        ›
      </button>
    </div>
  </Teleport>
</template>
