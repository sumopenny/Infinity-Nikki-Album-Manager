<script setup lang="ts">
import type { Language, LocaleMessages } from '../i18n'
import type { ThumbnailMode } from '../types/thumbnail'

defineProps<{
  directoryName: string
  totalCount: number
  selectedCount: number
  allSelected: boolean
  isLoading: boolean
  isDeleting: boolean
  thumbnailMode: ThumbnailMode
  thumbnailModeOptions: Array<{ value: ThumbnailMode; label: string }>
  language: Language
  messages: LocaleMessages['topBar']
}>()

defineEmits<{
  chooseDirectory: []
  clearDirectory: []
  toggleAll: []
  deleteSelected: []
  toggleLanguage: []
  changeThumbnailMode: [mode: ThumbnailMode]
}>()

function handleThumbnailModeChange(event: Event) {
  const target = event.target as HTMLSelectElement
  const value = target.value as ThumbnailMode
  ;(event.currentTarget as HTMLSelectElement).blur()
  return value
}
</script>

<template>
  <header class="top-module">
    <div class="brand-row">
      <div>
        <p class="site-kicker">Infinity Nikki Album</p>
        <h1>{{ messages.title }}</h1>
      </div>
      <div class="brand-actions">
        <span class="star-hint">{{ messages.starHint }}</span>
        <a
          class="github-link"
          href="https://github.com/sumopenny/Infinity-Nikki-Album-Manager"
          target="_blank"
          rel="noreferrer"
          :aria-label="messages.githubAria"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 2C6.48 2 2 6.59 2 12.25c0 4.52 2.87 8.35 6.84 9.71.5.09.68-.22.68-.49 0-.24-.01-1.05-.01-1.9-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.63.07-.63 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.36 1.12 2.93.86.09-.66.35-1.12.64-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.33 9.33 0 0 1 12 6.98c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.08 10.08 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z"
            />
          </svg>
          <span>{{ messages.githubText }}</span>
        </a>
        <button class="language-button" type="button" :aria-label="messages.languageAria" @click="$emit('toggleLanguage')">
          {{ messages.languageButton }}
        </button>
        <span class="signature">by 素茉penny</span>
      </div>
    </div>

    <div class="control-row">
      <div class="path-row">
        <button class="primary-button" type="button" :disabled="isLoading" @click="$emit('chooseDirectory')">
          {{ isLoading ? messages.loading : messages.chooseDirectory }}
        </button>
        <button class="soft-button" type="button" :disabled="isLoading" @click="$emit('clearDirectory')">
          {{ messages.clearDirectory }}
        </button>
        <div class="path-pill" :title="directoryName">{{ directoryName }}</div>
      </div>

      <div class="action-row">
        <label class="thumbnail-select-wrap">
          <span>{{ messages.thumbnail }}</span>
          <select
            class="thumbnail-select"
            :value="thumbnailMode"
            @change="$emit('changeThumbnailMode', handleThumbnailModeChange($event))"
          >
            <option v-for="option in thumbnailModeOptions" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
        <button class="danger-button" type="button" :disabled="!selectedCount || isDeleting" @click="$emit('deleteSelected')">
          {{ isDeleting ? messages.deleting : messages.deleteSelected(selectedCount) }}
        </button>
        <button class="soft-button" type="button" :disabled="!totalCount" @click="$emit('toggleAll')">
          {{ allSelected ? messages.cancelSelectAll : messages.selectAll }}
        </button>
        <span class="counter">{{ selectedCount }} / {{ totalCount }}</span>
      </div>
    </div>
  </header>
</template>
