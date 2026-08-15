<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { Eraser, FolderOpen, X } from 'lucide-vue-next'
import type { LocaleMessages } from '../i18n'
import type { SpecialCleanupItem } from '../utils/fileSystem'

const props = defineProps<{
  visible: boolean
  authorizedName: string | null
  busyItem: SpecialCleanupItem | null
  disabled: boolean
  messages: LocaleMessages['cleanup']
}>()

const emit = defineEmits<{
  close: []
  authorize: []
  clean: [item: SpecialCleanupItem]
}>()

// 清理项展示顺序，与 i18n cleanup.items 对应
const cleanupItems: SpecialCleanupItem[] = ['lowQuality', 'crashes', 'logs', 'webcache']
const panelRef = ref<HTMLElement | null>(null)
let previousBodyOverflow = ''
let previousActiveElement: HTMLElement | null = null

/** 关闭专项清理窗口。参数：无。 */
function closeDialog() {
  emit('close')
}

/** 处理窗口键盘操作。参数：键盘事件；Escape 关闭，Tab 在窗口内循环聚焦。 */
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    closeDialog()
    return
  }
  if (event.key !== 'Tab' || !panelRef.value) return
  const focusable = [...panelRef.value.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')]
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

/** 判断某个清理项的按钮是否可用。参数：item 为清理项标识。 */
function isItemDisabled(item: SpecialCleanupItem): boolean {
  return props.disabled || !props.authorizedName || (props.busyItem !== null && props.busyItem !== item)
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
        class="help-dialog cleanup-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="messages.dialogTitle"
        @click.self="closeDialog"
        @keydown="handleKeydown"
      >
        <section ref="panelRef" class="help-dialog-panel cleanup-dialog-panel">
          <div class="cleanup-dialog-header">
            <div class="cleanup-dialog-title-group">
              <h2>{{ messages.dialogTitle }}</h2>
              <p class="cleanup-auth-hint">{{ messages.authHint }}</p>
              <p class="cleanup-auth-hint">{{ messages.referenceHint }}</p>
            </div>
            <div class="cleanup-dialog-header-actions">
              <span v-if="authorizedName" class="cleanup-authorized-label">{{ messages.authorizedAs(authorizedName) }}</span>
              <button class="primary-button cleanup-authorize-button" type="button" :disabled="disabled" @click="emit('authorize')">
                <FolderOpen :size="15" aria-hidden="true" />
                <span>{{ authorizedName ? messages.reauthorize : messages.authorize }}</span>
              </button>
              <button class="cleanup-dialog-close" type="button" :title="messages.dialogCloseAria" :aria-label="messages.dialogCloseAria" @click="closeDialog">
                <X :size="19" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div class="cleanup-list">
            <div v-for="item in cleanupItems" :key="item" class="cleanup-item">
              <div class="cleanup-item-info">
                <p class="cleanup-item-title">{{ messages.items[item].title }}</p>
                <p class="cleanup-item-path">{{ messages.items[item].path }}</p>
                <p class="cleanup-item-description">{{ messages.items[item].description }}</p>
              </div>
              <button
                class="primary-button cleanup-item-action"
                type="button"
                :disabled="isItemDisabled(item)"
                @click="emit('clean', item)"
              >
                <Eraser :size="15" aria-hidden="true" />
                <span>{{ busyItem === item ? messages.cleaning : messages.clean }}</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
