<script setup lang="ts">
import type { OperationNoticeItem } from '../composables/useOperationNotice'
import { onMounted, onBeforeUnmount, ref } from 'vue'

const noticeTarget = ref<HTMLElement | string>('body')
let modalObserver: MutationObserver | undefined
/** 原生模态窗口位于浏览器顶层；提示挂到打开的 dialog 内，避免遮挡和无法点击关闭。 */
function updateNoticeTarget() {
  const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[open]')
  noticeTarget.value = dialogs[dialogs.length - 1] ?? 'body'
}
onMounted(() => {
  updateNoticeTarget()
  modalObserver = new MutationObserver(updateNoticeTarget)
  modalObserver.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['open']
  })
})
onBeforeUnmount(() => modalObserver?.disconnect())

export type OperationNoticeTone = 'info' | 'success' | 'warning' | 'error'

defineProps<{
  notices: OperationNoticeItem[]
  title: string
  closeLabel: string
}>()

const emit = defineEmits<{
  close: [id: number]
  pause: [id: number]
  resume: [id: number]
}>()
</script>

<template>
  <Teleport :to="noticeTarget">
    <TransitionGroup name="operation-notice" tag="div" class="operation-notice-stack">
      <aside
        v-for="notice in notices"
        :key="notice.id"
        class="operation-notice"
        :class="[`is-${notice.tone}`, { 'is-loading': notice.loading }]"
        :role="notice.tone === 'error' ? 'alert' : 'status'"
        :aria-live="notice.tone === 'error' ? 'assertive' : 'polite'"
        aria-atomic="true"
        @mouseenter="emit('pause', notice.id)"
        @mouseleave="emit('resume', notice.id)"
      >
        <div class="operation-notice-icon" aria-hidden="true">
          <span v-if="notice.loading" class="operation-notice-spinner"></span>
          <svg v-else-if="notice.tone === 'success'" viewBox="0 0 24 24">
            <path d="m5 12.5 4.25 4.25L19 7" />
          </svg>
          <svg v-else-if="notice.tone === 'warning' || notice.tone === 'error'" viewBox="0 0 24 24">
            <path d="M12 8v5" />
            <path d="M12 17.25h.01" />
            <path
              d="M10.1 4.6 3.2 17a2 2 0 0 0 1.75 3h14.1a2 2 0 0 0 1.75-3L13.9 4.6a2.17 2.17 0 0 0-3.8 0Z"
            />
          </svg>
          <svg v-else viewBox="0 0 24 24">
            <path d="M12 10.75V17" />
            <path d="M12 7h.01" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>

        <div class="operation-notice-content">
          <p class="operation-notice-title">{{ title }}</p>
          <p class="operation-notice-message">{{ notice.message }}</p>
        </div>

        <button
          v-if="!notice.loading"
          class="operation-notice-close"
          type="button"
          :aria-label="closeLabel"
          @click="emit('close', notice.id)"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m7 7 10 10M17 7 7 17" />
          </svg>
        </button>
      </aside>
    </TransitionGroup>
  </Teleport>
</template>
