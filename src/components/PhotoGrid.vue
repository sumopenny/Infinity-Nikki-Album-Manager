<script setup lang="ts">
import type { LocaleMessages } from '../i18n'
import type { DateGroup, PhotoItem } from '../utils/dateGrouping'
import type { ThumbnailMode } from '../types/thumbnail'

const props = defineProps<{
  dateGroups: DateGroup[]
  selectedIds: Set<string>
  favoriteIds: Set<string>
  thumbnailMode: ThumbnailMode
  isFavoritesView: boolean
  messages: LocaleMessages['grid']
}>()

defineEmits<{
  togglePhoto: [photoId: string]
  toggleFavorite: [photoId: string]
  toggleDate: [dateKey: string]
  openPreview: [photo: PhotoItem]
}>()

function isDateSelected(group: DateGroup): boolean {
  return group.photos.length > 0 && group.photos.every((photo) => props.selectedIds.has(photo.id))
}
</script>

<template>
  <div class="photo-grid-wrap" :class="`mode-${thumbnailMode}`">
    <div v-if="!dateGroups.length" class="empty-album">
      <div class="empty-icon">♡</div>
      <h2>{{ isFavoritesView ? messages.emptyFavoritesTitle : messages.emptyTitle }}</h2>
      <p>{{ isFavoritesView ? messages.emptyFavoritesDescription : messages.emptyDescription }}</p>
      <p v-if="!isFavoritesView">{{ messages.recommendedPath }}</p>
    </div>

    <section
      v-for="(group, index) in dateGroups"
      :id="`date-${group.dateKey}`"
      :key="group.dateKey"
      class="date-block"
      :class="index % 2 === 0 ? 'block-white' : 'block-yellow'"
    >
      <div class="date-block-header">
        <div>
          <p class="eyebrow">{{ messages.photoCount(group.photos.length) }}</p>
          <h2>{{ group.displayDate }}</h2>
        </div>
        <label class="date-check">
          <input type="checkbox" :checked="isDateSelected(group)" @change="$emit('toggleDate', group.dateKey)" />
          <span>{{ messages.selectDay }}</span>
        </label>
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
            <img :src="photo.url" :alt="photo.name" loading="lazy" />
            <span class="selected-badge">✓</span>
          </div>
          <div class="photo-meta">
            <div class="photo-time">
              <button
                class="favorite-heart"
                type="button"
                :class="{ active: favoriteIds.has(photo.id) }"
                :aria-label="favoriteIds.has(photo.id) ? messages.removeFavorite : messages.addFavorite"
                :title="favoriteIds.has(photo.id) ? messages.removeFavorite : messages.addFavorite"
                @click.stop="$emit('toggleFavorite', photo.id)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#c98486"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  class="lucide lucide-heart"
                  aria-hidden="true"
                >
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                </svg>
              </button>
              <strong>{{ photo.timeText }}</strong>
            </div>
            <span :title="photo.fileSizeText">{{ photo.fileSizeText }}</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
