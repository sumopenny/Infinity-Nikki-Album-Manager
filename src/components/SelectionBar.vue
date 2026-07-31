<script setup lang="ts">
import { Heart, HeartOff, RotateCcw, Trash2, X } from 'lucide-vue-next'
import type { LocaleMessages } from '../i18n'

export type SelectionBarMode = 'album' | 'favorites' | 'trash' | 'outfit'

defineProps<{
  mode: SelectionBarMode
  selectedCount: number
  allSelected: boolean
  allItemsSelected: boolean
  isBusy: boolean
  messages: LocaleMessages['selectionBar']
}>()

defineEmits<{
  toggleAll: []
  favorite: []
  unfavorite: []
  delete: []
  restore: []
  cancel: []
}>()
</script>

<template>
  <Transition name="selection-bar">
    <div v-if="selectedCount" class="selection-bar" role="toolbar" :aria-label="messages.selected(selectedCount)">
      <strong>{{ messages.selected(selectedCount) }}</strong>
      <span class="selection-divider"></span>
      <button type="button" :disabled="isBusy" @click="$emit('toggleAll')">
        {{ allSelected ? messages.deselectAll : messages.selectAll }}
      </button>
      <template v-if="mode === 'album' || mode === 'favorites'">
        <button v-if="mode === 'album'" type="button" :disabled="isBusy" @click="$emit('favorite')">
          <Heart :size="16" aria-hidden="true" />
          <span>{{ messages.favorite }}</span>
        </button>
        <button v-else type="button" :disabled="isBusy" @click="$emit('unfavorite')">
          <HeartOff :size="16" aria-hidden="true" />
          <span>{{ messages.unfavorite }}</span>
        </button>
        <button class="selection-danger" type="button" :disabled="isBusy" @click="$emit('delete')">
          <Trash2 :size="16" aria-hidden="true" />
          <span>{{ messages.delete }}</span>
        </button>
      </template>
      <template v-else-if="mode === 'trash'">
        <button type="button" :disabled="isBusy" @click="$emit('restore')">
          <RotateCcw :size="16" aria-hidden="true" />
          <span>{{ messages.restore }}</span>
        </button>
        <button class="selection-danger" type="button" :disabled="isBusy" @click="$emit('delete')">
          <Trash2 :size="16" aria-hidden="true" />
          <span>{{ allItemsSelected ? messages.clearAll : messages.permanentlyDelete }}</span>
        </button>
      </template>
      <button v-else class="selection-danger" type="button" :disabled="isBusy" @click="$emit('delete')">
        <Trash2 :size="16" aria-hidden="true" />
        <span>{{ messages.permanentlyDelete }}</span>
      </button>
      <button class="selection-close" type="button" :title="messages.cancel" :aria-label="messages.cancel" :disabled="isBusy" @click="$emit('cancel')">
        <X :size="18" aria-hidden="true" />
      </button>
    </div>
  </Transition>
</template>
