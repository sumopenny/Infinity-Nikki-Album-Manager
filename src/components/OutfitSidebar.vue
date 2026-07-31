<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { Plus, X } from 'lucide-vue-next'
import type { OutfitMessages } from '../outfitMessages'
import { MAX_OUTFIT_TAG_LENGTH, MAX_OUTFIT_TAGS, type OutfitItem } from '../utils/outfitFileSystem'

export type OutfitFilter = 'all' | 'pending' | 'uncategorized' | `tag:${string}`

const props = defineProps<{
  outfits: OutfitItem[]
  tags: string[]
  activeFilter: OutfitFilter
  disabled: boolean
  messages: OutfitMessages
}>()

const emit = defineEmits<{
  changeFilter: [filter: OutfitFilter]
  addTag: [tag: string]
  deleteTag: [tag: string]
}>()

const isAdding = ref(false)
const tagInput = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const toggleRef = ref<HTMLButtonElement | null>(null)
const editorRef = ref<HTMLFormElement | null>(null)
const editorPosition = ref({ top: '0px', left: '0px' })

function countFor(filter: OutfitFilter): number {
  if (filter === 'all') return props.outfits.length
  if (filter === 'pending') return props.outfits.filter((outfit) => !outfit.code.trim()).length
  if (filter === 'uncategorized') return props.outfits.filter((outfit) => !outfit.tags.length).length
  const tag = filter.slice(4)
  return props.outfits.filter((outfit) => outfit.tags[0] === tag).length
}

function updateEditorPosition() {
  const toggle = toggleRef.value
  if (!toggle) return
  const rect = toggle.getBoundingClientRect()
  const width = Math.min(260, window.innerWidth - 24)
  editorPosition.value = {
    top: `${Math.max(12, rect.top - 3)}px`,
    left: `${Math.max(12, Math.min(rect.right + 8, window.innerWidth - width - 12))}px`
  }
}

function openTagInput() {
  isAdding.value = true
  void nextTick(() => {
    updateEditorPosition()
    inputRef.value?.focus()
  })
}

function submitTag() {
  emit('addTag', tagInput.value)
  tagInput.value = ''
}

function closeTagInput() {
  isAdding.value = false
  tagInput.value = ''
}

/** 点击标签浮层和开关按钮以外的区域时关闭输入框。参数：event 为页面指针按下事件。 */
function handleDocumentPointerDown(event: PointerEvent) {
  if (!isAdding.value || !(event.target instanceof Node)) return
  if (toggleRef.value?.contains(event.target) || editorRef.value?.contains(event.target)) return
  closeTagInput()
}

defineExpose({ closeTagInput })

onMounted(() => {
  document.addEventListener('pointerdown', handleDocumentPointerDown)
  window.addEventListener('resize', updateEditorPosition)
  window.addEventListener('scroll', updateEditorPosition, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', updateEditorPosition)
  window.removeEventListener('scroll', updateEditorPosition, true)
})
</script>

<template>
  <aside class="date-sidebar outfit-sidebar" :aria-label="messages.tagsTitle">
    <div class="outfit-sidebar-heading">
      <div class="sidebar-section-title">{{ messages.tagsTitle }}</div>
      <button
        ref="toggleRef"
        class="icon-button outfit-add-tag-toggle"
        type="button"
        :title="messages.addTag"
        :aria-label="messages.addTag"
        :disabled="disabled || tags.length >= MAX_OUTFIT_TAGS"
        @click="isAdding ? closeTagInput() : openTagInput()"
      >
        <X v-if="isAdding" :size="15" aria-hidden="true" />
        <Plus v-else :size="15" aria-hidden="true" />
      </button>
      <Teleport to="body">
        <Transition name="outfit-tag-editor">
          <form v-if="isAdding" ref="editorRef" class="outfit-tag-editor outfit-tag-editor-popover" :style="editorPosition" @submit.prevent="submitTag">
            <input ref="inputRef" v-model="tagInput" :maxlength="MAX_OUTFIT_TAG_LENGTH" :placeholder="messages.tagPlaceholder" autocomplete="off" />
            <button type="submit" :disabled="disabled">{{ messages.confirmAddTag }}</button>
          </form>
        </Transition>
      </Teleport>
    </div>

    <div class="outfit-filter-list">
      <button
        v-for="item in [
          { filter: 'all' as const, label: messages.all },
          { filter: 'pending' as const, label: messages.pending },
          { filter: 'uncategorized' as const, label: messages.uncategorized }
        ]"
        :key="item.filter"
        class="outfit-filter-button"
        :class="{ active: activeFilter === item.filter }"
        type="button"
        :disabled="disabled"
        @click="$emit('changeFilter', item.filter)"
      >
        <span>{{ item.label }}</span><small>{{ countFor(item.filter) }}</small>
      </button>

      <div v-for="tag in tags" :key="tag" class="outfit-filter-row">
        <button
          class="outfit-filter-button"
          :class="{ active: activeFilter === `tag:${tag}` }"
          type="button"
          :disabled="disabled"
          @click="$emit('changeFilter', `tag:${tag}`)"
        >
          <span>{{ tag }}</span><small>{{ countFor(`tag:${tag}`) }}</small>
        </button>
        <button
          class="outfit-delete-tag"
          type="button"
          :title="`${messages.deleteTag}: ${tag}`"
          :aria-label="`${messages.deleteTag}: ${tag}`"
          :disabled="disabled"
          @click="$emit('deleteTag', tag)"
        >
          <X :size="13" aria-hidden="true" />
        </button>
      </div>
    </div>
  </aside>
</template>
