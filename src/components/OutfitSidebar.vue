<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Check, GripVertical, Plus, Search, Settings2, X } from 'lucide-vue-next'
import { useCompactLayout } from '../composables/useCompactLayout'
import type { OutfitMessages } from '../i18n'
import {
  MAX_OUTFIT_TAG_LENGTH,
  MAX_OUTFIT_TAGS,
  type OutfitItem
} from '../utils/outfit/outfitTypes'

export type OutfitFilter = 'all' | 'pending' | 'uncategorized' | `tag:${string}`

const props = withDefaults(
  defineProps<{
    language?: 'zh' | 'en'
    outfits: Pick<OutfitItem, 'code' | 'tags'>[]
    tags: string[]
    activeFilter: string
    disabled: boolean
    messages: OutfitMessages
    showPending?: boolean
    maxTagLength?: number
    pickerOpen?: boolean
  }>(),
  { language: 'zh', showPending: true, maxTagLength: MAX_OUTFIT_TAG_LENGTH, pickerOpen: true }
)

const emit = defineEmits<{
  changeFilter: [filter: OutfitFilter]
  addTag: [tag: string]
  deleteTag: [tag: string]
  reorderTags: [tags: string[]]
  filterSelected: []
}>()

const compact = useCompactLayout()
const managingTags = ref(false)
const tagSearch = ref('')
const sidebarRef = ref<HTMLElement | null>(null)
const isAdding = ref(false)
const tagInput = ref('')
const inputRef = ref<HTMLInputElement | null>(null)
const toggleRef = ref<HTMLButtonElement | null>(null)
const editorRef = ref<HTMLFormElement | null>(null)
const editorPosition = ref({ top: '0px', left: '0px' })
const displayedTags = ref([...props.tags])
const draggedTag = ref<string | null>(null)
const dropTarget = ref<{ tag: string; position: 'before' | 'after' } | null>(null)
const visibleTags = computed(() => {
  const query = tagSearch.value.trim().toLocaleLowerCase()
  return compact.value && !managingTags.value && query
    ? displayedTags.value.filter((tag) => tag.toLocaleLowerCase().includes(query))
    : displayedTags.value
})

/** 普通选择立即返回列表；管理模式保留窗口，继续使用既有标签操作。 */
function selectFilter(filter: string) {
  if (props.disabled) return
  emit('changeFilter', filter as OutfitFilter)
  if (compact.value && !managingTags.value) emit('filterSelected')
}

/** 关闭选择窗口时清理临时搜索和管理状态，不改变已经选中的筛选条件。 */
watch(
  () => props.pickerOpen,
  (open) => {
    if (open || !compact.value) return
    tagSearch.value = ''
    managingTags.value = false
    closeTagInput()
    cancelTagDrag()
  }
)

watch(
  () => props.tags,
  (tags) => {
    displayedTags.value = [...tags]
  },
  { deep: true }
)

