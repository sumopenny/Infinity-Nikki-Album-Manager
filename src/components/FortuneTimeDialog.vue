<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { X } from 'lucide-vue-next'
import type { LocaleMessages } from '../i18n'

const props = defineProps<{
  visible: boolean
  messages: LocaleMessages['fortuneTime']
}>()

const emit = defineEmits<{ close: [] }>()
const panelRef = ref<HTMLElement | null>(null)
let previousBodyOverflow = ''
let previousActiveElement: HTMLElement | null = null

function closeDialog() {
  emit('close')
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeDialog()
    return
  }
  if (event.key !== 'Tab' || !panelRef.value) return
  const focusable = [...panelRef.value.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hasAttribute('disabled'))
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
      previousBodyOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = previousBodyOverflow
      previousActiveElement?.focus()
      previousActiveElement = null
    }
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="visible"
        class="help-dialog fortune-time-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="'fortune-time-title'"
        @click.self="closeDialog"
        @keydown="handleKeydown"
      >
        <section ref="panelRef" class="help-dialog-panel fortune-time-panel">
          <header class="fortune-time-header">
            <h2 id="fortune-time-title">{{ messages.title }}</h2>
            <button type="button" :aria-label="messages.close" :title="messages.close" @click="closeDialog">
              <X :size="19" aria-hidden="true" />
            </button>
          </header>
          <div class="fortune-time-body">
            <p class="fortune-time-intro">{{ messages.intro }}</p>
            <p class="fortune-time-disclaimer">{{ messages.disclaimer }}</p>

            <section>
              <h3>{{ messages.tableTitle }}</h3>
              <div class="fortune-time-table-wrap">
                <table class="fortune-time-table">
                  <thead><tr><th>{{ messages.date }}</th><th>{{ messages.time }}</th><th>{{ messages.direction }}</th><th>{{ messages.rating }}</th></tr></thead>
                  <tbody>
                    <tr v-for="row in messages.rows" :key="`${row.date}-${row.time}`" :class="{ highlighted: row.highlighted }">
                      <td><strong v-if="row.highlighted">{{ row.date }}</strong><template v-else>{{ row.date }}</template></td>
                      <td><strong v-if="row.highlighted">{{ row.time }}</strong><template v-else>{{ row.time }}</template></td>
                      <td><strong v-if="row.highlighted">{{ row.direction }}</strong><template v-else>{{ row.direction }}</template></td>
                      <td><strong v-if="row.highlighted">{{ row.rating }}</strong><template v-else>{{ row.rating }}</template></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section>
              <h3>{{ messages.recommendedTitle }}</h3>
              <ol class="fortune-time-recommendations">
                <li v-for="item in messages.recommendations" :key="item.title">
                  <strong>{{ item.title }}</strong>
                  <ul><li v-for="detail in item.details" :key="detail">{{ detail }}</li></ul>
                </li>
              </ol>
            </section>

            <section>
              <h3>{{ messages.avoidTitle }}</h3>
              <p class="fortune-time-avoid-dates">{{ messages.avoidDates }}</p>
              <ul class="fortune-time-avoid-list"><li v-for="item in messages.avoidItems" :key="item">{{ item }}</li></ul>
            </section>

            <section class="fortune-time-summary">
              <h3>{{ messages.summaryTitle }}</h3>
              <p>{{ messages.summary }}</p>
              <p class="fortune-time-footnote">{{ messages.footnote }}</p>
            </section>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
