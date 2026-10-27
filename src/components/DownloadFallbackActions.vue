<script setup lang="ts">
import { ref } from 'vue'
import { requestBlobDownload } from '../utils/backup/downloadFallback'

const props = defineProps<{ files: File[]; language: 'zh' | 'en' }>()
const emit = defineEmits<{ sharing: [value: boolean] }>()
const busy = ref(false)
const result = ref('')
const text = (zh: string, en: string) => (props.language === 'zh' ? zh : en)

async function save(file: File) {
  if (busy.value) return
  busy.value = true
  emit('sharing', true)
  result.value = ''
  try {
    if (
      typeof navigator.share === 'function' &&
      typeof navigator.canShare === 'function' &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share({ files: [file] })
      result.value = text(
        '分享操作已完成，请确认文件已保存。',
        'Sharing finished. Please confirm the file was saved.'
      )
    } else {
      requestBlobDownload(file.name, file)
      result.value = text(
        '已请求下载，请在浏览器下载列表中确认。',
        'Download requested. Please check your browser downloads.'
      )
    }
  } catch (error) {
    result.value =
      error !== null && typeof error === 'object' && 'name' in error && error.name === 'AbortError'
        ? text(
            '分享已取消或未完成，可再次尝试。',
            'Sharing was cancelled or incomplete. Try again.'
          )
        : text('保存未完成，请重试。', 'Saving did not finish. Please try again.')
  } finally {
    busy.value = false
    emit('sharing', false)
  }
}
</script>

<template>
  <div class="download-fallback">
    <p>{{
      text(
        '若未开始下载，请点击下方的按钮手动下载',
        'If the download has not started, use the button below to save it manually.'
      )
    }}</p>
    <div v-for="(file, index) in files" :key="index" class="download-file">
      <span v-if="files.length > 1" class="download-name">{{ file.name }}</span>
      <button
        class="primary-button download-save-button"
        type="button"
        :disabled="busy"
        @click="save(file)"
      >
        {{ text('手动下载／分享', 'Download / share') }}
      </button>
    </div>
    <p v-if="result" role="status">{{ result }}</p>
  </div>
</template>

<style scoped>
.download-fallback {
  margin-top: 10px;
  font-size: 14px;
}
.download-fallback p {
  margin: 10px 0;
}
.download-file {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}
.download-name {
  overflow-wrap: anywhere;
  width: 100%;
}
.download-save-button {
  box-shadow: 0 2px 6px color-mix(in srgb, var(--pink-deep) 12%, transparent);
  padding: 10px 16px;
  background: transparent;
  color: var(--pink-deep);
  border: 1px solid var(--pink-deep);
  cursor: pointer;
  font-family: inherit;
  font-size: 14px;
}
.download-save-button:hover {
  box-shadow: 0 3px 8px color-mix(in srgb, var(--pink-deep) 16%, transparent);
  background: transparent;
  color: var(--pink-deep);
  border-color: var(--pink-deep);
}
.download-save-button:disabled {
  opacity: 0.6;
  cursor: wait;
  transform: none;
  box-shadow: none;
}
</style>
