<script setup lang="ts">
import { ChevronLeft } from 'lucide-vue-next'
import { ref } from 'vue'
import type { LocaleMessages } from '../i18n'

export type AlbumView = 'all' | 'outfits' | 'home' | 'resonance' | 'favorites' | 'trash'

defineProps<{
  activeView: AlbumView
  allCount: number
  outfitsCount: number
  homeSchemesCount: number
  resonanceLabel?: string
  favoriteCount: number
  favoriteCountText?: string
  trashCount: number
  outfitLabel: string
  disabled: boolean
  messages: LocaleMessages['viewNav']
}>()

const resonanceMenuOpen = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | null = null

function openResonanceMenu() {
  if (closeTimer) clearTimeout(closeTimer)
  resonanceMenuOpen.value = true
}

function closeResonanceMenu() {
  closeTimer = setTimeout(() => { resonanceMenuOpen.value = false }, 120)
}

function toggleResonanceMenu() {
  resonanceMenuOpen.value = !resonanceMenuOpen.value
}

defineEmits<{
  changeView: [view: AlbumView]
}>()
</script>

<template>
  <nav class="album-view-nav" :aria-label="messages.aria">
    <div
      v-for="item in [
        { view: 'all' as const, label: messages.allPhotos, count: allCount },
        { view: 'outfits' as const, label: outfitLabel, count: outfitsCount },
        { view: 'home' as const, label: messages.homeSchemes, count: homeSchemesCount, countText: messages.homeSchemesCount(homeSchemesCount) },
        { view: 'resonance' as const, label: resonanceLabel ?? 'Resonance', count: 0, countText: '' },
        { view: 'favorites' as const, label: messages.favorites, count: favoriteCount, countText: favoriteCountText },
        { view: 'trash' as const, label: messages.recentlyDeleted, count: trashCount }
      ]"
      :key="item.view"
      class="album-view-item"
      @mouseenter="item.view === 'resonance' ? openResonanceMenu() : undefined"
      @mouseleave="item.view === 'resonance' ? closeResonanceMenu() : undefined"
    >
      <button
        class="album-view-button"
        :class="{ active: activeView === item.view }"
        type="button"
        :disabled="disabled"
        :aria-pressed="activeView === item.view"
        :aria-haspopup="item.view === 'resonance' ? 'menu' : undefined"
        :aria-expanded="item.view === 'resonance' ? resonanceMenuOpen : undefined"
        @click="item.view === 'resonance' ? toggleResonanceMenu() : $emit('changeView', item.view)"
      >
        <span>{{ item.label }}</span>
        <small v-if="item.view !== 'resonance'">{{ item.countText ?? messages.count(item.count) }}</small>
        <ChevronLeft v-else class="resonance-nav-arrow" :class="{ 'is-open': resonanceMenuOpen }" :size="14" aria-hidden="true" />
      </button>
      <div
        v-if="item.view === 'resonance' && resonanceMenuOpen && !disabled"
        class="resonance-nav-menu"
        role="menu"
        @mouseenter="openResonanceMenu"
        @mouseleave="closeResonanceMenu"
      >
        <button type="button" role="menuitem" :class="{ active: activeView === 'resonance' }" @click.stop="$emit('changeView', 'resonance')">共鸣记录</button>
        <button type="button" role="menuitem" disabled @click.stop>其余模块开发中</button>
      </div>
    </div>
  </nav>
</template>
