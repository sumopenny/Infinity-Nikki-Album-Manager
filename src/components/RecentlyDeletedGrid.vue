<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import type { Language, LocaleMessages } from '../i18n'
import type { ThumbnailMode } from '../types/thumbnail'
import type { RecentlyDeletedPhoto } from '../utils/dateGrouping'
import { createPhotoLoadQueue } from '../utils/photoLoader'
import LazyPhotoImage from './LazyPhotoImage.vue'

const props = defineProps<{
  photos: RecentlyDeletedPhoto[]
  selectedIds: Set<string>
  allSelected: boolean
  totalSizeText: string
  thumbnailMode: ThumbnailMode
  isBusy: boolean
  language: Language
  messages: LocaleMessages['trash']
}>()

defineEmits<{
  togglePhoto: [photoId: string]
  toggleAll: []
  restoreSelected: []
  permanentlyDeleteSelected: []
  clearAll: []
  openPreview: [photo: RecentlyDeletedPhoto]
}>()

const photoLoadQueue = createPhotoLoadQueue(3)

/**
 * 按当前语言格式化照片删除时间。
 * 参数：deletedAt 为删除时间戳。
 * 返回：适合卡片展示的日期和时间。
 */
function formatDeletedAt(deletedAt: number): string {
  return new Intl.DateTimeFormat(props.language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(deletedAt))
}

onBeforeUnmount(() => {
  photoLoadQueue.cancel()
})
</script>

<template>
  <div class="trash-grid-wrap" :class="`mode-${thumbnailMode}`">
    <header class="trash-summary-bar">
      <div>
        <p class="eyebrow">Trash</p>
        <h2>{{ messages.title }}</h2>
        <p>{{ messages.totalSummary(photos.length, totalSizeText) }}</p>
      </div>
      <div class="trash-summary-actions">
        <button class="soft-button" type="button" :disabled="!photos.length || isBusy" @click="$emit('toggleAll')">
          {{ allSelected ? messages.deselectAll : messages.selectAll }}
        </button>
        <button class="restore-button" type="button" :disabled="!selectedIds.size || isBusy" @click="$emit('restoreSelected')">
          {{ messages.restoreSelected(selectedIds.size) }}
        </button>
        <button
          class="danger-button"
          type="button"
          :disabled="!selectedIds.size || isBusy"
          @click="$emit('permanentlyDeleteSelected')"
        >
          {{ messages.permanentlyDeleteSelected(selectedIds.size) }}
        </button>
        <button class="danger-button" type="button" :disabled="!photos.length || isBusy" @click="$emit('clearAll')">
          {{ messages.clearAll }}
        </button>
      </div>
    </header>

    <div v-if="!photos.length" class="empty-album">
      <div class="empty-icon">↺</div>
      <h2>{{ messages.emptyTitle }}</h2>
      <p>{{ messages.emptyDescription }}</p>
    </div>

    <div v-else class="photo-grid trash-photo-grid">
      <article
        v-for="photo in photos"
        :key="photo.id"
        class="photo-card trash-photo-card"
        :class="{ selected: selectedIds.has(photo.id) }"
        tabindex="0"
        @click="$emit('togglePhoto', photo.id)"
        @dblclick.stop="$emit('openPreview', photo)"
        @keydown.enter="$emit('togglePhoto', photo.id)"
      >
        <div class="photo-frame">
          <LazyPhotoImage :photo="photo" :load-photo="photoLoadQueue.load" :failure-text="messages.imageLoadFailed" />
          <span class="selected-badge">✓</span>
        </div>
        <div class="trash-photo-meta">
          <span>{{ messages.deletedAt(formatDeletedAt(photo.deletedAt)) }}</span>
        </div>
      </article>
    </div>
  </div>
</template>
