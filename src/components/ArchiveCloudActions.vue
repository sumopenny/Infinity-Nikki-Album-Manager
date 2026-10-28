<script setup lang="ts">
import { computed } from 'vue'
import { CloudUpload, CloudDownload, LogIn, LogOut, UserPlus, Trash2 } from 'lucide-vue-next'
import { useArchiveCloud } from '../composables/useArchiveCloudSync'
import { archiveCloudMessages } from '../i18n/messages/archiveCloud'
const props = defineProps<{ language: 'zh' | 'en'; disabled?: boolean }>()
const sync = useArchiveCloud()
const { session, busy, checking } = sync
const user = session.user
const t = computed(() => archiveCloudMessages[props.language])
const disabled = computed(() => props.disabled || busy.value || checking.value)
</script>
<template>
  <template v-if="!user">
    <button type="button" :disabled="disabled" @click="sync.open('login')"
      ><LogIn :size="16" aria-hidden="true" />{{ t.login }}</button
    >
    <button type="button" :disabled="disabled" @click="sync.open('register')"
      ><UserPlus :size="16" aria-hidden="true" />{{ t.register }}</button
    >
  </template>
  <template v-else>
    <span class="cloud-account" :title="user.username">{{ t.account }}: {{ user.username }}</span>
    <button type="button" :disabled="disabled" @click="sync.open('upload')"
      ><CloudUpload :size="16" aria-hidden="true" />{{ t.upload }}</button
    >
    <button type="button" :disabled="disabled" @click="sync.open('download')"
      ><CloudDownload :size="16" aria-hidden="true" />{{ t.download }}</button
    >
    <span class="archive-cloud-separator" aria-hidden="true" />
    <button
      class="archive-cloud-delete"
      type="button"
      :disabled="disabled"
      @click="sync.open('delete')"
      ><Trash2 :size="16" aria-hidden="true" />{{ t.delete }}</button
    >
    <button type="button" :disabled="disabled" @click="sync.logout"
      ><LogOut :size="16" aria-hidden="true" />{{ t.logout }}</button
    >
  </template>
</template>
<style scoped>
.cloud-account {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--text);
  padding: 8px;
}
.archive-cloud-separator {
  display: block;
  height: 1px;
  margin: 6px 0;
  background: var(--line);
}
button.archive-cloud-delete {
  color: #a13e48;
}
button.archive-cloud-delete:hover:not(:disabled) {
  color: #872d38;
  border-color: currentColor;
}
:where(:root[data-theme='dark']) button.archive-cloud-delete {
  color: #ffb2b9;
}
</style>
