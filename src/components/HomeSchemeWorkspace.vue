<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { Check, Copy, Download, Edit3, FileUp, GripVertical, ImagePlus, Plus, Trash2, Upload, X } from 'lucide-vue-next'
import type { LocaleMessages } from '../i18n'
import type { HomeSchemeMessages } from '../i18n/messages/homeScheme'
import { copyTextToClipboard } from '../utils/clipboard'
import { importHomeSchemeBackup, exportHomeSchemeBackup } from '../utils/homeBuild/homeSchemeBackup'
import {
  deleteHomeScheme,
  deleteHomeSchemeTag,
  readHomeSchemeLibrary,
  releaseHomeSchemeUrls,
  reorderHomeSchemeTags,
  saveHomeScheme,
  saveHomeSchemeTags
} from '../utils/homeBuild/homeSchemeFileSystem'
import { parseHomeScheme, type HomeSchemeParseResult } from '../utils/homeBuild/homeSchemeParser'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import { datePartsFromTimestamp, type PhotoItem } from '../utils/photoGrouping'
import {
  MAX_HOME_SCHEME_CODE_LENGTH,
  MAX_HOME_SCHEME_NOTE_LENGTH,
  MAX_HOME_SCHEME_TAG_LENGTH,
  MAX_HOME_SCHEME_TAGS,
  normalizeHomeSchemeCode,
  normalizeHomeSchemeTag,
  type HomeSchemeItem,
  type HomeSchemeType
} from '../utils/homeBuild/homeSchemeTypes'
import Lightbox from './Lightbox.vue'
import SelectionBar from './SelectionBar.vue'
import type { ThumbnailMode } from '../types/thumbnail'

const props = defineProps<{
  albumDirectory: FileSystemDirectoryHandle
  messages: HomeSchemeMessages
  copyMessages?: { copySucceeded: string; copyFailed: (value: string) => string }
  disabled: boolean
  confirmAction: (message: string, title?: string, confirmLabel?: string) => Promise<boolean>
  searchQuery: string
  selectionMessages: LocaleMessages['selectionBar']
  lightboxMessages: LocaleMessages['lightbox']
  dateMessages: LocaleMessages['date']
  thumbnailMode: ThumbnailMode
}>()
const emit = defineEmits<{
  status: [message: string, tone: 'success' | 'warning' | 'error' | 'info']
  countChange: [count: number]
}>()

const schemes = ref<HomeSchemeItem[]>([])
const tags = ref<string[]>([])
const filter = ref<'all' | 'home' | 'combo' | 'uncategorized' | `tag:${string}`>('all')
const busy = ref(false)
const editorVisible = ref(false)
const editing = ref<HomeSchemeItem | null>(null)
const code = ref('')
const name = ref('')
const schemeType = ref<HomeSchemeType | null>(null)
const version = ref<string | null>(null)
const furnitureCount = ref<number | null>(null)
const server = ref<number | null>(null)
const lastModifyTime = ref<number | null>(null)
const coverImageUrl = ref<string | null>(null)
const note = ref('')
const selectedTag = ref('')
const selectedSchemeIds = ref<Set<string>>(new Set())
const previewScheme = ref<HomeSchemeItem | null>(null)
const imageFile = ref<File | null>(null)
const localImageUrl = ref<string | null>(null)
const removeLocalImage = ref(false)
const isDragging = ref(false)
const parsing = ref(false)
const parsedCode = ref('')
const tagInputVisible = ref(false)
const tagInput = ref('')
const tagInputRef = ref<HTMLInputElement | null>(null)
const tagToggleRef = ref<HTMLButtonElement | null>(null)
const editorTagToggleRef = ref<HTMLButtonElement | null>(null)
const tagInputOwner = ref<'sidebar' | 'editor' | null>(null)
const tagEditorRef = ref<HTMLFormElement | null>(null)
const tagEditorPosition = ref({ top: '0px', left: '0px' })
const draggedTag = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
const backupInput = ref<HTMLInputElement | null>(null)
let parseTimer: number | undefined
let parseController: AbortController | null = null
let parseGeneration = 0
let loadGeneration = 0
let previousActiveElement: HTMLElement | null = null

useBodyScrollLock(editorVisible)

const visibleSchemes = computed(() => {
  let result = schemes.value
  if (filter.value === 'home' || filter.value === 'combo') result = result.filter((item) => item.schemeType === filter.value)
  else if (filter.value === 'uncategorized') result = result.filter((item) => item.tags.length === 0)
  else if (filter.value.startsWith('tag:')) result = result.filter((item) => item.tags.includes(filter.value.slice(4)))
  const query = props.searchQuery.trim().toLocaleLowerCase()
  return query ? result.filter((item) => `${item.name} ${item.code} ${item.note}`.toLocaleLowerCase().includes(query)) : result
})
const previewUrl = computed(() => localImageUrl.value ?? (removeLocalImage.value ? null : coverImageUrl.value))
const isBusy = computed(() => props.disabled || busy.value)
const selectedSchemeCount = computed(() => visibleSchemes.value.filter((item) => selectedSchemeIds.value.has(item.id)).length)
const allSchemesSelected = computed(() => visibleSchemes.value.length > 0 && visibleSchemes.value.every((item) => selectedSchemeIds.value.has(item.id)))
const previewIndex = computed(() => previewScheme.value ? visibleSchemes.value.findIndex((item) => item.id === previewScheme.value?.id) : -1)
const hasPreviousPreview = computed(() => previewIndex.value > 0)
const hasNextPreview = computed(() => previewIndex.value >= 0 && previewIndex.value < visibleSchemes.value.length - 1)
const previewPhoto = computed<PhotoItem | null>(() => {
  const item = previewScheme.value
  if (!item) return null
  const timestamp = Date.parse(item.updatedAt)
  const date = datePartsFromTimestamp(Number.isFinite(timestamp) ? timestamp : Date.now())
  if (!date) return null
  return {
    ...date,
    id: item.id,
    name: item.name || item.code,
    url: item.imageUrl,
    fileSizeText: '--',
    fileHandle: item.fileHandle as FileSystemFileHandle,
    directoryHandle: item.directoryHandle,
    note: item.note
  }
})

