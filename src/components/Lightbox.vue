<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
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

  if (event.key === 'Delete' && !props.isDeleting) {
    event.preventDefault()
    emit('deleteCurrent')
  }
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="photo" class="lightbox" role="dialog" aria-modal="true" @click.self="$emit('close')">
      <button
        class="lightbox-nav lightbox-prev"
        type="button"
        :aria-label="messages.previousAria"
        :disabled="!hasPrevious"
        @click="$emit('previous')"
      >
        ‹
      </button>

      <div class="lightbox-panel">
        <button class="close-button" type="button" :aria-label="messages.closeAria" @click="$emit('close')">×</button>
        <img :src="photo.url" :alt="photo.name" />
        <div class="lightbox-footer">
          <div class="lightbox-caption">
            <strong>{{ dateMessages.displayDate(photo.dateKey) }} {{ photo.timeText }}</strong>
            <span>{{ photo.fileSizeText }}</span>
          </div>
          <button class="lightbox-delete" type="button" :disabled="isDeleting" @click="$emit('deleteCurrent')">
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
