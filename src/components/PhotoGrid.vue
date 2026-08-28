<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { Check, Edit3, Heart } from 'lucide-vue-next'
import type { LocaleMessages } from '../i18n'
import type { ThumbnailMode } from '../types/thumbnail'
import type { DateGroup, PhotoItem } from '../utils/photoGrouping'
import { createPhotoLoadQueue } from '../utils/photoLoader'
import LazyPhotoImage from './LazyPhotoImage.vue'

const props = defineProps<{
  dateGroups: DateGroup[]
  selectedIds: Set<string>
  favoriteIds: Set<string>
  thumbnailMode: ThumbnailMode
  isFavoritesView: boolean
  messages: LocaleMessages['grid']
}>()

const emit = defineEmits<{
  togglePhoto: [photoId: string]
  toggleFavorite: [photoId: string]
  toggleDate: [dateKey: string]
  openPreview: [photo: PhotoItem]
  editNote: [photo: PhotoItem]
}>()

const photoLoadQueue = createPhotoLoadQueue(3)

/** 判断某个日期组是否已完整选中。参数：group 为日期分组。 */
function isDateSelected(group: DateGroup): boolean {
  return group.photos.length > 0 && group.photos.every((photo) => props.selectedIds.has(photo.id))
}

/** 返回卡片悬浮信息；半尺寸模式和未知元数据只显示时间。参数：photo 为照片。 */
function getPhotoMeta(photo: PhotoItem): string {
  return props.thumbnailMode !== 'half' && photo.fileSizeText && photo.fileSizeText !== '--'
    ? `${photo.timeText} · ${photo.fileSizeText}`
    : photo.timeText
}

/** 切换收藏后释放按钮焦点，避免取消收藏后因焦点状态持续显示。参数：photoId 为照片 ID，event 为点击事件。 */
function handleFavoriteClick(photoId: string, event: MouseEvent) {
  emit('toggleFavorite', photoId)
  ;(event.currentTarget as HTMLButtonElement).blur()
}

onBeforeUnmount(() => photoLoadQueue.cancel())
</script>

<template>
  <div class="photo-grid-wrap" :class="`mode-${thumbnailMode}`">
    <div v-if="!dateGroups.length" class="empty-album inline-empty">
      <Heart :size="30" aria-hidden="true" />
      <h2>{{ isFavoritesView ? messages.emptyFavoritesTitle : messages.emptyTitle }}</h2>
      <p>{{ isFavoritesView ? messages.emptyFavoritesDescription : messages.emptyDescription }}</p>
    </div>

    <section v-for="group in dateGroups" :id="`date-${group.dateKey}`" :key="group.dateKey" class="date-block">
      <div class="date-block-header">
        <h2>{{ group.displayDate }} · {{ messages.photoCount(group.photos.length) }}</h2>
        <button
          class="date-select-button"
          type="button"
          :class="{ active: isDateSelected(group) }"
          :aria-pressed="isDateSelected(group)"
          :title="messages.selectDay"
          :aria-label="messages.selectDay"
          @click="$emit('toggleDate', group.dateKey)"
        >
          <Check :size="16" aria-hidden="true" />
        </button>
      </div>

      <div class="photo-grid">
        <article
          v-for="photo in group.photos"
          :key="photo.id"
          class="photo-card"
          :class="{ selected: selectedIds.has(photo.id), favorited: favoriteIds.has(photo.id) }"
          tabindex="0"
          @click="$emit('togglePhoto', photo.id)"
          @dblclick.stop="$emit('openPreview', photo)"
          @keydown.enter="$emit('togglePhoto', photo.id)"
        >
          <div class="photo-frame">
            <LazyPhotoImage :photo="photo" :load-photo="photoLoadQueue.load" :failure-text="messages.imageLoadFailed" />
            <div class="photo-overlay">
              <span>{{ getPhotoMeta(photo) }}</span>
            </div>
            <span class="selected-badge"><Check :size="15" aria-hidden="true" /></span>
            <button
              class="favorite-heart"
              type="button"
              :class="{ active: favoriteIds.has(photo.id) }"
              :aria-label="favoriteIds.has(photo.id) ? messages.removeFavorite : messages.addFavorite"
              :title="favoriteIds.has(photo.id) ? messages.removeFavorite : messages.addFavorite"
              @click.stop="handleFavoriteClick(photo.id, $event)"
            >
              <Heart :size="17" :fill="favoriteIds.has(photo.id) ? 'currentColor' : 'none'" aria-hidden="true" />
            </button>
            <button class="photo-note-edit" type="button" :title="messages.editNote" :aria-label="messages.editNote" @click.stop="emit('editNote', photo)"><Edit3 :size="16" /></button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