async function loadLibrary() {
  const generation = ++loadGeneration
  busy.value = true
  try {
    const result = await readHomeSchemeLibrary(props.albumDirectory)
    if (generation !== loadGeneration) { releaseHomeSchemeUrls(result.schemes); return }
    releaseHomeSchemeUrls(schemes.value)
    schemes.value = result.schemes
    tags.value = result.tags
    selectedSchemeIds.value = new Set()
    closePreview()
    emit('countChange', result.schemes.length)
    if (filter.value.startsWith('tag:') && !tags.value.includes(filter.value.slice(4))) filter.value = 'all'
    if (result.failedCount) emit('status', `${result.failedCount} invalid home scheme item(s) were skipped.`, 'warning')
  } catch {
    emit('status', props.messages.operationFailed, 'error')
  } finally {
    if (generation === loadGeneration) busy.value = false
  }
}

function clearParseTimer() {
  if (parseTimer !== undefined) window.clearTimeout(parseTimer)
  parseTimer = undefined
}

function cancelParse() {
  clearParseTimer()
  parseGeneration += 1
  parseController?.abort()
  parseController = null
  parsing.value = false
}

function applyParsed(result: HomeSchemeParseResult) {
  schemeType.value = result.templateType === 0 ? 'home' : 'combo'
  name.value = result.name
  version.value = result.version
  furnitureCount.value = result.furnitureCount
  server.value = result.server
  lastModifyTime.value = result.lastModifyTime
  coverImageUrl.value = result.coverImage
  parsedCode.value = result.code
}

function queueParse(rawCode: string) {
  cancelParse()
  const normalized = normalizeHomeSchemeCode(rawCode)
  if (normalized.length < 2 || normalized.length > MAX_HOME_SCHEME_CODE_LENGTH) return
  if (editing.value?.code === normalized) {
    schemeType.value = editing.value.schemeType
    version.value = editing.value.metadata.version
    furnitureCount.value = editing.value.metadata.furnitureCount
    server.value = editing.value.metadata.server
    lastModifyTime.value = editing.value.metadata.lastModifyTime
    coverImageUrl.value = editing.value.metadata.coverImageUrl
    parsedCode.value = normalized
    return
  }
  parseTimer = window.setTimeout(() => { void runParse(normalized) }, 450)
}

async function runParse(requestCode: string) {
  const generation = ++parseGeneration
  const controller = new AbortController()
  parseController = controller
  parsing.value = true
  try {
    const result = await parseHomeScheme(requestCode, controller.signal)
    if (generation !== parseGeneration || normalizeHomeSchemeCode(code.value) !== requestCode) return
    applyParsed(result)
    emit('status', props.messages.parseSucceeded, 'success')
  } catch (error) {
    if (controller.signal.aborted || generation !== parseGeneration) return
    parsedCode.value = ''
    const message = error instanceof Error && error.message === 'home_build_server_unsupported'
      ? props.messages.parseUnsupportedServer
      : props.messages.parseFailed
    emit('status', message, 'warning')
  } finally {
    if (generation === parseGeneration) parsing.value = false
  }
}

function resetEditor(item: HomeSchemeItem | null) {
  cancelParse()
  closeTagInput()
  editing.value = item
  code.value = item?.code ?? ''
  name.value = item?.name ?? ''
  schemeType.value = item?.schemeType ?? null
  version.value = item?.metadata.version ?? null
  furnitureCount.value = item?.metadata.furnitureCount ?? null
  server.value = item?.metadata.server ?? null
  lastModifyTime.value = item?.metadata.lastModifyTime ?? null
  coverImageUrl.value = item?.metadata.coverImageUrl ?? null
  note.value = item?.note ?? ''
  selectedTag.value = item?.tags[0] ?? ''
  imageFile.value = null
  localImageUrl.value = item?.fileHandle ? item.imageUrl : null
  removeLocalImage.value = false
  parsedCode.value = item?.code ?? ''
  previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
  editorVisible.value = true
  void nextTick(() => {
    document.getElementById('home-scheme-code')?.focus()
  })
  if (!item) queueParse('')
}

function closeEditor() {
  if (isBusy.value) return
  cancelParse()
  closeTagInput()
  isDragging.value = false
  if (localImageUrl.value && localImageUrl.value !== editing.value?.imageUrl) URL.revokeObjectURL(localImageUrl.value)
  localImageUrl.value = null
  editorVisible.value = false
  previousActiveElement?.focus()
  previousActiveElement = null
}

