<script setup lang="ts">
import { Plus, Trash2, Upload } from 'lucide-vue-next'
import CollectionActions from './CollectionActions.vue'
import CloudActionsMenu from './CloudActionsMenu.vue'
import type { ResonanceMessages } from '../i18n/messages/resonance'

// 共鸣和衣橱使用相同按钮顺序、图标、移动端菜单；各自通过插槽提供云端操作。
defineProps<{
  t: Pick<ResonanceMessages, 'addData' | 'clearRecords' | 'exportData'>
  label: string
  cloudLabel: string
  hideCloudArrow?: boolean
  mobileTarget?: string
  addDisabled?: boolean
  clearDisabled?: boolean
  exportDisabled?: boolean
}>()
defineEmits<{ add: []; clear: []; export: [] }>()
</script>

<template>
  <CollectionActions
    persistent-secondary
    class="resonance-actions"
    :mobile-target="mobileTarget"
    :label="label"
  >
    <button
      class="primary-button"
      type="button"
      :aria-label="t.addData"
      :title="t.addData"
      :disabled="addDisabled"
      @click="$emit('add')"
    >
      <Plus :size="16" aria-hidden="true" /><span class="collection-action-label">{{
        t.addData
      }}</span>
    </button>
    <template #secondary>
      <slot name="before-cloud" />
      <CloudActionsMenu :label="cloudLabel" :hide-arrow="hideCloudArrow"
        ><slot name="cloud"
      /></CloudActionsMenu>
      <slot />
      <button type="button" :disabled="clearDisabled" @click="$emit('clear')"
        ><Trash2 :size="16" aria-hidden="true" />{{ t.clearRecords }}</button
      >
      <button type="button" :disabled="exportDisabled" @click="$emit('export')"
        ><Upload :size="16" aria-hidden="true" />{{ t.exportData }}</button
      >
    </template>
  </CollectionActions>
</template>

<style scoped>
.resonance-actions {
  flex-wrap: wrap;
}
</style>
