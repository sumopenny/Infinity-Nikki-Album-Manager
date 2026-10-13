<script setup lang="ts">
import { computed } from 'vue'
import { ChevronDown, SlidersHorizontal, X } from 'lucide-vue-next'
const props = defineProps<{ entries: { key: string; label: string }[]; active: string; count: number; language: 'zh' | 'en'; disabled?: boolean; tagPicker?: boolean; actionsId?: string; allLabel?: string; selectLabel?: string }>()
defineEmits<{ change: [key: string]; open: []; clear: [] }>()
// 长标签表只呈现常用项和当前项，完整列表留在筛选面板。
const entries = computed(() => {
  const first = props.entries.slice(0, 4)
  const current = props.entries.find(entry => entry.key === props.active)
  return current && !first.includes(current) ? [...first.slice(0, 3), current] : first
})
const isFiltered = computed(() => props.active !== props.entries[0]?.key)
const activeLabel = computed(() => isFiltered.value
  ? props.entries.find(entry => entry.key === props.active)?.label ?? props.active
  : props.allLabel ?? (props.language === 'zh' ? '全部标签' : 'All tags'))
</script>

<template>
  <div class="collection-filter-bar mobile-only" :class="{ 'tag-picker-bar': tagPicker }">
    <template v-if="tagPicker">
      <button class="collection-tag-select" :class="{ 'is-filtered': isFiltered }" type="button" :disabled="disabled" :title="activeLabel" aria-haspopup="dialog" :aria-label="(selectLabel ?? (language === 'zh' ? '选择标签：' : 'Select tag: ')) + activeLabel" @click="$emit('open')"><span>{{ activeLabel }}</span><ChevronDown :size="16" aria-hidden="true" /></button>
      <button v-if="isFiltered" class="collection-tag-clear" type="button" :disabled="disabled" :aria-label="language === 'zh' ? '清除筛选' : 'Clear filter'" @click="$emit('clear')"><X :size="16" aria-hidden="true" /></button>
      <span class="collection-tag-count">{{ language === 'zh' ? `${count} 项` : `${count} items` }}</span>
      <div v-if="actionsId" :id="actionsId" class="collection-filter-actions"></div>
    </template>
    <template v-else>
    <div class="collection-filter-chips" role="group" :aria-label="language === 'zh' ? '快捷分类' : 'Quick filters'">
      <button v-for="entry in entries" :key="entry.key" type="button" :disabled="disabled" :aria-pressed="active === entry.key" @click="$emit('change', entry.key)">{{ entry.label }}</button>
    </div>
    <button class="collection-filter-open" type="button" :disabled="disabled" @click="$emit('open')"><SlidersHorizontal :size="17" />{{ language === 'zh' ? '筛选' : 'Filter' }}</button>
    <div class="collection-filter-summary"><span>{{ language === 'zh' ? `${count} 项` : `${count} items` }}</span><button v-if="active !== entries[0]?.key" type="button" :disabled="disabled" @click="$emit('clear')"><X :size="14" />{{ language === 'zh' ? '清除筛选' : 'Clear filter' }}</button></div>
    </template>
  </div>
</template>