function onCodeInput(event: Event) {
  const input = event.target as HTMLInputElement
  code.value = input.value.replace(/\s/g, '').slice(0, MAX_HOME_SCHEME_CODE_LENGTH)
  if (input.value !== code.value) input.value = code.value
  if (normalizeHomeSchemeCode(code.value) !== parsedCode.value) parsedCode.value = ''
  queueParse(code.value)
}

function selectImage(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  setImageFile(file)
}

function setImageFile(file: File) {
  if (!/\.(jpe?g|png|webp)$/i.test(file.name) && !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    emit('status', props.messages.operationFailed, 'error')
    return
  }
  if (localImageUrl.value && localImageUrl.value !== editing.value?.imageUrl) URL.revokeObjectURL(localImageUrl.value)
  imageFile.value = file
  localImageUrl.value = URL.createObjectURL(file)
  removeLocalImage.value = false
}

function handleImageDrop(event: DragEvent) {
  isDragging.value = false
  const file = event.dataTransfer?.files[0]
  if (file) setImageFile(file)
}

function handlePaste(event: ClipboardEvent) {
  if (!editorVisible.value) return
  const image = [...(event.clipboardData?.files ?? [])].find((file) => file.type.startsWith('image/'))
  if (image) {
    event.preventDefault()
    setImageFile(image)
  }
}

function removeLocalImageFile() {
  if (localImageUrl.value && localImageUrl.value !== editing.value?.imageUrl) URL.revokeObjectURL(localImageUrl.value)
  imageFile.value = null
  localImageUrl.value = null
  removeLocalImage.value = true
}

