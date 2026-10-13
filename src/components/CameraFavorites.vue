<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, toRef, watch } from 'vue'
import { Camera, Check, Copy, Download, Edit3, ImagePlus, Plus, ScanSearch, Trash2, Upload, X } from 'lucide-vue-next'
import { messages as localeMessages, type Language } from '../i18n'
import CollectionFilterBar from './CollectionFilterBar.vue'
import CollectionActions from './CollectionActions.vue'
import CardActions from './CardActions.vue'
import SelectionBar from './SelectionBar.vue'
import OutfitSidebar, { type OutfitFilter } from './OutfitSidebar.vue'
import { deleteCameraFavoriteTag, saveCameraFavoriteTags } from '../utils/photo-params/favorites'
import { favoriteResources } from '../utils/photo-params/favoriteResources'
import type { PhotoParamsMessages } from '../i18n/messages/photoParams'
import type { PhotoParamsResult } from '../utils/photo-params/types'
import type { PhotoItem } from '../utils/photoGrouping'
import { usePhotoParams } from '../composables/usePhotoParams'
import { useBodyScrollLock } from '../utils/bodyScrollLock'
import { copyTextToClipboard } from '../utils/clipboard'
import { convertImageToWebp } from '../utils/image'
import { applyCameraImport, cloneFavorite, coverMetadata, deleteCameraFavorite, deleteCameraFavorites, DuplicateCameraCodeError, normalizeCameraCode, planCameraImport, readCameraFavorites, saveCameraFavorite, type CameraFavorite, type FavoriteLibrary, type FavoriteSource, type ImportPlan } from '../utils/photo-params/favorites'
import { exportCameraBackup, readCameraBackup } from '../utils/photo-params/favoritesBackup'
import PhotoParamsDialog from './PhotoParamsDialog.vue'
import CameraImportConflictDialog from './CameraImportConflictDialog.vue'

const props = defineProps<{ active: boolean; disabled?: boolean; sidebarTarget?: string; actionsTarget?: string; filtersOpen?: boolean; language: Language; messages: PhotoParamsMessages; searchQuery: string; confirmAction: (message: string, title?: string, confirmLabel?: string) => Promise<boolean> }>()
const emit = defineEmits<{ openFilters: []; closeFilters: []; visibleCountChange: [count: number]; busyChange: [busy: boolean]; codesChange: [codes: string[]]; modalChange: [visible: boolean]; status: [message: string, tone: 'success' | 'error' | 'warning' | 'info'] }>()
const t = (zh: string, en: string) => props.language === 'zh' ? zh : en
const library = shallowRef<FavoriteLibrary>({ records: [], covers: new Map() })
const urls = ref<Record<string, string>>({})
const localBusy = ref(false)
const busy = computed({ get: () => Boolean(props.disabled) || localBusy.value, set: value => { localBusy.value = value } })
watch(localBusy, value => emit('busyChange', value))
const loadError = ref('')
const editor = ref(false)
const editing = shallowRef<CameraFavorite | null>(null)
const code = ref('')
const name = ref('')
const selectedTag = ref('')
const source = ref<FavoriteSource>('manual')
const parsed = shallowRef<PhotoParamsResult | null>(null)
const parsedCode = ref('')
const parsing = ref(false)
const error = ref('')
const cover = shallowRef<Blob | null>(null)
const coverName = ref('')
const previewUrl = ref('')
const detail = shallowRef<CameraFavorite | null>(null)
const importPlan = shallowRef<ImportPlan | null>(null)
const choices = ref<Record<string, 'local' | 'incoming'>>({})
const coverInput = ref<HTMLInputElement | null>(null)
const backupInput = ref<HTMLInputElement | null>(null)
const backupDownloads = ref<Array<{ fileName: string; url: string }>>([])
function releaseBackupDownloads() {
  for (const download of backupDownloads.value) URL.revokeObjectURL(download.url)
  backupDownloads.value = []
}
const form = ref<HTMLElement | null>(null)
const tagFilter = ref<OutfitFilter>('all')
const tagOrder = ref<string[]>([])
const sidebar = ref<InstanceType<typeof OutfitSidebar> | null>(null)
const tagMessages = computed(() => ({ ...localeMessages[props.language].outfit, tagPlaceholder: t('输入标签（最多 60 字）', 'Tag name (up to 60 characters)') }))
const isAddingTag = ref(false)
const newTag = ref('')
const tagToggle = ref<HTMLButtonElement | null>(null)
const tagInput = ref<HTMLInputElement | null>(null)
const tagPopover = ref<HTMLElement | null>(null)
const tagPosition = ref({ top: '0px', left: '0px' })
const editorTags = computed(() => [...new Set([...allTags.value, selectedTag.value].filter(Boolean))])
const sidebarRecords = computed(() => library.value.records.map(record => ({ code: record.code, tags: record.tag ? [record.tag] : [] })))
async function persistTags(next: string[]) {
  busy.value = true
  try {
    tagOrder.value = await saveCameraFavoriteTags(next)
    channel?.postMessage('changed')
  } finally { busy.value = false }
}
async function addTag(raw: string, select = false) {
  if (busy.value) return
  const tag = raw.trim()
  if (!tag || tag.length > 60 || /[,，]/.test(tag)) {
    error.value = t('标签需为 1–60 字，不能包含逗号', 'Use 1–60 characters without commas')
    emit('status', error.value, 'warning'); return
  }
  if (!allTags.value.includes(tag) && allTags.value.length >= 40) {
    emit('status', t('最多添加 40 个标签', 'Up to 40 tags'), 'warning'); return
  }
  try {
    if (!allTags.value.includes(tag)) await persistTags([...allTags.value, tag])
    if (select) selectedTag.value = tag
    error.value = ''
    closeTagInput()
    sidebar.value?.closeTagInput()
  } catch (caught) { report(caught) }
}
function toggleTag(tag: string) {
  selectedTag.value = selectedTag.value === tag ? '' : tag
}
async function reorderTags(next: string[]) {
  if (busy.value) return
  try { await persistTags([...new Set([...next, ...allTags.value])]) } catch (caught) { report(caught) }
}
async function removeTag(tag: string) {
  if (busy.value) return
  const count = library.value.records.filter(record => record.tag === tag).length
  if (count && !await props.confirmAction(t('删除标签“' + tag + '”？将从 ' + count + ' 条收藏中移除此标签，收藏本身会保留。', 'Remove tag “' + tag + '” from ' + count + ' favorites? The favorites will be kept.'), t('删除标签', 'Delete tag'))) return
  busy.value = true
  try {
    await deleteCameraFavoriteTag(tag)
    if (tagFilter.value === 'tag:' + tag) tagFilter.value = 'all'
    if (selectedTag.value === tag) selectedTag.value = ''
    await reload()
    channel?.postMessage('changed')
  } catch (caught) { report(caught) }
  finally { busy.value = false }
}
function updateTagPosition() {
  const rect = tagToggle.value?.getBoundingClientRect()
  if (!rect) return
  const width = Math.min(260, window.innerWidth - 24)
  tagPosition.value = { top: Math.max(12, Math.min(rect.top, window.innerHeight - 70)) + 'px', left: Math.max(12, Math.min(rect.right + 8, window.innerWidth - width - 12)) + 'px' }
}
function closeTagInput() { isAddingTag.value = false; newTag.value = '' }
async function openTagInput() {
  isAddingTag.value = true
  await nextTick()
  updateTagPosition()
  tagInput.value?.focus()
}
function tagOutsideClick(event: PointerEvent) {
  if (event.target instanceof Node && !tagToggle.value?.contains(event.target) && !tagPopover.value?.contains(event.target)) closeTagInput()
}

