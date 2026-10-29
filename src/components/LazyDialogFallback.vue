<script setup lang="ts">
import { onBeforeUnmount, ref, toRef } from 'vue'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import { useModalFocus } from '../composables/useModalFocus'

const props = defineProps<{ active: boolean; failed: boolean; language: 'zh' | 'en' }>()
const emit = defineEmits<{ cancel: []; retry: [] }>()
const panel = ref<HTMLElement | null>(null)
const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
const active = toRef(props, 'active')
useBodyScrollLock(active)
useModalFocus(active, panel, () => emit('cancel'))
// 加载成功会直接替换占位层，先还原入口焦点，让真实弹窗接续记录来源。
onBeforeUnmount(() => {
  if (opener?.isConnected && panel.value?.contains(document.activeElement))
    opener.focus({ preventScroll: true })
})
</script>

<template>
  <Teleport to="body">
    <Transition name="confirm-dialog" appear>
      <div
        v-if="active"
        class="confirm-dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="language === 'zh' ? '加载确认窗口' : 'Loading confirmation'"
      >
        <section ref="panel" class="confirm-dialog-panel" tabindex="-1">
          <div class="confirm-dialog-content" role="status">
            <p>{{
              failed
                ? language === 'zh'
                  ? '窗口加载失败，请重试或取消。'
                  : 'Could not load this dialog. Retry or cancel.'
                : language === 'zh'
                  ? '正在加载…'
                  : 'Loading…'
            }}</p>
          </div>
          <div class="confirm-dialog-actions">
            <button type="button" class="confirm-dialog-button ghost" @click="emit('cancel')">{{
              language === 'zh' ? '取消' : 'Cancel'
            }}</button>
            <button
              v-if="failed"
              type="button"
              class="confirm-dialog-button primary"
              @click="emit('retry')"
              >{{ language === 'zh' ? '重试' : 'Retry' }}</button
            >
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