function handleKeydown(event: KeyboardEvent) {
  if (!editorVisible.value) return
  const panel = document.querySelector<HTMLElement>('.home-scheme-editor')
  if (!panel) return
  if (event.key === 'Escape' && !isBusy.value) {
    if (tagInputVisible.value) closeTagInput()
    else closeEditor()
    return
  }
  if (event.key !== 'Tab') return
  const focusable = [...panel.querySelectorAll<HTMLElement>('button, input, [href], [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hasAttribute('disabled'))
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
}

function handleEditorBackdropClick() {
  if (tagInputVisible.value) closeTagInput()
  else closeEditor()
}

async function save() {
  if (isBusy.value || parsing.value) return
  const normalizedCode = normalizeHomeSchemeCode(code.value)
  if (normalizedCode.length < 2 || normalizedCode.length > MAX_HOME_SCHEME_CODE_LENGTH) { emit('status', props.messages.invalidCode, 'warning'); return }
  if (schemes.value.some((item) => item.code === normalizedCode && item.id !== editing.value?.id)) { emit('status', props.messages.duplicateCode, 'warning'); return }
  if (!name.value.trim()) { emit('status', props.messages.nameRequired, 'warning'); return }
  if (!schemeType.value || parsedCode.value !== normalizedCode) { emit('status', props.messages.parseFailed, 'warning'); return }
  busy.value = true
  try {
    const metadata = {
      version: version.value,
      furnitureCount: furnitureCount.value,
      server: server.value,
      lastModifyTime: lastModifyTime.value,
      coverImageUrl: coverImageUrl.value
    }
    const saved = await saveHomeScheme(props.albumDirectory, {
      item: editing.value ?? undefined,
      code: normalizedCode,
      name: name.value,
      schemeType: schemeType.value,
      tags: selectedTag.value ? [selectedTag.value] : [],
      note: note.value,
      metadata,
      imageFile: imageFile.value,
      removeImage: removeLocalImage.value
    }, schemes.value)
    const next = schemes.value.filter((item) => item.id !== saved.id)
    const previous = schemes.value.find((item) => item.id === saved.id)
    if (previous) releaseHomeSchemeUrls([previous])
    schemes.value = [saved, ...next].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    emit('countChange', schemes.value.length)
    busy.value = false
    closeEditor()
    emit('status', props.messages.saveSucceeded, 'success')
  } catch (error) {
    const duplicate = error instanceof Error && error.message === 'home_scheme_code_duplicate'
    emit('status', duplicate ? props.messages.duplicateCode : props.messages.operationFailed, duplicate ? 'warning' : 'error')
  } finally { busy.value = false }
}

async function removeScheme(item: HomeSchemeItem) {
  if (isBusy.value || !await props.confirmAction(props.messages.deleteConfirm)) return
  busy.value = true
  try {
    await deleteHomeScheme(item)
    releaseHomeSchemeUrls([item])
    schemes.value = schemes.value.filter((entry) => entry.id !== item.id)
    selectedSchemeIds.value = new Set([...selectedSchemeIds.value].filter((id) => id !== item.id))
    if (previewScheme.value?.id === item.id) closePreview()
    emit('countChange', schemes.value.length)
    emit('status', props.messages.deleteSucceeded, 'success')
  } catch { emit('status', props.messages.operationFailed, 'error') }
  finally { busy.value = false }
}

async function copyCode(item: HomeSchemeItem) {
  if (await copyTextToClipboard(item.code)) emit('status', props.copyMessages?.copySucceeded ?? props.messages.copySucceeded, 'success')
  else emit('status', props.copyMessages?.copyFailed(item.code) ?? props.messages.copyFailed(item.code), 'warning')
}

function toggleScheme(id: string) {
  if (isBusy.value) return
  const next = new Set(selectedSchemeIds.value)
  next.has(id) ? next.delete(id) : next.add(id)
  selectedSchemeIds.value = next
}

function handleSchemeKeydown(event: KeyboardEvent, id: string) {
  if (event.target !== event.currentTarget || event.key !== 'Enter') return
  event.preventDefault()
  toggleScheme(id)
}

function toggleAllSchemes() {
  const ids = visibleSchemes.value.map((item) => item.id)
  selectedSchemeIds.value = allSchemesSelected.value
    ? new Set([...selectedSchemeIds.value].filter((id) => !ids.includes(id)))
    : new Set([...selectedSchemeIds.value, ...ids])
}

function clearSchemeSelection() {
  selectedSchemeIds.value = new Set()
}

function changeSchemeFilter(nextFilter: typeof filter.value) {
  clearSchemeSelection()
  filter.value = nextFilter
}

function openPreview(item: HomeSchemeItem) {
  if (isBusy.value || !item.imageUrl) return
  previewScheme.value = item
}

function closePreview() {
  previewScheme.value = null
}

function showPreviousPreview() {
  if (hasPreviousPreview.value) previewScheme.value = visibleSchemes.value[previewIndex.value - 1]
}

function showNextPreview() {
  if (hasNextPreview.value) previewScheme.value = visibleSchemes.value[previewIndex.value + 1]
}

function editPreviewScheme() {
  const item = previewScheme.value
  closePreview()
  if (item) resetEditor(item)
}

async function deleteSelectedSchemes() {
  if (isBusy.value || !selectedSchemeCount.value) return
  if (!await props.confirmAction(props.messages.deleteConfirm)) return
  const selected = schemes.value.filter((item) => selectedSchemeIds.value.has(item.id))
  busy.value = true
  const deletedIds = new Set<string>()
  try {
    for (const item of selected) {
      await deleteHomeScheme(item)
      releaseHomeSchemeUrls([item])
      deletedIds.add(item.id)
    }
    schemes.value = schemes.value.filter((item) => !deletedIds.has(item.id))
    selectedSchemeIds.value = new Set()
    if (previewScheme.value && deletedIds.has(previewScheme.value.id)) closePreview()
    emit('countChange', schemes.value.length)
    emit('status', props.messages.deleteSucceeded, 'success')
  } catch { emit('status', props.messages.operationFailed, 'error') }
  finally { busy.value = false }
}

async function addTag() {
  const tag = normalizeHomeSchemeTag(tagInput.value)
  if (!tag || [...tag].length > MAX_HOME_SCHEME_TAG_LENGTH || tags.value.includes(tag) || tags.value.length >= MAX_HOME_SCHEME_TAGS) return
  const owner = tagInputOwner.value
  busy.value = true
  try {
    tags.value = await saveHomeSchemeTags(props.albumDirectory, [tag, ...tags.value])
    if (owner === 'editor') selectedTag.value = tag
    closeTagInput()
  } catch { emit('status', props.messages.operationFailed, 'error') }
  finally { busy.value = false }
}

function updateTagEditorPosition(toggleRef: typeof tagToggleRef = tagToggleRef) {
  const toggle = toggleRef.value
  if (!toggle) return
  const rect = toggle.getBoundingClientRect()
  const width = Math.min(520, window.innerWidth - 24)
  tagEditorPosition.value = {
    top: `${Math.max(12, rect.top - 3)}px`,
    left: `${Math.max(12, Math.min(rect.right + 8, window.innerWidth - width - 12))}px`
  }
}
const handleTagEditorViewportChange = () => updateTagEditorPosition(tagInputVisible.value && editorTagToggleRef.value ? editorTagToggleRef : tagToggleRef)

function toggleTagInput() {
  tagInputOwner.value = 'sidebar'
  tagInputVisible.value = !tagInputVisible.value
  if (tagInputVisible.value) void nextTick(() => { updateTagEditorPosition(); tagInputRef.value?.focus() })
}

function toggleEditorTagInput() {
  tagInputOwner.value = 'editor'
  tagInputVisible.value = !tagInputVisible.value
  if (tagInputVisible.value) void nextTick(() => { updateTagEditorPosition(editorTagToggleRef); tagInputRef.value?.focus() })
}

function closeTagInput() {
  tagInputVisible.value = false
  tagInput.value = ''
  tagInputOwner.value = null
}

function handleTagPointerDown(event: PointerEvent) {
  if (!tagInputVisible.value || !(event.target instanceof Node)) return
  if (tagToggleRef.value?.contains(event.target) || editorTagToggleRef.value?.contains(event.target) || tagEditorRef.value?.contains(event.target)) return
  closeTagInput()
}

async function removeTag(tag: string) {
  if (isBusy.value) return
  const usedCount = schemes.value.filter((scheme) => scheme.tags.includes(tag)).length
  if (usedCount) {
    const confirmed = await props.confirmAction(
      props.messages.deleteTagMessage(tag, usedCount),
      props.messages.deleteTagTitle,
      props.messages.deleteTagTitle
    )
    if (!confirmed) return
  }
  busy.value = true
  try {
    const result = await deleteHomeSchemeTag(props.albumDirectory, schemes.value, tag)
    tags.value = result.tags
    schemes.value = schemes.value.map((item) => ({ ...item, tags: item.tags.filter((entry) => entry !== tag) }))
    if (filter.value === `tag:${tag}`) filter.value = 'all'
    emit('status', props.messages.tagDeleted, 'success')
  } catch { emit('status', props.messages.operationFailed, 'error') }
  finally { busy.value = false }
}

function startTagDrag(event: DragEvent, tag: string) {
  draggedTag.value = tag
  event.dataTransfer?.setData('text/plain', tag)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

async function dropTag(event: DragEvent, target: string) {
  event.preventDefault()
  const source = draggedTag.value || event.dataTransfer?.getData('text/plain') || ''
  draggedTag.value = ''
  if (!source || source === target) return
  const next = [...tags.value]
  const from = next.indexOf(source), to = next.indexOf(target)
  if (from < 0 || to < 0) return
  next.splice(to, 0, ...next.splice(from, 1))
  try { tags.value = await reorderHomeSchemeTags(props.albumDirectory, tags.value, next) }
  catch { emit('status', props.messages.operationFailed, 'error') }
}

async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || isBusy.value) return
  busy.value = true
  try {
    const result = await importHomeSchemeBackup(props.albumDirectory, file)
    releaseHomeSchemeUrls(schemes.value)
    schemes.value = result.schemes
    tags.value = result.tags
    emit('countChange', result.schemes.length)
    emit('status', props.messages.importSucceeded(result.addedCount, result.duplicateCount, result.failedCount), result.failedCount ? 'warning' : 'success')
  } catch { emit('status', props.messages.invalidBackup, 'error') }
  finally { busy.value = false }
}

async function exportBackup() {
  if (isBusy.value) return
  const confirmed = await props.confirmAction(
    props.messages.exportConfirm(props.albumDirectory.name),
    props.messages.exportTitle,
    props.messages.exportAction
  )
  if (!confirmed || isBusy.value) return
  busy.value = true
  try {
    const result = await exportHomeSchemeBackup(props.albumDirectory)
    emit('status', props.messages.exportSucceeded(result.count, result.fileName), 'success')
  } catch { emit('status', props.messages.operationFailed, 'error') }
  finally { busy.value = false }
}

watch(() => props.albumDirectory, () => { releaseHomeSchemeUrls(schemes.value); schemes.value = []; tags.value = []; selectedSchemeIds.value = new Set(); closePreview(); filter.value = 'all'; void loadLibrary() }, { immediate: true })
window.addEventListener('paste', handlePaste)
window.addEventListener('keydown', handleKeydown)
document.addEventListener('pointerdown', handleTagPointerDown)
window.addEventListener('resize', handleTagEditorViewportChange)
window.addEventListener('scroll', handleTagEditorViewportChange, true)
onBeforeUnmount(() => {
  loadGeneration += 1
  cancelParse()
  releaseHomeSchemeUrls(schemes.value)
  if (localImageUrl.value && localImageUrl.value !== editing.value?.imageUrl) URL.revokeObjectURL(localImageUrl.value)
  window.removeEventListener('paste', handlePaste)
  window.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('pointerdown', handleTagPointerDown)
  window.removeEventListener('resize', handleTagEditorViewportChange)
  window.removeEventListener('scroll', handleTagEditorViewportChange, true)
})
</script>

<template>
  <section class="home-scheme-workspace">
    <Teleport to="#album-sidebar-column">
      <aside class="date-sidebar outfit-sidebar home-scheme-sidebar" :aria-label="messages.tagsTitle">
      <div class="outfit-sidebar-heading"><div class="sidebar-section-title">{{ messages.tagsTitle }}</div><button ref="tagToggleRef" class="icon-button outfit-add-tag-toggle" type="button" :title="messages.addTag" :aria-label="messages.addTag" :disabled="isBusy || tags.length >= MAX_HOME_SCHEME_TAGS" @click="tagInputVisible ? closeTagInput() : toggleTagInput()"><Plus class="tag-toggle-icon" :class="{ 'is-open': tagInputOwner === 'sidebar' }" :size="15" aria-hidden="true" /></button></div>
      <Teleport to="body"><Transition name="outfit-tag-editor"><form v-if="tagInputVisible" ref="tagEditorRef" class="outfit-tag-editor outfit-tag-editor-popover" :style="tagEditorPosition" @submit.prevent="addTag"><input ref="tagInputRef" v-model="tagInput" :maxlength="MAX_HOME_SCHEME_TAG_LENGTH" :placeholder="messages.tagPlaceholder" :disabled="isBusy" autocomplete="off" /><button type="submit" :disabled="isBusy">{{ messages.addTagConfirm }}</button></form></Transition></Teleport>
       <div class="outfit-filter-list">
         <button v-for="item in [{ key: 'all', label: messages.all, count: schemes.length }, { key: 'home', label: messages.homeType, count: schemes.filter((scheme) => scheme.schemeType === 'home').length }, { key: 'combo', label: messages.comboType, count: schemes.filter((scheme) => scheme.schemeType === 'combo').length }, { key: 'uncategorized', label: messages.uncategorized, count: schemes.filter((scheme) => scheme.tags.length === 0).length }]" :key="item.key" class="outfit-filter-button" :class="{ active: filter === item.key }" type="button" :disabled="isBusy" @click="changeSchemeFilter(item.key as typeof filter)"><span>{{ item.label }}</span><small>{{ item.count }}</small></button>
        <div v-for="tag in tags" :key="tag" class="outfit-filter-row" :class="{ 'is-dragging': draggedTag === tag }" draggable="true" @dragstart="startTagDrag($event, tag)" @dragover.prevent @drop="dropTag($event, tag)">
          <button class="outfit-tag-drag-handle" type="button" :aria-label="`${messages.reorderTag}: ${tag}`" :data-tooltip="messages.reorderTag" :disabled="isBusy"><GripVertical :size="14" aria-hidden="true" /></button>
           <button class="outfit-filter-button" :class="{ active: filter === `tag:${tag}` }" type="button" :disabled="isBusy" @click="changeSchemeFilter(`tag:${tag}`)"><span>{{ tag }}</span><small>{{ schemes.filter((scheme) => scheme.tags.includes(tag)).length }}</small></button>
          <button class="outfit-delete-tag" type="button" :title="messages.deleteTag + ': ' + tag" :aria-label="messages.deleteTag + ': ' + tag" :disabled="isBusy" @click="removeTag(tag)"><X :size="13" aria-hidden="true" /></button>
        </div>
      </div>
      </aside>
    </Teleport>

    <div class="home-scheme-main">
      <header class="gallery-header is-outfit-header home-scheme-header"><div class="home-scheme-heading"><p class="eyebrow">HOME SCHEMES</p><div class="home-scheme-title-row"><h2>{{ messages.title }}</h2><strong class="home-scheme-count">{{ visibleSchemes.length }} / {{ schemes.length }}</strong></div></div><div class="outfit-header-actions home-scheme-header-actions"><input ref="backupInput" class="visually-hidden" type="file" accept=".zip,application/zip" @change="importBackup" /><button type="button" :disabled="isBusy" @click="backupInput?.click()"><Download :size="15" aria-hidden="true" />{{ busy ? messages.importing : messages.importData }}</button><button type="button" :disabled="isBusy || !schemes.length" @click="exportBackup"><FileUp :size="15" aria-hidden="true" />{{ busy ? messages.exporting : messages.exportData }}</button><button class="primary-button" type="button" :disabled="isBusy" @click="resetEditor(null)"><Plus :size="15" aria-hidden="true" />{{ messages.add }}</button></div></header>
      <div v-if="!visibleSchemes.length" class="empty-album inline-empty home-scheme-empty"><ImagePlus :size="30" aria-hidden="true" /><h2>{{ messages.emptyTitle }}</h2><p>{{ messages.emptyDescription }}</p></div>
      <div v-else class="photo-grid-wrap outfit-grid-wrap home-scheme-grid-wrap" :class="`mode-${thumbnailMode}`">
        <div class="photo-grid outfit-grid">
        <article
          v-for="item in visibleSchemes"
          :key="item.id"
          class="photo-card outfit-card home-scheme-card"
          :class="{ selected: selectedSchemeIds.has(item.id) }"
          :aria-label="item.name || item.code"
          :aria-checked="selectedSchemeIds.has(item.id)"
          role="checkbox"
          tabindex="0"
          @click="toggleScheme(item.id)"
          @dblclick.stop="openPreview(item)"
          @keydown="handleSchemeKeydown($event, item.id)"
        >
          <div class="photo-frame home-scheme-card-image">
            <img v-if="item.imageUrl" :src="item.imageUrl" alt="" loading="lazy" />
            <div v-else class="home-scheme-card-no-image"><ImagePlus :size="22" aria-hidden="true" /></div>
            <div class="photo-overlay outfit-overlay home-scheme-overlay"><span>{{ item.tags[0] || messages.uncategorized }}</span></div>
            <span class="selected-badge"><Check :size="15" aria-hidden="true" /></span>
            <button class="outfit-card-delete home-scheme-card-delete" type="button" :title="messages.delete" :aria-label="messages.delete" :disabled="isBusy" @click.stop="removeScheme(item)"><Trash2 :size="16" aria-hidden="true" /></button>
          </div>
          <div class="home-scheme-card-details">
            <h3>{{ item.schemeType === 'home' ? messages.homeType : messages.comboType }}-{{ item.name || messages.untitled }}</h3>
            <div class="home-scheme-card-meta"><span v-if="item.metadata.furnitureCount !== null">{{ item.metadata.furnitureCount }} {{ messages.furnitureCount }}</span><span v-if="item.note">{{ item.note }}</span></div>
          </div>
          <div class="outfit-card-footer home-scheme-card-footer">
            <span class="outfit-code" :title="item.code">{{ item.code }}</span>
            <div class="outfit-card-actions">
              <button type="button" :title="messages.copy" :aria-label="messages.copy" :disabled="isBusy" @click.stop="copyCode(item)"><Copy :size="15" aria-hidden="true" /></button>
              <button type="button" :title="messages.edit" :aria-label="messages.edit" :disabled="isBusy" @click.stop="resetEditor(item)"><Edit3 :size="15" aria-hidden="true" /></button>
            </div>
          </div>
        </article>
        </div>
      </div>
    </div>

    <SelectionBar
      mode="outfit"
      :selected-count="selectedSchemeCount"
      :all-selected="allSchemesSelected"
      :all-items-selected="allSchemesSelected"
      :all-selected-favorited="false"
      :is-busy="isBusy"
      :messages="selectionMessages"
      @toggle-all="toggleAllSchemes"
      @delete="deleteSelectedSchemes"
      @cancel="clearSchemeSelection"
    />

    <Lightbox
      :photo="previewPhoto"
      :has-previous="hasPreviousPreview"
      :has-next="hasNextPreview"
      :is-deleting="isBusy"
      :is-favorite="false"
      :keyboard-enabled="!editorVisible && !tagInputVisible"
      mode="home"
      :home-scheme="previewScheme"
      :home-messages="messages"
      :messages="lightboxMessages"
      :date-messages="dateMessages"
      @close="closePreview"
      @previous="showPreviousPreview"
      @next="showNextPreview"
      @copy-home-scheme="previewScheme && copyCode(previewScheme)"
      @edit-home-scheme="editPreviewScheme"
    />

    <Teleport to="body">
      <Transition name="confirm-dialog">
        <div v-if="editorVisible" class="outfit-editor home-scheme-editor-overlay" role="dialog" aria-modal="true" :aria-label="editing ? messages.edit : messages.add" @click.self="handleEditorBackdropClick">
          <section class="outfit-editor-panel home-scheme-editor">
            <header>
              <h2>{{ editing ? messages.edit : messages.add }}</h2>
              <button type="button" :title="messages.cancel" :aria-label="messages.cancel" :disabled="isBusy" @click="closeEditor"><X :size="19" aria-hidden="true" /></button>
            </header>

            <div class="outfit-editor-content home-scheme-editor-body">
              <div class="outfit-image-column">
                <label>{{ messages.image }}</label>
                <button class="outfit-image-dropzone home-scheme-image-dropzone" :class="{ 'is-dragging': isDragging, 'has-preview': previewUrl }" type="button" :disabled="isBusy" @click="fileInput?.click()" @dragenter.prevent="isDragging = true" @dragover.prevent="isDragging = true" @dragleave.prevent="isDragging = false" @drop.prevent="handleImageDrop">
                  <img v-if="previewUrl" :src="previewUrl" alt="" />
                  <span v-else class="outfit-image-prompt"><ImagePlus :size="30" aria-hidden="true" />{{ messages.imageHint }}</span>
                  <span v-if="previewUrl" class="outfit-replace-image"><Upload :size="15" aria-hidden="true" />{{ messages.chooseImage }}</span>
                </button>
                <input ref="fileInput" class="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" @change="selectImage" />
                <button v-if="previewUrl && localImageUrl" class="home-scheme-remove-image" type="button" :disabled="isBusy" @click="removeLocalImageFile"><X :size="14" aria-hidden="true" />{{ messages.removeImage }}</button>
                <table class="home-scheme-metadata" aria-label="方案信息">
                  <tbody>
                    <tr>
                      <td><span>{{ messages.type }}</span><strong>{{ schemeType === 'home' ? messages.homeType : schemeType === 'combo' ? messages.comboType : messages.pendingType }}</strong></td>
                      <td><span>{{ messages.version }}</span><strong>{{ version || '—' }}</strong></td>
                      <td><span>{{ messages.furnitureCount }}</span><strong>{{ furnitureCount ?? '—' }}</strong></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div class="outfit-fields home-scheme-fields">
                <label for="home-scheme-code">{{ messages.code }}</label>
                <input id="home-scheme-code" :value="code" :maxlength="MAX_HOME_SCHEME_CODE_LENGTH" :placeholder="messages.codePlaceholder" autocomplete="off" :disabled="isBusy" @input="onCodeInput" />
                <small v-if="parsing" class="home-scheme-parse-state">{{ messages.parsePending }}</small>
                <label for="home-scheme-name">{{ messages.name }}</label>
                <input id="home-scheme-name" v-model="name" :placeholder="messages.namePlaceholder" :disabled="isBusy" />
                <label for="home-scheme-note">{{ messages.note }}</label>
                <input id="home-scheme-note" v-model="note" :maxlength="MAX_HOME_SCHEME_NOTE_LENGTH" :placeholder="messages.notePlaceholder" :disabled="isBusy" />
                <fieldset>
                  <legend>{{ messages.tagsTitle }}</legend>
                  <div class="outfit-tag-choices">
                    <button v-for="tag in tags" :key="tag" type="button" :class="{ active: selectedTag === tag }" :aria-pressed="selectedTag === tag" :disabled="isBusy" @click="selectedTag = selectedTag === tag ? '' : tag">{{ tag }}</button>
                    <button ref="editorTagToggleRef" class="outfit-editor-add-tag" type="button" :title="messages.addTag" :aria-label="messages.addTag" :disabled="isBusy || tags.length >= MAX_HOME_SCHEME_TAGS" @click="tagInputVisible ? closeTagInput() : toggleEditorTagInput()">
                      <Transition name="tag-toggle-icon" mode="out-in"><X v-if="tagInputVisible" key="close" :size="15" aria-hidden="true" /><Plus v-else key="open" :size="15" aria-hidden="true" /></Transition>
                    </button>
                    <p v-if="!tags.length">{{ messages.uncategorized }}</p>
                  </div>
                </fieldset>
              </div>
            </div>

            <footer>
              <button class="confirm-dialog-button ghost" type="button" :disabled="isBusy" @click="closeEditor">{{ messages.cancel }}</button>
              <button class="confirm-dialog-button primary" type="button" :disabled="isBusy || parsing" @click="save">{{ busy ? messages.saving : messages.confirm }}</button>
            </footer>
          </section>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
.home-scheme-workspace{min-width:0;min-height:100%}
.home-scheme-sidebar{min-width:0;margin-top:20px;padding:0 7px 20px 0;overflow-x:hidden;overflow-y:auto}
.home-scheme-main{min-width:0;padding:0 0 28px}
.home-scheme-tag-form{margin:10px 0 0}
.home-scheme-heading{min-width:0}
.home-scheme-title-row{display:flex;min-height:28px;align-items:center;gap:14px;min-width:0}
.home-scheme-count{color:var(--muted);font-size:16px;line-height:1;white-space:nowrap}
.home-scheme-header-actions input[type=search]{width:180px;min-width:0;height:36px}
.home-scheme-empty{margin-top:14px}
.home-scheme-card-image{border-radius:12px}
.home-scheme-card-image>img{width:100%;height:100%;object-fit:cover}
.home-scheme-card-no-image{height:100%;display:grid;place-items:center;color:var(--muted)}
.home-scheme-card-delete{right:8px}
.home-scheme-card-details{min-width:0;padding:8px 1px 0}
.home-scheme-card-details h3{margin:0;overflow-wrap:anywhere;color:var(--heading);font-size:13px;line-height:1.4}
.home-scheme-card-meta{display:flex;flex-wrap:wrap;gap:4px 8px;min-height:20px;margin-top:4px;color:var(--muted);font-size:11px}
.home-scheme-card-footer{min-height:38px;padding-top:5px}
.home-scheme-code{display:flex;min-width:0;flex:1;align-items:center;gap:5px;padding:0;border:0;background:transparent;color:var(--text);text-align:left}
.home-scheme-code .outfit-code{font-size:11px}
.home-scheme-card-tag{padding:3px 1px 0;color:var(--muted);font-size:11px}
.home-scheme-editor{width:min(820px,100%)}
.home-scheme-image-dropzone{aspect-ratio:16/9}

.home-scheme-metadata{width:100%;table-layout:fixed;border-collapse:separate;border-spacing:7px 0;margin:14px -7px 0;color:var(--muted);font-size:12px}
.home-scheme-metadata td{width:33.333%;padding:10px 11px;border:1px solid color-mix(in srgb,var(--pink-deep) 22%,var(--line));border-radius:11px;background:color-mix(in srgb,var(--pink-deep) 6%,var(--surface-strong));vertical-align:top}
.home-scheme-metadata span{display:block;margin-bottom:5px;color:var(--muted);font-size:11px;font-weight:800;line-height:1.2}
.home-scheme-metadata strong{display:block;overflow:hidden;color:var(--heading);font-size:15px;line-height:1.25;text-overflow:ellipsis;white-space:nowrap}
.home-scheme-fields>.home-scheme-readonly{min-height:36px;margin-bottom:20px;color:var(--text);font-size:13px}
.home-scheme-fields>small{display:block;margin:-15px 0 14px;color:var(--muted);font-size:11px}
.home-scheme-fields>.home-scheme-parse-error{color:var(--notice-error)}
.home-scheme-fields fieldset{min-width:0;margin:0;padding:0;border:0}
.home-scheme-fields legend{display:block;margin-bottom:7px;color:var(--heading);font-size:12px;font-weight:800}
.home-scheme-fields fieldset p{color:var(--muted);font-size:12px}
.home-scheme-remove-image{display:inline-flex;align-items:center;gap:6px;min-height:34px;margin-top:8px;padding:6px 11px;border:1px solid var(--line);border-radius:10px;background:var(--surface-strong);color:var(--muted);font-size:12px;font-weight:700;transition:color var(--motion-fast) ease,border-color var(--motion-fast) ease,background var(--motion-fast) ease,transform var(--motion-fast) ease}
.home-scheme-remove-image:hover:not(:disabled){border-color:var(--pink-deep);background:color-mix(in srgb,var(--pink-deep) 8%,var(--surface-strong));color:var(--pink-deep);transform:translateY(-1px)}
@media(max-width:850px){.home-scheme-workspace{min-height:0}.home-scheme-sidebar{margin-top:14px}.home-scheme-header-actions input[type=search]{flex:1 1 140px}.home-scheme-editor-body{grid-template-columns:1fr}.home-scheme-image-dropzone{max-width:560px}}
@media(max-width:520px){.home-scheme-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.home-scheme-card-details h3{font-size:12px}.home-scheme-header-actions>button{justify-content:center;white-space:normal}.home-scheme-metadata{border-spacing:5px 0;margin-right:-5px;margin-left:-5px}.home-scheme-metadata td{padding:9px 8px}.home-scheme-metadata strong{font-size:13px}}
</style>