// 计数使用完整集合；每项仅归属首个标签，与现有筛选语义一致。
const filterCounts = computed(() => {
  const counts = new Map<string, number>([
    ['all', props.outfits.length],
    ['pending', 0],
    ['uncategorized', 0]
  ])
  for (const outfit of props.outfits) {
    if (!outfit.code.trim()) counts.set('pending', counts.get('pending')! + 1)
    if (!outfit.tags.length) counts.set('uncategorized', counts.get('uncategorized')! + 1)
    else {
      const key = `tag:${outfit.tags[0]}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
  }
  return counts
})

function updateEditorPosition() {
  const toggle = toggleRef.value
  if (!toggle) return
  const rect = toggle.getBoundingClientRect()
  const width = Math.min(260, window.innerWidth - 24)
  editorPosition.value = {
    top: `${Math.max((window.visualViewport?.offsetTop ?? 0) + 12, Math.min(rect.top - 3, (window.visualViewport?.offsetTop ?? 0) + (window.visualViewport?.height ?? window.innerHeight) - 70))}px`,
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
  const row = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('[data-outfit-tag]')
  const tag = row?.dataset.outfitTag
  if (!row || !sidebarRef.value?.contains(row) || !tag || tag === draggedTag.value) {
    dropTarget.value = null
    return
  }
  const rect = row.getBoundingClientRect()
  dropTarget.value = {
    tag,
    position: event.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
  }
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
  window.visualViewport?.addEventListener('resize', updateEditorPosition)
  window.addEventListener('scroll', updateEditorPosition, true)
})

onBeforeUnmount(() => {
  cancelTagDrag()
  document.removeEventListener('pointerdown', handleDocumentPointerDown)
  window.removeEventListener('resize', updateEditorPosition)
  window.visualViewport?.removeEventListener('resize', updateEditorPosition)
  window.removeEventListener('scroll', updateEditorPosition, true)
})
/** 切换标签管理时清空搜索并关闭新增浮层，保留既有交互顺序。 */
function toggleTagManagement() {
  managingTags.value = !managingTags.value
  tagSearch.value = ''
  closeTagInput()
}
</script>

<template>
  <aside
    ref="sidebarRef"
    class="date-sidebar outfit-sidebar"
    :class="{ 'is-managing-tags': managingTags }"
    :aria-label="messages.tagsTitle"
  >
    <div v-if="!compact || !managingTags" class="outfit-sidebar-heading">
      <div v-if="!compact" class="sidebar-section-title">{{ messages.tagsTitle }}</div>
      <!-- 手机选择模式提供搜索和添加；管理模式移除整行，仅保留排序和删除。 -->
      <label v-if="compact" class="tag-picker-search"
        ><Search :size="18" aria-hidden="true" /><input
          v-model="tagSearch"
          type="search"
          :disabled="disabled"
          :placeholder="language === 'zh' ? '搜索标签' : 'Search tags'"
          :aria-label="language === 'zh' ? '搜索标签' : 'Search tags'"
      /></label>
      <button
        ref="toggleRef"
        class="icon-button outfit-add-tag-toggle"
        type="button"
        :title="messages.addTag"
        :aria-label="messages.addTag"
        :disabled="disabled || tags.length >= MAX_OUTFIT_TAGS"
        @click="isAdding ? closeTagInput() : openTagInput()"
      >
        <Plus
          class="tag-toggle-icon"
          :class="{ 'is-open': isAdding }"
          :size="15"
          aria-hidden="true"
        />
      </button>
      <Teleport to="body">
        <Transition name="outfit-tag-editor">
          <form
            v-if="isAdding"
            ref="editorRef"
            class="outfit-tag-editor outfit-tag-editor-popover"
            :style="editorPosition"
            @submit.prevent="submitTag"
          >
            <input
              ref="inputRef"
              v-model="tagInput"
              :maxlength="maxTagLength"
              :placeholder="messages.tagPlaceholder"
              autocomplete="off"
            />
            <button type="submit" :disabled="disabled">{{ messages.confirmAddTag }}</button>
          </form>
        </Transition>
      </Teleport>
    </div>

    <div class="outfit-filter-list">
      <slot name="filters" :select-filter="selectFilter">
        <button
          v-for="item in [
            { filter: 'all' as const, label: messages.all },
            ...(showPending ? [{ filter: 'pending' as const, label: messages.pending }] : []),
            { filter: 'uncategorized' as const, label: messages.uncategorized }
          ]"
          :key="item.filter"
          class="outfit-filter-button"
          :class="{ active: activeFilter === item.filter }"
          type="button"
          :disabled="disabled"
          @click="selectFilter(item.filter)"
        >
          <span>{{ item.label }}</span
          ><small>{{ filterCounts.get(item.filter) ?? 0 }}</small>
        </button>
      </slot>
      <div
        v-for="tag in visibleTags"
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
          v-if="!compact || managingTags"
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
          @click="selectFilter(`tag:${tag}`)"
        >
          <span>{{ tag }}</span
          ><Check
            v-if="compact && activeFilter === `tag:${tag}`"
            :size="16"
            aria-hidden="true"
          /><small>{{ filterCounts.get(`tag:${tag}`) ?? 0 }}</small>
        </button>
        <button
          v-if="!compact || managingTags"
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
    <p v-if="compact && tagSearch.trim() && !visibleTags.length" class="tag-picker-empty">{{
      language === 'zh' ? '没有匹配的标签' : 'No matching tags'
    }}</p>
    <footer v-if="compact" class="tag-picker-footer"
      ><span>{{
        language === 'zh'
          ? managingTags
            ? '删除或调整标签顺序'
            : '点击标签后直接筛选'
          : managingTags
            ? 'Delete or reorder tags'
            : 'Select a tag to filter immediately'
      }}</span
      ><button
        class="tag-manage-toggle"
        type="button"
        :disabled="disabled"
        :aria-pressed="managingTags"
        @click="toggleTagManagement"
        ><Settings2 :size="16" aria-hidden="true" />{{
          language === 'zh'
            ? managingTags
              ? '完成管理'
              : '管理标签'
            : managingTags
              ? 'Done'
              : 'Manage tags'
        }}</button
      ></footer
    >
  </aside>
</template>
