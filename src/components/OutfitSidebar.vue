<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { GripVertical, Plus, X } from 'lucide-vue-next'
import type { OutfitMessages } from '../i18n'
import { MAX_OUTFIT_TAG_LENGTH, MAX_OUTFIT_TAGS, type OutfitItem } from '../utils/outfit/outfitTypes'

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
  reorderTags: [tags: string[]]
}>()

const isAdding = ref(false)
const tagInput = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const toggleRef = ref<HTMLButtonElement | null>(null)
const editorRef = ref<HTMLFormElement | null>(null)
const editorPosition = ref({ top: '0px', left: '0px' })
const displayedTags = ref([...props.tags])
const draggedTag = ref<string | null>(null)
const dropTarget = ref<{ tag: string; position: 'before' | 'after' } | null>(null)

watch(() => props.tags, (tags) => {
  displayedTags.value = [...tags]
}, { deep: true })

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

/** 根据当前拖拽标签和目标位置生成新顺序。参数：无；返回重排后的标签数组。 */
function reorderedTags(): string[] {
  const dragged = draggedTag.value
  const target = dropTarget.value
  if (!dragged || !target || dragged === target.tag) return displayedTags.value
  const tags = displayedTags.value.filter((tag) => tag !== dragged)
  const targetIndex = tags.indexOf(target.tag)
  tags.splice(targetIndex + (target.position === 'after' ? 1 : 0), 0, dragged)
  return tags
}

/** 根据指针所在标签行更新插入位置。参数：event 为指针移动事件。 */
function updateDropTarget(event: PointerEvent) {
  const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-outfit-tag]')
  const tag = row?.dataset.outfitTag
  if (!row || !tag || tag === draggedTag.value) {
    dropTarget.value = null
    return
  }
  const rect = row.getBoundingClientRect()
  dropTarget.value = { tag, position: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after' }
}

/** 完成标签拖拽并在顺序变化时通知父组件持久化。参数：无。 */
function finishTagDrag() {
  if (!draggedTag.value) return
  const nextTags = reorderedTags()
  const changed = nextTags.some((tag, index) => tag !== displayedTags.value[index])
  displayedTags.value = nextTags
  draggedTag.value = null
  dropTarget.value = null
  document.body.classList.remove('is-reordering-outfit-tags')
  window.removeEventListener('pointermove', updateDropTarget)
  window.removeEventListener('pointerup', finishTagDrag)
  window.removeEventListener('pointercancel', cancelTagDrag)
  if (changed) emit('reorderTags', nextTags)
}

/** 取消标签拖拽并恢复父组件提供的顺序。参数：无。 */
function cancelTagDrag() {
  draggedTag.value = null
  dropTarget.value = null
  displayedTags.value = [...props.tags]
  document.body.classList.remove('is-reordering-outfit-tags')
  window.removeEventListener('pointermove', updateDropTarget)
  window.removeEventListener('pointerup', finishTagDrag)
  window.removeEventListener('pointercancel', cancelTagDrag)
}

/** 从指定标签的手柄开始指针拖拽。参数：event 为指针按下事件，tag 为被拖拽标签。 */
function startTagDrag(event: PointerEvent, tag: string) {
  if (props.disabled || event.button !== 0) return
  event.preventDefault()
  draggedTag.value = tag
  dropTarget.value = null
  document.body.classList.add('is-reordering-outfit-tags')
  window.addEventListener('pointermove', updateDropTarget)
  window.addEventListener('pointerup', finishTagDrag)
  window.addEventListener('pointercancel', cancelTagDrag)
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
  cancelTagDrag()
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

      <div
        v-for="tag in displayedTags"
        :key="tag"
        class="outfit-filter-row"
        :class="{
          'is-dragging': draggedTag === tag,
          'drop-before': dropTarget?.tag === tag && dropTarget.position === 'before',
          'drop-after': dropTarget?.tag === tag && dropTarget.position === 'after'
        }"
        :data-outfit-tag="tag"
      >
        <button
          class="outfit-tag-drag-handle"
          type="button"
          :aria-label="`${messages.reorderTag}: ${tag}`"
          :data-tooltip="messages.reorderTag"
          :disabled="disabled"
          @pointerdown="startTagDrag($event, tag)"
        >
          <GripVertical :size="14" aria-hidden="true" />
        </button>
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
