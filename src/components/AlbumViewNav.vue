<script setup lang="ts">
import type { LocaleMessages } from '../i18n'

export type AlbumView = 'all' | 'favorites' | 'trash'

defineProps<{
  activeView: AlbumView
  allCount: number
  favoriteCount: number
  trashCount: number
  disabled: boolean
  messages: LocaleMessages['viewNav']
}>()

defineEmits<{
  changeView: [view: AlbumView]
}>()
</script>

<template>
  <nav class="album-view-nav" :aria-label="messages.aria">
    <button
      v-for="item in [
        { view: 'all' as const, label: messages.allPhotos, count: allCount },
        { view: 'favorites' as const, label: messages.favorites, count: favoriteCount },
        { view: 'trash' as const, label: messages.recentlyDeleted, count: trashCount }
      ]"
      :key="item.view"
      class="album-view-button"
      :class="{ active: activeView === item.view }"
      type="button"
      :disabled="disabled"
      :aria-pressed="activeView === item.view"
      @click="$emit('changeView', item.view)"
    >
      <span>{{ item.label }}</span>
      <small>{{ messages.count(item.count) }}</small>
    </button>
  </nav>
</template>
