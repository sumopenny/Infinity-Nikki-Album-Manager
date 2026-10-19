<script setup lang="ts">
import { ref, toRef } from 'vue'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import { useModalFocus } from '../composables/useModalFocus'
const props = withDefaults(
  defineProps<{
    language?: 'zh' | 'en'
    failed?: boolean
    dialog?: boolean
    reloadRequired?: boolean
  }>(),
  { language: 'zh', dialog: false }
)
const emit = defineEmits<{ retry: []; close: [] }>()
const panel = ref<HTMLElement | null>(null)
useBodyScrollLock(toRef(props, 'dialog'))
useModalFocus(toRef(props, 'dialog'), panel, () => emit('close'))
</script>
<template>
  <Teleport to="body" :disabled="!dialog">
    <div :class="{ 'dialog-overlay': dialog }">
      <div
        ref="panel"
        class="async-module-state"
        :class="{ 'dialog-panel': dialog }"
        :role="dialog ? 'dialog' : failed ? 'alert' : 'status'"
        :aria-modal="dialog || undefined"
        :aria-label="language === 'zh' ? '加载功能' : 'Load feature'"
        tabindex="-1"
        aria-live="polite"
      >
        <span>{{
          failed
            ? language === 'zh'
              ? '功能加载失败'
              : 'Could not load this feature'
            : language === 'zh'
              ? '正在加载…'
              : 'Loading…'
        }}</span>
        <button v-if="failed" type="button" @click="$emit('retry')">{{
          reloadRequired
            ? language === 'zh'
              ? '重新加载页面'
              : 'Reload page'
            : language === 'zh'
              ? '重试'
              : 'Retry'
        }}</button>
        <button v-if="dialog" type="button" @click="$emit('close')">{{
          language === 'zh' ? '关闭' : 'Close'
        }}</button>
      </div>
    </div>
  </Teleport>
</template>
<style scoped>
.async-module-state {
  padding: 24px;
  text-align: center;
  color: var(--muted);
}
.async-module-state button {
  margin-left: 12px;
  cursor: pointer;
}
</style>
