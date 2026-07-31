<script setup lang="ts">
import { onBeforeUnmount } from 'vue'
import { Check, Copy, Edit3, Shirt, Trash2 } from 'lucide-vue-next'
import type { OutfitMessages } from '../outfitMessages'
import type { ThumbnailMode } from '../types/thumbnail'
import type { OutfitItem } from '../utils/outfitFileSystem'
import { createPhotoLoadQueue } from '../utils/photoLoader'
import LazyPhotoImage from './LazyPhotoImage.vue'

defineProps<{
  outfits: OutfitItem[]
  selectedIds: Set<string>
  thumbnailMode: ThumbnailMode
  messages: OutfitMessages
  disabled: boolean
}>()

defineEmits<{
  copy: [outfit: OutfitItem]
  edit: [outfit: OutfitItem]
  delete: [outfit: OutfitItem]
  openPreview: [outfit: OutfitItem]
  toggleOutfit: [outfitId: string]
}>()

const photoLoadQueue = createPhotoLoadQueue(3)
onBeforeUnmount(() => photoLoadQueue.cancel())
</script>

<template>
  <div class="photo-grid-wrap outfit-grid-wrap" :class="`mode-${thumbnailMode}`">
    <div v-if="!outfits.length" class="empty-album inline-empty">
      <Shirt :size="30" aria-hidden="true" />
      <h2>{{ messages.emptyTitle }}</h2>
      <p>{{ messages.emptyDescription }}</p>
    </div>

    <div v-else class="photo-grid outfit-grid">
      <article
        v-for="outfit in outfits"
        :key="outfit.id"
        class="photo-card outfit-card"
        :class="{ selected: selectedIds.has(outfit.id) }"
        :aria-label="outfit.code || messages.pending"
        tabindex="0"
        @click="$emit('toggleOutfit', outfit.id)"
        @dblclick.stop="$emit('openPreview', outfit)"
        @keydown.enter="$emit('toggleOutfit', outfit.id)"
      >
        <div class="photo-frame">
          <LazyPhotoImage :photo="outfit" :load-photo="photoLoadQueue.load" :failure-text="messages.imageLoadFailed" />
          <div class="photo-overlay outfit-overlay">
            <span>{{ outfit.tags[0] || messages.uncategorized }}</span>
          </div>
          <span class="selected-badge"><Check :size="15" aria-hidden="true" /></span>
          <button
            class="outfit-card-delete"
            type="button"
            :title="messages.delete"
            :aria-label="messages.delete"
            :disabled="disabled"
            @click.stop="$emit('delete', outfit)"
          >
            <Trash2 :size="16" aria-hidden="true" />
          </button>
        </div>

        <div class="outfit-card-footer">
          <button
            v-if="!outfit.code"
            class="outfit-pending-code"
            type="button"
            :disabled="disabled"
            @click.stop="$emit('edit', outfit)"
          >
            {{ messages.pending }}
          </button>
          <span v-else class="outfit-code" :title="outfit.code">{{ outfit.code }}</span>
          <div class="outfit-card-actions">
            <button
              type="button"
              :title="messages.copy"
              :aria-label="messages.copy"
              :disabled="disabled || !outfit.code"
              @click.stop="$emit('copy', outfit)"
            >
              <Copy :size="15" aria-hidden="true" />
            </button>
            <button type="button" :title="messages.edit" :aria-label="messages.edit" :disabled="disabled" @click.stop="$emit('edit', outfit)">
              <Edit3 :size="15" aria-hidden="true" />
            </button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
