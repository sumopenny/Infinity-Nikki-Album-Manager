<script setup lang="ts">
import { computed } from 'vue'
import { SlidersHorizontal, X } from 'lucide-vue-next'
const props = defineProps<{ entries: { key: string; label: string }[]; active: string; count: number; language: 'zh' | 'en'; disabled?: boolean }>()
defineEmits<{ change: [key: string]; open: []; clear: [] }>()
// 长标签表只呈现常用项和当前项，完整列表留在筛选面板。
const entries = computed(() => {
  const first = props.entries.slice(0, 4)
  const current = props.entries.find(entry => entry.key === props.active)
  return current && !first.includes(current) ? [...first.slice(0, 3), current] : first
})
</script>

<template>
  <div class="collection-filter-bar mobile-only">
    <div class="collection-filter-chips" role="group" :aria-label="language === 'zh' ? '快捷分类' : 'Quick filters'">
      <button v-for="entry in entries" :key="entry.key" type="button" :disabled="disabled" :aria-pressed="active === entry.key" @click="$emit('change', entry.key)">{{ entry.label }}</button>
    </div>
    <button class="collection-filter-open" type="button" :disabled="disabled" @click="$emit('open')"><SlidersHorizontal :size="17" />{{ language === 'zh' ? '筛选' : 'Filter' }}</button>
    <div class="collection-filter-summary"><span>{{ language === 'zh' ? `${count} 项` : `${count} items` }}</span><button v-if="active !== entries[0]?.key" type="button" :disabled="disabled" @click="$emit('clear')"><X :size="14" />{{ language === 'zh' ? '清除筛选' : 'Clear filter' }}</button></div>
  </div>
</template>
