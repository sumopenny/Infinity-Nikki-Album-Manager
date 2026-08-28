<script setup lang="ts">
import { ref, watch } from 'vue'
import { ChevronRight } from 'lucide-vue-next'
import type { Language, LocaleMessages } from '../i18n'
import type { YearGroup } from '../utils/photoGrouping'

const props = defineProps<{
  yearGroups: YearGroup[]
  language: Language
  messages: LocaleMessages['sidebar']
}>()

defineEmits<{
  jumpToDate: [dateKey: string]
}>()

const expandedYears = ref(new Set<string>())
const expandedMonths = ref(new Set<string>())
let initialized = false

/** 在首次出现日期数据时只展开最新年份和最新月份，并保留当前会话的后续操作。参数：groups 为日期树。 */
function initializeExpandedGroups(groups: YearGroup[]) {
  if (initialized || !groups.length) return
  initialized = true
  expandedYears.value = new Set([groups[0].year])
  if (groups[0].months[0]) expandedMonths.value = new Set([groups[0].months[0].monthKey])
}

/** 切换年份展开状态。参数：year 为年份。 */
function toggleYear(year: string) {
  const next = new Set(expandedYears.value)
  next.has(year) ? next.delete(year) : next.add(year)
  expandedYears.value = next
}

/** 切换月份展开状态。参数：monthKey 为年-月键。 */
function toggleMonth(monthKey: string) {
  const next = new Set(expandedMonths.value)
  next.has(monthKey) ? next.delete(monthKey) : next.add(monthKey)
  expandedMonths.value = next
}

/** 去除月份前导零并按当前语言格式化。参数：month 为两位月份。 */
function formatMonth(month: string): string {
  if (props.language === 'zh') return `${Number(month)}月`
  return new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date(2026, Number(month) - 1, 1))
}

watch(() => props.yearGroups, initializeExpandedGroups, { immediate: true })
</script>

<template>
  <aside class="date-sidebar" :aria-label="messages.aria">
    <div class="sidebar-section-title">{{ messages.title }}</div>
    <div v-if="!yearGroups.length" class="empty-sidebar">{{ messages.empty }}</div>

    <section v-for="yearGroup in yearGroups" :key="yearGroup.year" class="timeline-year">
      <button class="timeline-toggle year-toggle" type="button" :aria-expanded="expandedYears.has(yearGroup.year)" @click="toggleYear(yearGroup.year)">
        <ChevronRight :size="15" :class="{ expanded: expandedYears.has(yearGroup.year) }" />
        <strong>{{ yearGroup.year }}</strong>
        <span>{{ yearGroup.photoCount }}</span>
      </button>
      <div v-if="expandedYears.has(yearGroup.year)" class="timeline-months">
        <section v-for="month in yearGroup.months" :key="month.monthKey">
          <button class="timeline-toggle month-toggle" type="button" :aria-expanded="expandedMonths.has(month.monthKey)" @click="toggleMonth(month.monthKey)">
            <ChevronRight :size="14" :class="{ expanded: expandedMonths.has(month.monthKey) }" />
            <span>{{ formatMonth(month.month) }}</span>
            <small>{{ month.photoCount }}</small>
          </button>
          <div v-if="expandedMonths.has(month.monthKey)" class="timeline-dates">
            <button v-for="date in month.dates" :key="date.dateKey" class="date-link" type="button" @click="$emit('jumpToDate', date.dateKey)">
              <span>{{ date.monthDay }}</span>
              <small>{{ date.photos.length }}</small>
            </button>
          </div>
        </section>
      </div>
    </section>
  </aside>
</template>
