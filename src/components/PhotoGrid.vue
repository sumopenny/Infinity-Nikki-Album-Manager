<script setup lang="ts">
import type { DateGroup, PhotoItem } from '../utils/dateGrouping'
import type { ThumbnailMode } from '../types/thumbnail'

const props = defineProps<{
  dateGroups: DateGroup[]
  selectedIds: Set<string>
  thumbnailMode: ThumbnailMode
}>()

defineEmits<{
  togglePhoto: [photoId: string]
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
      <h2>还没有照片</h2>
      <p>点击上方“选择/恢复相册路径”，读取命名为 2026_06_26_11_22_58_6316602.jpeg 这类格式的图片。</p>
      <p>推荐文件路径：\InfinityNikki Launcher\InfinityNikki\X6Game\Saved\GamePlayPhotos\你的id\NikkiPhotos_HighQuality</p>
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
          <p class="eyebrow">{{ group.photos.length }} photos</p>
          <h2>{{ group.displayDate }}</h2>
        </div>
        <label class="date-check">
          <input type="checkbox" :checked="isDateSelected(group)" @change="$emit('toggleDate', group.dateKey)" />
          <span>选择这一天</span>
        </label>
      </div>

      <div class="photo-grid">
        <article
          v-for="photo in group.photos"
          :key="photo.id"
          class="photo-card"
          :class="{ selected: selectedIds.has(photo.id) }"
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
            <strong>{{ photo.timeText }}</strong>
            <span :title="photo.fileSizeText">{{ photo.fileSizeText }}</span>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
