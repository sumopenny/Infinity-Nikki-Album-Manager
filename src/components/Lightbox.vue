<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { PhotoItem } from '../utils/dateGrouping'

const props = defineProps<{
  photo: PhotoItem | null
  hasPrevious: boolean
  hasNext: boolean
  isDeleting: boolean
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
        aria-label="查看上一张图片"
        :disabled="!hasPrevious"
        @click="$emit('previous')"
      >
        ‹
      </button>

      <div class="lightbox-panel">
        <button class="close-button" type="button" aria-label="关闭预览" @click="$emit('close')">×</button>
        <img :src="photo.url" :alt="photo.name" />
        <div class="lightbox-footer">
          <div class="lightbox-caption">
            <strong>{{ photo.displayDate }} {{ photo.timeText }}</strong>
            <span>{{ photo.fileSizeText }}</span>
          </div>
          <button class="lightbox-delete" type="button" :disabled="isDeleting" @click="$emit('deleteCurrent')">
            {{ isDeleting ? '删除中...' : '删除此图片' }}
          </button>
        </div>
      </div>

      <button
        class="lightbox-nav lightbox-next"
        type="button"
        aria-label="查看下一张图片"
        :disabled="!hasNext"
        @click="$emit('next')"
      >
        ›
      </button>
    </div>
  </Teleport>
</template>