const selectedIds = ref<Set<string>>(new Set())
const selectionMessages = computed(() => localeMessages[props.language].selectionBar)
const parser = usePhotoParams({ language: toRef(props, 'language'), messages: computed(() => props.messages) })
const modal = computed(() => editor.value || !!detail.value || !!importPlan.value)
useBodyScrollLock(modal)
let generation = 0
let parseTimer: ReturnType<typeof setTimeout> | undefined
function cancelAutoParse() {
  if (parseTimer !== undefined) clearTimeout(parseTimer)
  parseTimer = undefined
  generation++
  parsing.value = false
  parser.close()
}
let loadGeneration = 0
let previousFocus: HTMLElement | null = null
let channel: BroadcastChannel | null = null
let disposed = false

watch(modal, async (visible) => {
  emit('modalChange', visible)
  if (visible) {
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    await nextTick()
    form.value?.querySelector<HTMLElement>('textarea, input, button')?.focus()
  } else { previousFocus?.focus(); previousFocus = null }
})
watch(() => normalizeCameraCode(code.value), (normalized) => {
  if (!editor.value || (parsed.value && normalized === parsedCode.value)) return
  cancelAutoParse()
  parsed.value = null
  parsedCode.value = ''
  error.value = ''
  if (!normalized) return
  parseTimer = setTimeout(() => {
    parseTimer = undefined
    void parse()
  }, 500)
}, { flush: 'sync' })
const allTags = computed(() => [...new Set([...tagOrder.value, ...library.value.records.map((r) => r.tag).filter(Boolean)])])
const visibleRecords = computed(() => {
  const query = props.searchQuery.trim().toLocaleLowerCase()
  return library.value.records.filter((r) => (tagFilter.value === 'all' || (tagFilter.value === 'uncategorized' ? !r.tag : r.tag === tagFilter.value.slice(4)))
    && (!query || [r.name, r.code, r.tag].join(' ').toLocaleLowerCase().includes(query)))
})
watch(visibleRecords, value => emit('visibleCountChange', value.length), { immediate: true })
const resources = favoriteResources
const selectedRecords = computed(() => visibleRecords.value.filter((item) => selectedIds.value.has(item.id)))
const allSelected = computed(() => visibleRecords.value.length > 0 && selectedRecords.value.length === visibleRecords.value.length)
function toggleSelected(id: string) {
  if (busy.value) return
  const next = new Set(selectedIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIds.value = next
}
function cardKeydown(event: KeyboardEvent, id: string) {
  if (event.target !== event.currentTarget || ![' ', 'Enter'].includes(event.key)) return
  event.preventDefault()
  toggleSelected(id)
}
function toggleAll() {
  selectedIds.value = allSelected.value ? new Set() : new Set(visibleRecords.value.map((item) => item.id))
}
watch(() => props.active, () => { selectedIds.value = new Set(); sidebar.value?.closeTagInput(); closeTagInput() })
watch(visibleRecords, (records) => {
  const visible = new Set(records.map((item) => item.id))
  selectedIds.value = new Set([...selectedIds.value].filter((id) => visible.has(id)))
})
async function removeSelected() {
  const ids = selectedRecords.value.map((item) => item.id)
  if (busy.value || !ids.length) return
  if (!await props.confirmAction(t('删除选中的 ' + ids.length + ' 条参数收藏？原照片不会删除。', 'Delete ' + ids.length + ' selected favorites? Original photos will be kept.'), t('删除参数收藏', 'Delete camera favorites'))) return
  busy.value = true
  try {
    await deleteCameraFavorites(ids)
    selectedIds.value = new Set()
    notifyChanged()
    emit('status', t('已删除选中的收藏', 'Selected favorites deleted'), 'success')
  } catch (caught) { report(caught) }
  finally { busy.value = false }
}
function report(caught: unknown) {
  const message = caught instanceof DuplicateCameraCodeError ? t('该参数已收藏', 'These parameters are already saved')
    : caught instanceof Error ? caught.message : String(caught)
  error.value = caught instanceof DuplicateCameraCodeError ? '' : message
  emit('status', message, 'error')
}
function releaseUrls() { Object.values(urls.value).forEach((url) => URL.revokeObjectURL(url)); urls.value = {} }
async function reload() {
  const run = ++loadGeneration
  try {
    const next = await readCameraFavorites()
    if (disposed || run !== loadGeneration) return
    const nextUrls: Record<string, string> = {}
    next.covers.forEach((blob, id) => { nextUrls[id] = URL.createObjectURL(blob) })
    releaseUrls()
    urls.value = nextUrls
    tagOrder.value = next.tags ?? []
    library.value = next
    loadError.value = ''
    emit('codesChange', next.records.map((r) => r.code))
  } catch (caught) {
    if (!disposed && run === loadGeneration) loadError.value = caught instanceof Error ? caught.message : String(caught)
  }
}
function setCover(file: Blob | null, filename = '') {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  cover.value = file
  coverName.value = filename
  previewUrl.value = file ? URL.createObjectURL(file) : ''
}
function closeEditor() {
  if (busy.value) return
  cancelAutoParse()
  editor.value = false
  closeTagInput()
  setCover(null)
}
async function openEditor(item: CameraFavorite | null = null, result: PhotoParamsResult | null = null, entry: FavoriteSource = 'manual', file: File | null = null) {
  if (busy.value) return
  cancelAutoParse()
  editing.value = item ? cloneFavorite(item) : null
  source.value = item?.source ?? entry
  parsed.value = cloneFavorite(item?.result ?? result)
  const initialCode = item?.result.rawCameraParams ?? result?.rawCameraParams ?? ''
  parsedCode.value = parsed.value ? normalizeCameraCode(initialCode) : ''
  code.value = initialCode
  name.value = item?.name ?? t('相机参数 ', 'Camera settings ') + new Date().toLocaleDateString()
  selectedTag.value = item?.tag ?? ''
  closeTagInput()
  sidebar.value?.closeTagInput()
  error.value = ''
  setCover(item ? library.value.covers.get(item.id) ?? null : file, item?.cover?.name ?? file?.name ?? '')
  editor.value = true
  await nextTick()
}
async function openFromResult(result: PhotoParamsResult, photo: PhotoItem | { name: string } | null) {
  if (busy.value) return
  busy.value = true
  try {
    await reload()
    if (loadError.value) throw new Error(loadError.value)
    if (library.value.records.some((r) => r.code === normalizeCameraCode(result.rawCameraParams))) throw new DuplicateCameraCodeError()
    const isAlbum = !!photo && 'fileHandle' in photo
    const file = isAlbum ? await (photo as PhotoItem).fileHandle.getFile() : null
    busy.value = false
    await openEditor(null, result, isAlbum ? 'album' : photo ? 'tool' : 'manual', file)
  } catch (caught) { report(caught) }
  finally { busy.value = false }
}
async function parse() {
  if (disposed || !editor.value || !normalizeCameraCode(code.value)) return
  if (parsed.value && normalizeCameraCode(code.value) === parsedCode.value) return
  const raw = code.value
  const run = ++generation
  parsing.value = true
  error.value = ''
  await parser.parseRawCameraParams(raw)
  if (run !== generation) return
  parsing.value = false
  if (!parser.result.value) {
    emit('status', parser.error.value ?? t('解析失败', 'Parsing failed'), 'error')
    return
  }
  parsed.value = cloneFavorite(parser.result.value)
  parsedCode.value = normalizeCameraCode(raw)
  source.value = 'manual'
  emit('status', t('参数已解析', 'Parameters parsed'), 'success')
}
function selectCover(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(file.type)) {
    error.value = t('请选择 JPG、PNG、WebP、GIF 或 AVIF 图片', 'Choose a JPG, PNG, WebP, GIF or AVIF image')
    return
  }
  error.value = ''
  setCover(file, file.name)
}
function notifyChanged() { channel?.postMessage('changed'); void reload() }
async function save() {
  if (busy.value || parsing.value || !parsed.value || normalizeCameraCode(code.value) !== parsedCode.value) return
  if (!name.value.trim() || selectedTag.value.length > 60) {
    error.value = t('名称必填，最多选择 1 个标签，标签不超过 60 字', 'A name is required; select at most one tag, up to 60 characters'); return
  }
  busy.value = true
  error.value = ''
  try {
    if (cover.value && (cover.value.type !== 'image/webp' || !/\.webp$/i.test(coverName.value))) {
      try {
        const file = new File([cover.value], coverName.value, { type: cover.value.type })
        const webp = await convertImageToWebp(file)
        if (webp.type !== 'image/webp' || !webp.size) throw new Error(t('未能生成有效的 WebP 图片', 'A valid WebP image could not be generated'))
        const filename = (coverName.value.replace(/\.[^.]+$/, '') || 'cover') + '.webp'
        setCover(webp, filename)
      } catch (caught) {
        const reason = caught instanceof Error ? caught.message : String(caught)
        emit('status', t('封面转为 WebP 失败：', 'Cover conversion to WebP failed: ') + reason, 'error')
        return
      }
    }
    const now = new Date().toISOString()
    const record: CameraFavorite = {
      id: editing.value?.id ?? crypto.randomUUID(), version: 1, name: name.value.trim(), tag: selectedTag.value,
      code: parsedCode.value, source: source.value, result: cloneFavorite(parsed.value),
      cover: cover.value ? await coverMetadata(cover.value, coverName.value) : null,
      createdAt: editing.value?.createdAt ?? now, updatedAt: now
    }
    await saveCameraFavorite(record, cover.value, editing.value ?? undefined)
    busy.value = false
    closeEditor()
    notifyChanged()
    emit('status', t('已保存相机参数', 'Camera parameters saved'), 'success')
  } catch (caught) { report(caught) }
  finally { busy.value = false }
}
async function remove(item: CameraFavorite) {
  if (busy.value || !await props.confirmAction(t('删除这条参数收藏？原照片不会删除。', 'Delete this favorite? The original photo will be kept.'), t('删除参数收藏', 'Delete camera favorite'))) return
  busy.value = true
  try { await deleteCameraFavorite(item.id); notifyChanged(); emit('status', t('已删除收藏', 'Favorite deleted'), 'success') }
  catch (caught) { report(caught) }
  finally { busy.value = false }
}
async function copy(raw: string) {
  const messages = localeMessages[props.language].app
  if (await copyTextToClipboard(raw)) emit('status', messages.copySucceeded, 'success')
  else emit('status', messages.copyFailed(raw), 'warning')
}
async function exportBackup() {
  busy.value = true
  try {
    releaseBackupDownloads()
    for await (const part of exportCameraBackup(await readCameraFavorites())) {
      const url = URL.createObjectURL(part.blob)
      backupDownloads.value.push({ fileName: part.fileName, url })
      const link = document.createElement('a')
      link.href = url
      link.download = part.fileName
      link.click()
    }
    emit('status', t('已生成 ' + backupDownloads.value.length + ' 个备份文件', 'Created ' + backupDownloads.value.length + ' backup file(s)'), 'success')
  } catch (caught) { report(caught) }
  finally { busy.value = false }
}
async function importBackup(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || busy.value) return
  busy.value = true
  error.value = ''
  try {
    const incoming = await readCameraBackup(file)
    const local = await readCameraFavorites()
    const plan = planCameraImport(local, incoming)
    choices.value = Object.fromEntries(plan.conflicts.map((r) => [r.id, 'local']))
    importPlan.value = plan
    if (!plan.conflicts.length) await finishImport()
  } catch (caught) { report(caught) }
  finally { busy.value = false }
}
async function finishImport() {
  if (!importPlan.value) return
  busy.value = true
  try {
    const plan = importPlan.value
    const count = await applyCameraImport(plan, choices.value)
    importPlan.value = null
    await reload()
    channel?.postMessage('changed')
    emit('status', t('已导入 ' + count + ' 条，已合并标签及排序；重复或保留本地 ' + (plan.incoming.records.length + plan.skipped - count) + ' 条', 'Imported ' + count + '; tags and order merged; skipped or kept local: ' + (plan.incoming.records.length + plan.skipped - count)), 'success')
  } catch (caught) { report(caught) }
  finally { busy.value = false }
}
function modalKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && !busy.value) {
    event.preventDefault(); event.stopPropagation()
    if (isAddingTag.value) { closeTagInput(); tagToggle.value?.focus() }
    else if (editor.value) closeEditor()
    else importPlan.value = null
  }
  if (event.key !== 'Tab' || !form.value) return
  const elements = [...form.value.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]')]
  const first = elements[0], last = elements[elements.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
function focusRefresh() { if (!busy.value) void reload() }
onMounted(() => {
  void reload()
  if (typeof BroadcastChannel !== 'undefined') {
    channel = new BroadcastChannel('nikki-camera-favorites')
    channel.onmessage = () => { void reload() }
  }
  document.addEventListener('pointerdown', tagOutsideClick)
  window.addEventListener('resize', updateTagPosition)
  window.addEventListener('scroll', updateTagPosition, true)
  window.addEventListener('focus', focusRefresh)
})
onBeforeUnmount(() => {
  disposed = true; cancelAutoParse(); loadGeneration++; channel?.close()
  releaseBackupDownloads()
  document.removeEventListener('pointerdown', tagOutsideClick)
  window.removeEventListener('resize', updateTagPosition)
  window.removeEventListener('scroll', updateTagPosition, true)
  window.removeEventListener('focus', focusRefresh)
  releaseUrls()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})
async function resetLibrary() {
  cancelAutoParse()
  releaseBackupDownloads()
  importPlan.value = null
  tagOrder.value = []
  tagFilter.value = 'all'
  detail.value = null
  closeEditor()
  await reload()
  channel?.postMessage('changed')
}
defineExpose({ openFromResult, resetLibrary, reload })
</script>

<template>
  <Teleport v-if="active" :to="sidebarTarget || 'body'" :disabled="!sidebarTarget">
    <OutfitSidebar :language="language" ref="sidebar" :outfits="sidebarRecords" :tags="allTags" :active-filter="tagFilter" :picker-open="filtersOpen" :disabled="busy" :messages="tagMessages" :show-pending="false" :max-tag-length="60" @change-filter="tagFilter = $event" @filter-selected="$emit('closeFilters')" @add-tag="addTag($event)" @delete-tag="removeTag" @reorder-tags="reorderTags" />
  </Teleport>
  <section v-show="active" class="camera-favorites">
    <div v-if="backupDownloads.length > 1" class="camera-backup-downloads">
      <p>{{ t('备份已自动分包；如浏览器未下载全部文件，请逐个点击保存。每个 ZIP 均可独立导入。', 'The backup was split. If your browser blocked downloads, save each file below. Each ZIP can be imported independently.') }}</p>
      <a v-for="part in backupDownloads" :key="part.fileName" :href="part.url" :download="part.fileName">{{ part.fileName }}</a>
      <button type="button" @click="releaseBackupDownloads">{{ t('关闭', 'Close') }}</button>
    </div>
    <!-- 操作按钮移至收藏夹标签行，保持组件内的原有事件和状态。 -->
    <Teleport v-if="active" :to="actionsTarget || 'body'" :disabled="!actionsTarget">
      <CollectionActions :label="t('收藏操作', 'Favorite actions')"><button class="primary-button" type="button" :disabled="busy" @click="openEditor()"><Plus :size="15" />{{ t('添加收藏', 'Add favorite') }}</button><template #secondary>
        <input ref="backupInput" type="file" accept=".zip,application/zip" hidden @change="importBackup" />
        <button type="button" :disabled="busy" @click="backupInput?.click()"><Download :size="15" />{{ t('导入', 'Import') }}</button>
        <button type="button" :disabled="busy || (!library.records.length && !allTags.length)" @click="exportBackup"><Upload :size="15" />{{ t('导出', 'Export') }}</button>

</template></CollectionActions>
    </Teleport>
    <CollectionFilterBar tag-picker :entries="[{ key: 'all', label: t('全部', 'All') }, { key: 'uncategorized', label: t('未分类', 'Uncategorized') }, ...allTags.map(tag => ({ key: 'tag:' + tag, label: tag }))]" :active="tagFilter" :count="visibleRecords.length" :language="language" :disabled="busy" @change="tagFilter = $event as OutfitFilter" @clear="tagFilter = 'all'" @open="$emit('openFilters')" />
    <p v-if="loadError" role="alert">{{ loadError }} <button type="button" @click="reload">{{ t('重试', 'Retry') }}</button></p>
    <p v-if="!visibleRecords.length && !loadError" class="camera-empty">{{ t('暂无相机参数。添加参数码，或从照片参数窗口收藏。', 'No camera parameters yet. Add a code or save from photo parameters.') }}<button class="mobile-only empty-import-button" type="button" :disabled="busy" @click="backupInput?.click()">{{ t('导入备份', 'Import backup') }}</button></p>
    <div class="camera-favorite-grid">
      <article v-for="item in visibleRecords" :key="item.id" class="photo-card camera-favorite-card"
        :class="{ selected: selectedIds.has(item.id) }" role="checkbox" :aria-checked="selectedIds.has(item.id)" :aria-label="item.name" :aria-disabled="busy" tabindex="0"
        @click="toggleSelected(item.id)" @keydown="cardKeydown($event, item.id)">
        <div class="camera-cover">
          <img v-if="urls[item.id]" :src="urls[item.id]" :alt="item.name" loading="lazy" />
          <div v-else-if="resources(item.result).length" class="camera-resources">
            <div v-for="group in resources(item.result)" :key="group.kind">
              <img v-if="group.imageUrl" :src="group.imageUrl" :alt="group.name" loading="lazy" @error="($event.target as HTMLImageElement).style.visibility = 'hidden'" />
              <ScanSearch v-else :size="24" aria-hidden="true" />
              <small>{{ group.title }}</small><strong>{{ group.name }}</strong>
            </div>
          </div>
          <Camera v-else :size="34" class="camera-placeholder" aria-hidden="true" />
          <!-- 标记常驻，通过公共选中样式切换，保留淡入与缩放动画。 -->
          <span class="selected-badge"><Check :size="15" aria-hidden="true" /></span>
          <CardActions :label="t('收藏操作', 'Favorite actions')" :title="item.name" :close-label="t('关闭', 'Close')" :disabled="busy">          <button class="outfit-card-delete camera-card-delete" type="button" :title="t('删除', 'Delete')" :aria-label="t('删除', 'Delete')" :disabled="busy" @click.stop="remove(item)">
            <Trash2 :size="16" aria-hidden="true" /><span class="mobile-only">{{ t('删除', 'Delete') }}</span>
          </button><button class="mobile-only" type="button" :disabled="busy" @click.stop="openEditor(item)"><Edit3 :size="18" />{{ t('编辑', 'Edit') }}</button><button class="mobile-only" type="button" @click.stop="detail = item"><ScanSearch :size="18" />{{ t('详情', 'Details') }}</button></CardActions>
        </div>
        <div class="camera-card-content">
          <div class="camera-name-tags"><h3>{{ item.name }}</h3><div><span v-if="item.tag" :title="item.tag">{{ item.tag }}</span></div></div>
          <code class="camera-code">{{ item.result.rawCameraParams }}</code>
        </div>
        <footer><span>{{ item.source === 'manual' ? t('手动收藏', 'Manual') : t('照片解析', 'Photo parsing') }}</span><div class="outfit-card-actions">
          <button type="button" :title="t('复制', 'Copy')" :aria-label="t('复制', 'Copy')" :disabled="busy" @click.stop="copy(item.result.rawCameraParams)"><Copy :size="15" aria-hidden="true" /></button>
          <button class="desktop-only" type="button" :title="t('编辑', 'Edit')" :aria-label="t('编辑', 'Edit')" :disabled="busy" @click.stop="openEditor(item)"><Edit3 :size="15" aria-hidden="true" /></button>
          <button class="desktop-only" type="button" :title="t('详情', 'Details')" :aria-label="t('详情', 'Details')" :disabled="busy" @click.stop="detail = item"><ScanSearch :size="15" aria-hidden="true" /></button>
        </div></footer>
      </article>
    </div>
    <SelectionBar v-if="active && !modal" mode="outfit" :selected-count="selectedRecords.length" :all-selected="allSelected" :all-items-selected="allSelected" :all-selected-favorited="false" :is-busy="busy" :messages="selectionMessages" @toggle-all="toggleAll" @delete="removeSelected" @cancel="selectedIds = new Set()" />
  </section>

  <Teleport to="body">
    <Transition name="confirm-dialog">
      <div v-if="editor" class="outfit-editor camera-editor-overlay" @keydown="modalKey" @click.self="closeEditor">
        <form ref="form" class="outfit-editor-panel camera-favorite-editor" role="dialog" aria-modal="true" aria-labelledby="camera-editor-title" @submit.prevent="save">
          <header>
            <h2 id="camera-editor-title">{{ editing ? t('编辑相机参数', 'Edit camera favorite') : t('收藏相机参数', 'Save camera parameters') }}</h2>
            <button type="button" :disabled="busy" :title="t('关闭', 'Close')" :aria-label="t('关闭', 'Close')" @click="closeEditor"><X :size="19" aria-hidden="true" /></button>
          </header>
          <fieldset class="outfit-editor-content camera-favorite-editor-body" :disabled="busy">
            <div class="outfit-image-column">
              <label id="camera-cover-label">{{ t('封面（可选）', 'Cover (optional)') }}</label>
              <button class="outfit-image-dropzone camera-cover-dropzone" type="button" aria-labelledby="camera-cover-label" @click="coverInput?.click()">
                <img v-if="previewUrl" class="camera-editor-preview" :src="previewUrl" :alt="t('封面预览', 'Cover preview')" />
                <span v-else class="outfit-image-prompt"><ImagePlus :size="30" aria-hidden="true" />{{ t('点击选择封面图片', 'Click to choose a cover') }}</span>
                <span v-if="previewUrl" class="outfit-replace-image"><Upload :size="15" aria-hidden="true" />{{ t('更换封面', 'Replace cover') }}</span>
              </button>
              <input id="camera-favorite-cover" ref="coverInput" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden @change="selectCover" />
              <div v-if="cover" class="outfit-tag-choices camera-cover-tools"><button type="button" @click="setCover(null)"><X :size="14" aria-hidden="true" />{{ t('移除封面', 'Remove cover') }}</button></div>
              <p class="camera-cover-hint">{{ t('封面统一保存为 WebP；不添加时展示已解析的动作、灯光和滤镜。', 'All covers are saved as WebP. Without a cover, parsed action, lighting and filter resources are shown.') }}</p>
              <div v-if="parsed && resources(parsed).length" class="camera-parsed-summary"><span v-for="group in resources(parsed)" :key="group.kind">{{ group.title }} · {{ group.name }}</span></div>
            </div>
            <div class="outfit-fields">
              <label for="camera-favorite-code">{{ t('相机参数码', 'Camera parameter code') }}</label>
              <textarea id="camera-favorite-code" v-model="code" maxlength="100000" rows="3" :placeholder="t('粘贴相机参数码', 'Paste a camera parameter code')" required />
              <div class="camera-parse-status" aria-live="polite"><span>{{ parsing ? t('解析中…', 'Parsing…') : parsed ? '' : t('输入参数码后自动解析', 'Parameters are parsed automatically after input') }}</span></div>
              <label for="camera-favorite-name">{{ t('名称', 'Name') }}</label>
              <input id="camera-favorite-name" v-model="name" maxlength="200" required />
              <fieldset class="camera-editor-tags">
                <legend>{{ tagMessages.tagLabel }}</legend>
                <div class="outfit-tag-choices">
                  <button v-for="tag in editorTags" :key="tag" type="button" :class="{ active: selectedTag === tag }" :aria-pressed="selectedTag === tag" @click="toggleTag(tag)">{{ tag }}</button>
                  <button ref="tagToggle" class="outfit-editor-add-tag" type="button" :title="tagMessages.addTag" :aria-label="tagMessages.addTag" :disabled="allTags.length >= 40" @click="isAddingTag ? closeTagInput() : openTagInput()"><Plus class="tag-toggle-icon" :class="{ 'is-open': isAddingTag }" :size="15" aria-hidden="true" /></button>
                </div>
                <p v-if="!editorTags.length">{{ tagMessages.noTag }}</p>
                <Transition name="outfit-tag-editor">
                  <div v-if="isAddingTag" ref="tagPopover" class="outfit-tag-editor outfit-tag-editor-popover camera-tag-popover" :style="tagPosition" @keydown.enter.stop.prevent="addTag(newTag, true)">
                    <input ref="tagInput" v-model="newTag" maxlength="60" :placeholder="tagMessages.tagPlaceholder" :aria-label="tagMessages.addTag" autocomplete="off" />
                    <button type="button" @click="addTag(newTag, true)">{{ tagMessages.confirmAddTag }}</button>
                  </div>
                </Transition>
              </fieldset>
              <p v-if="error" class="outfit-editor-error" role="alert">{{ error }}</p>
            </div>
          </fieldset>
          <footer>
            <button class="confirm-dialog-button ghost" type="button" :disabled="busy" @click="closeEditor">{{ t('取消', 'Cancel') }}</button>
            <button class="confirm-dialog-button primary" type="submit" :disabled="busy || parsing || !parsed || !name.trim()">{{ busy ? t('保存中…', 'Saving…') : t('保存收藏', 'Save favorite') }}</button>
          </footer>
        </form>
      </div>
    </Transition>
  </Teleport>
  <CameraImportConflictDialog :plan="importPlan" :language="language" :disabled="busy" :error="error" @confirm="choices = $event; finishImport()" @cancel="importPlan = null" />
  <PhotoParamsDialog :visible="!!detail" :photo="detail ? { name: detail.name } : null" :progress="{ stage: 'ready', percent: 100, message: '' }" :result="detail?.result ?? null" :error="null" :uid-required="false" :messages="messages" :saved="true" :favorite-label="t('已收藏', 'Saved')" @close="detail = null" @copy="detail && copy(detail.result.rawCameraParams)" />
</template>

<style scoped>
.camera-backup-downloads { display: grid; gap: 8px; margin: 12px 0; padding: 12px; border: 1px solid var(--line); border-radius: var(--ui-radius); }
.camera-favorites{min-width:0}.camera-favorites h2 small{font-size:13px;color:var(--muted);margin-left:8px}.camera-tags-filter{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}.camera-tags-filter button{border:1px solid var(--line);border-radius:16px;padding:6px 12px;background:var(--surface-strong);color:var(--text)}.camera-tags-filter button[aria-pressed=true]{border-color:var(--pink-deep);color:var(--pink-deep)}.camera-empty{padding:60px 20px;text-align:center;color:var(--muted)}.camera-favorite-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;padding:10px 0 100px}

