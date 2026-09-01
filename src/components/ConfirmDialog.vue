<script setup lang="ts">
import { nextTick, ref, toRef, watch } from 'vue'
import { useBodyScrollLock } from '../utils/bodyScrollLock'

export type ConfirmDialogTone = 'info' | 'warning' | 'danger'

const props = defineProps<{
  visible: boolean
  title: string
  message: string
  tone: ConfirmDialogTone
  confirmLabel: string
  cancelLabel?: string
  closeLabel: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const confirmButtonRef = ref<HTMLButtonElement | null>(null)
useBodyScrollLock(toRef(props, 'visible'))

// 聚焦主按钮。参数：无。弹窗打开后让键盘用户可以直接确认或取消。
function focusConfirmButton() {
  nextTick(() => confirmButtonRef.value?.focus())
}

// 处理弹窗键盘操作。参数：event 为键盘事件，按 Escape 时取消弹窗。
function handleDialogKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  emit('cancel')
}

watch(
  () => props.visible,
  (isVisible) => {
    if (isVisible) focusConfirmButton()
  }
)
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div
        v-if="visible"
        class="confirm-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="title"
        @click.self="emit('cancel')"
        @keydown="handleDialogKeydown"
      >
        <section class="confirm-dialog-panel" :class="`is-${tone}`">
          <div class="confirm-dialog-icon" aria-hidden="true">
            <svg v-if="tone === 'danger'" viewBox="0 0 24 24">
              <path d="M7 7h10" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 7l.8-2h4.4L15 7" />
              <path d="M6 7l1 13h10l1-13" />
            </svg>
            <svg v-else-if="tone === 'warning'" viewBox="0 0 24 24">
              <path d="M12 8v5" />
              <path d="M12 17.25h.01" />
              <path d="M10.1 4.6 3.2 17a2 2 0 0 0 1.75 3h14.1a2 2 0 0 0 1.75-3L13.9 4.6a2.17 2.17 0 0 0-3.8 0Z" />
            </svg>
            <svg v-else viewBox="0 0 24 24">
              <path d="M12 10.75V17" />
              <path d="M12 7h.01" />
              <circle cx="12" cy="12" r="9" />
            </svg>
          </div>

          <div class="confirm-dialog-content">
            <h2>{{ title }}</h2>
            <p>{{ message }}</p>
          </div>

          <button class="confirm-dialog-close" type="button" :aria-label="closeLabel" @click="emit('cancel')">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="m7 7 10 10M17 7 7 17" />
            </svg>
          </button>

          <div class="confirm-dialog-actions">
            <button v-if="cancelLabel" class="confirm-dialog-button ghost" type="button" @click="emit('cancel')">
              {{ cancelLabel }}
            </button>
            <button ref="confirmButtonRef" class="confirm-dialog-button primary" type="button" @click="emit('confirm')">
              {{ confirmLabel }}
            </button>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
