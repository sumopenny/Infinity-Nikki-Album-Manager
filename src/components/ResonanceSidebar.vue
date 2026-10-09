<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import type { Language } from '../i18n/types'
import { messages } from '../i18n'
import { sortResonanceRecords, type ResonanceBannerOrder, type ResonanceRarityFilter } from '../utils/resonance/resonanceCatalog'
import type { ResonanceLocalizedName, ResonanceRecord } from '../utils/resonance/resonanceTypes'

const props = withDefaults(defineProps<{
  records: ResonanceRecord[]
  language: Language
  bannerOrder?: ResonanceBannerOrder
  rarityFilter?: ResonanceRarityFilter
}>(), { bannerOrder: 'newest', rarityFilter: 'all' })

const emit = defineEmits<{
  jumpToRecord: [recordId: string]
  changeBannerOrder: [order: ResonanceBannerOrder]
  changeRarityFilter: [rarity: ResonanceRarityFilter]
}>()

const sortMenuOpen = ref(false)
const sortMenuWrapRef = ref<HTMLDivElement | null>(null)
const sortButtonRef = ref<HTMLButtonElement | null>(null)
const sortedRecords = computed(() => sortResonanceRecords(props.records, props.bannerOrder, props.rarityFilter))
const t = computed(() => messages[props.language].resonance)
const selectedOptionLabel = computed(() => {
  const order = props.bannerOrder === 'newest' ? t.value.newestFirst : t.value.oldestFirst
  return props.rarityFilter === 'all' ? order : `${t.value.rarity(props.rarityFilter)} · ${order}`
})

function selectBannerOrder(order: ResonanceBannerOrder) {
  sortMenuOpen.value = false
  sortButtonRef.value?.focus()
  if (order !== props.bannerOrder) emit('changeBannerOrder', order)
}

function selectRarityFilter(rarity: ResonanceRarityFilter) {
  sortMenuOpen.value = false
  sortButtonRef.value?.focus()
  if (rarity !== props.rarityFilter) emit('changeRarityFilter', rarity)
}

function handleSortKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !sortMenuOpen.value) return
  event.stopPropagation()
  sortMenuOpen.value = false
  sortButtonRef.value?.focus()
}

function handleDocumentClick(event: MouseEvent) {
  if (sortMenuOpen.value && !sortMenuWrapRef.value?.contains(event.target as Node)) sortMenuOpen.value = false
}

onMounted(() => document.addEventListener('click', handleDocumentClick))
onBeforeUnmount(() => document.removeEventListener('click', handleDocumentClick))

function displayName(value: ResonanceLocalizedName): string {
  return value[props.language] || value.zh || value.en
}

function hideBrokenImage(event: Event) {
  (event.target as HTMLImageElement).hidden = true
}
</script>

<template>
  <aside v-if="records.length" class="date-sidebar resonance-sidebar" :aria-label="t.title">
    <div class="sidebar-section-title">{{ t.title }}</div>
    <div ref="sortMenuWrapRef" class="action-sort-select-wrap resonance-sort-control" @keydown="handleSortKeydown">
      <button
        ref="sortButtonRef"
        type="button"
        class="cleanup-account-select action-sort-select"
        :class="{ open: sortMenuOpen }"
        aria-haspopup="menu"
        :aria-label="`${t.displayOptions}: ${selectedOptionLabel}`"
        :aria-expanded="sortMenuOpen"
        @click="sortMenuOpen = !sortMenuOpen"
      >
        <span>{{ selectedOptionLabel }}</span>
        <ChevronDown :size="14" aria-hidden="true" />
      </button>
      <div v-if="sortMenuOpen" class="cleanup-account-menu action-sort-menu resonance-options-menu" role="menu" :aria-label="t.displayOptions">
        <div role="group" :aria-label="t.bannerOrder">
          <div class="resonance-options-label">{{ t.bannerOrder }}</div>
          <button
            v-for="order in (['newest', 'oldest'] as ResonanceBannerOrder[])"
            :key="order"
            type="button"
            role="menuitemradio"
            :aria-checked="bannerOrder === order"
            :class="{ active: bannerOrder === order }"
            @click="selectBannerOrder(order)"
          >{{ order === 'newest' ? t.newestFirst : t.oldestFirst }}</button>
        </div>
        <div class="resonance-options-divider" role="separator"></div>
        <div role="group" :aria-label="t.rarityFilter">
          <div class="resonance-options-label">{{ t.rarityFilter }}</div>
          <button
            v-for="rarity in (['all', 5, 4] as ResonanceRarityFilter[])"
            :key="rarity"
            type="button"
            role="menuitemradio"
            :aria-checked="rarityFilter === rarity"
            :class="{ active: rarityFilter === rarity }"
            @click="selectRarityFilter(rarity)"
          >{{ rarity === 'all' ? t.allRarities : rarity === 5 ? t.onlyFiveStar : t.onlyFourStar }}</button>
        </div>
      </div>
    </div>
    <p v-if="!sortedRecords.length" class="resonance-filter-empty">{{ t.noMatchingRarity }}</p>
    <button
      v-for="record in sortedRecords"
      :key="record.id"
      class="resonance-sidebar-link"
      type="button"
      @click="emit('jumpToRecord', record.id)"
    >
      <span class="resonance-sidebar-thumbnail">
        <img :src="record.outfitImageUrl" alt="" referrerpolicy="no-referrer" @error="hideBrokenImage" />
      </span>
      <span class="resonance-sidebar-name">{{ displayName(record.outfitName) }} · {{ t.rarity(record.rarity) }}</span>
    </button>
  </aside>
</template>
