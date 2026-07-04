<script setup lang="ts">
import type { YearGroup } from '../utils/dateGrouping'

defineProps<{
  yearGroups: YearGroup[]
}>()

defineEmits<{
  jumpToDate: [dateKey: string]
}>()
</script>

<template>
  <aside class="date-sidebar" aria-label="日期侧边栏">
    <div class="sidebar-title">拍摄日期</div>

    <div v-if="!yearGroups.length" class="empty-sidebar">
      选择相册后，这里会按年份和日期展开。
    </div>

    <section v-for="yearGroup in yearGroups" :key="yearGroup.year" class="year-section">
      <h2>{{ yearGroup.year }}</h2>
      <button
        v-for="date in yearGroup.dates"
        :key="date.dateKey"
        class="date-link"
        type="button"
        @click="$emit('jumpToDate', date.dateKey)"
      >
        <span>{{ date.monthDay }}</span>
        <small>{{ date.photos.length }} 张</small>
      </button>
    </section>
  </aside>
</template>