.camera-favorite-card{display:flex;flex-direction:column;min-width:0;padding:10px;border-radius:18px}.camera-cover{position:relative;aspect-ratio:16/9;border-radius:12px;background:color-mix(in srgb,var(--pink-deep) 7%,var(--surface-strong));display:grid;place-items:center}.camera-cover>img{width:100%;height:100%;object-fit:cover;border-radius:12px;position:absolute}.camera-placeholder{color:var(--muted);opacity:.5}.camera-resources{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px;box-sizing:border-box}.camera-resources>div{flex:1;min-width:0;display:flex;align-items:center;flex-direction:column;gap:7px;text-align:center}.camera-resources img{width:100%;max-width:84px;height:58px;object-fit:contain}.camera-resources small{font-size:10px;color:var(--muted)}.camera-resources strong{font-size:12px;overflow-wrap:anywhere;color:var(--heading);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.camera-card-delete{right:8px}.camera-card-content{padding:12px 2px}.camera-name-tags{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;min-height:28px}.camera-name-tags h3{margin:0;font-size:14px;color:var(--heading);overflow-wrap:anywhere;min-width:0}.camera-name-tags>div{display:flex;flex-wrap:wrap;gap:4px;justify-content:flex-end;max-width:50%;flex-shrink:0}.camera-name-tags span{padding:3px 7px;border-radius:7px;background:color-mix(in srgb,var(--pink-deep) 10%,var(--surface-strong));color:var(--pink-deep);font-size:10px;overflow-wrap:anywhere;max-width:100%}.camera-code{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere;line-height:1.6;height:3.2em;font-size:11px;margin-top:9px;color:var(--muted)}.camera-favorite-card footer{margin-top:auto;border-top:1px solid var(--line);display:flex;justify-content:space-between;align-items:center;gap:6px;padding:10px 2px 0;font-size:11px;color:var(--muted)}.camera-editor-overlay{z-index:1600}.camera-editor{width:min(740px,calc(100vw - 28px));max-height:90dvh;overflow:auto;padding:24px;box-sizing:border-box;border-radius:20px;background:var(--surface-strong);color:var(--text)}.camera-editor header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:20px}.camera-editor h2{font-size:21px;margin:0}.camera-editor button{border:1px solid var(--line);border-radius:9px;padding:9px 13px;background:var(--surface-strong);color:var(--text)}.camera-editor button.primary-button{background:var(--pink-deep);color:white;border-color:var(--pink-deep)}.camera-editor button:disabled{opacity:.5;cursor:not-allowed}.camera-editor fieldset{padding:0;border:0;min-width:0}.camera-editor label{display:block;font-size:12px;font-weight:700;margin:12px 0 8px}.camera-editor input,.camera-editor textarea,.camera-editor select{box-sizing:border-box;width:100%;padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--text);font:inherit}.camera-editor textarea{resize:vertical;overflow-wrap:anywhere;font-size:12px}.camera-parse-status{display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--muted);margin-top:8px}.camera-editor-fields{display:grid;grid-template-columns:1fr 1fr;gap:24px}.camera-editor-preview{width:100%;max-height:150px;object-fit:contain;border-radius:10px}.camera-editor input[type=file]{font-size:11px;margin-bottom:8px}.camera-editor footer{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);margin-top:24px;padding-top:18px}.camera-error{color:var(--notice-error,#b53d56);font-size:13px}.camera-parsed-summary{display:flex;flex-wrap:wrap;gap:10px;font-size:12px;color:var(--muted);margin-top:10px}.camera-conflict{display:flex!important;gap:16px;justify-content:space-between;padding:12px 0;border-bottom:1px solid var(--line)}.camera-conflict small{display:block;color:var(--muted);font-weight:normal;font-size:10px;margin-top:6px}.camera-conflict select{max-width:150px}button,summary{cursor:pointer}@media(max-width:560px){.camera-favorite-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.camera-editor{padding:18px}.camera-editor-fields{grid-template-columns:1fr;gap:6px}.camera-favorite-card{max-width:100%}}

.camera-favorite-editor-body{margin:0;min-width:0;border:0}
.camera-cover-dropzone{aspect-ratio:16/9}
.camera-cover-dropzone .camera-editor-preview{max-height:none;border-radius:0}
.camera-cover-tools{margin-top:8px}
.camera-cover-tools button{display:inline-flex;align-items:center;gap:6px}
.camera-cover-hint{color:var(--muted);font-size:12px;line-height:1.6;margin:12px 0}
.camera-favorite-editor .outfit-fields>textarea{box-sizing:border-box;height:124px;min-height:124px;max-height:124px;padding:10px;resize:none;overflow-y:auto;overflow-wrap:anywhere;font:inherit;font-size:12px}
.camera-favorite-editor .camera-parse-status{gap:8px;margin:0px 0 12px}
@media(max-width:850px){.camera-favorite-editor-body{grid-template-columns:1fr}}
.camera-tag-popover{z-index:1601}
.camera-editor-tags .outfit-tag-choices button{max-width:100%;overflow-wrap:anywhere}

@media (max-width: 560px) {
  .camera-favorite-card { padding: 6px; border-radius: 12px; }
  .camera-card-content { padding: 8px 0; }
  .camera-name-tags { gap: 6px; }
  .camera-name-tags h3 { font-size: 12px; }
  .camera-name-tags span { padding: 3px 4px; }
  .camera-favorite-card footer {
    flex-direction: column;
    align-items: stretch;
    padding: 8px 0 0;
    overflow-wrap: anywhere;
  }
  .camera-favorite-card footer .outfit-card-actions { justify-content: flex-end; }
  .camera-resources { gap: 4px; padding: 6px; }
  .camera-resources > div { gap: 4px; }
  .camera-resources img { height: 36px; }
  .camera-resources strong { font-size: 10px; }
}
</style>
