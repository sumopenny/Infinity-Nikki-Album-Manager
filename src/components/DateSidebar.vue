<script setup lang="ts">
import type { LocaleMessages } from '../i18n'
import type { YearGroup } from '../utils/dateGrouping'

defineProps<{
  yearGroups: YearGroup[]
  messages: LocaleMessages['sidebar']
}>()

defineEmits<{
  jumpToDate: [dateKey: string]
}>()
</script>

<template>
  <aside class="date-sidebar" :aria-label="messages.aria">
    <div class="sidebar-title">{{ messages.title }}</div>

    <div v-if="!yearGroups.length" class="empty-sidebar">
      {{ messages.empty }}
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
        <small>{{ messages.photoCount(date.photos.length) }}</small>
      </button>
    </section>
  </aside>
</template>
