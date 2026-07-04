<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TopBar from './components/TopBar.vue'
import DateSidebar from './components/DateSidebar.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import Lightbox from './components/Lightbox.vue'
import { groupDatesByYear, groupPhotosByDate, type PhotoItem } from './utils/dateGrouping'
import {
  clearSavedAlbumDirectoryHandle,
  deletePhotoFile,
  getSavedAlbumDirectoryHandle,
  pickAlbumDirectory,
  readAlbumDirectory,
  releasePhotoUrls,
  type AlbumDirectoryResult
} from './utils/fileSystem'
import { isThumbnailMode, type ThumbnailMode } from './types/thumbnail'
import { DEFAULT_LANGUAGE, getThumbnailModeOptions, messages, type Language, type StatusPrefix, type StatusSuffix } from './i18n'

const THUMBNAIL_STORAGE_KEY = 'infinity-nikki-thumbnail-mode'
const storedThumbnailMode = localStorage.getItem(THUMBNAIL_STORAGE_KEY)

type DirectoryState =
  | { type: 'none' }
  | { type: 'remembered'; name: string }
  | { type: 'selected'; name: string }

type StatusState =
  | { type: 'initial' }
  | { type: 'reading' }
  | { type: 'restoring' }
  | { type: 'restoreFailed' }
  | { type: 'restorePathFailed' }
  | { type: 'readFailed' }
  | { type: 'cleared' }
  | { type: 'success'; count: number; prefix: StatusPrefix; suffix?: StatusSuffix }
  | { type: 'deleted'; deletedCount: number; failedNames: string[] }
  | { type: 'custom'; message: string }

const photos = ref<PhotoItem[]>([])
const selectedIds = ref<Set<string>>(new Set())
const currentPreview = ref<PhotoItem | null>(null)
const language = ref<Language>(DEFAULT_LANGUAGE)
const directoryState = ref<DirectoryState>({ type: 'none' })
const statusState = ref<StatusState>({ type: 'initial' })
const isLoading = ref(false)
const isDeleting = ref(false)
const thumbnailMode = ref<ThumbnailMode>(isThumbnailMode(storedThumbnailMode) ? storedThumbnailMode : 'default')

const locale = computed(() => messages[language.value])
const dateGroups = computed(() => groupPhotosByDate(photos.value))
const formattedDateGroups = computed(() =>
  dateGroups.value.map((group) => ({
    ...group,
    displayDate: locale.value.date.displayDate(group.dateKey),
    monthDay: locale.value.date.monthDay(group.dateKey)
  }))
)
const yearGroups = computed(() => groupDatesByYear(formattedDateGroups.value))
const selectedCount = computed(() => selectedIds.value.size)
const totalCount = computed(() => photos.value.length)
const allSelected = computed(() => totalCount.value > 0 && selectedCount.value === totalCount.value)
const thumbnailModeOptions = computed(() => getThumbnailModeOptions(language.value))
const directoryName = computed(() => {
  if (directoryState.value.type === 'remembered') return locale.value.app.rememberedDirectory(directoryState.value.name)
  if (directoryState.value.type === 'selected') return directoryState.value.name
  return locale.value.app.noDirectory
})
const statusMessage = computed(() => {
  const app = locale.value.app
  const state = statusState.value

  switch (state.type) {
    case 'reading':
      return app.readingStatus
    case 'restoring':
      return app.restoringStatus
    case 'restoreFailed':
      return app.restoreFailedStatus
    case 'restorePathFailed':
      return app.restorePathFailedStatus
    case 'readFailed':
      return app.readFailedStatus
    case 'cleared':
      return app.clearedStatus
    case 'success':
      return `${app.successStatus(state.count, state.prefix)}${state.suffix ? app.successSuffix(state.suffix) : ''}`
    case 'deleted':
      return app.deletedStatus(state.deletedCount, state.failedNames)
    case 'custom':
      return state.message
    default:
      return app.initialStatus
  }
})
const currentPreviewIndex = computed(() => {
  if (!currentPreview.value) return -1
  return photos.value.findIndex((photo) => photo.id === currentPreview.value?.id)
})
const hasPreviousPreview = computed(() => currentPreviewIndex.value > 0)
const hasNextPreview = computed(() => currentPreviewIndex.value >= 0 && currentPreviewIndex.value < photos.value.length - 1)

watch(
  language,
  (nextLanguage) => {
    document.documentElement.lang = nextLanguage === 'zh' ? 'zh-CN' : 'en'
  },
  { immediate: true }
)

function replaceAlbum(result: AlbumDirectoryResult, nextStatus: StatusState) {
  releasePhotoUrls(photos.value)
  selectedIds.value = new Set()
  currentPreview.value = null
  photos.value = result.photos
  directoryState.value = { type: 'selected', name: result.directoryName }
  statusState.value = nextStatus
}

function toggleLanguage() {
  language.value = language.value === 'zh' ? 'en' : 'zh'
}

async function restoreSavedDirectory() {
  const savedHandle = await getSavedAlbumDirectoryHandle()
  if (!savedHandle) return

  directoryState.value = { type: 'remembered', name: savedHandle.name }
  isLoading.value = true
  statusState.value = { type: 'restoring' }

  try {
    const result = await readAlbumDirectory(savedHandle, { requestPermission: false, messages: locale.value.fileSystem })
    replaceAlbum(result, { type: 'success', count: result.photos.length, prefix: 'restored' })
  } catch (error) {
    statusState.value = error instanceof Error ? { type: 'custom', message: error.message } : { type: 'restoreFailed' }
  } finally {
    isLoading.value = false
  }
}

async function chooseDirectory() {
  isLoading.value = true
  statusState.value = { type: 'reading' }

  try {
    const savedHandle = await getSavedAlbumDirectoryHandle()
    if (savedHandle && !photos.value.length) {
      try {
        const restored = await readAlbumDirectory(savedHandle, { requestPermission: true, messages: locale.value.fileSystem })
        replaceAlbum(restored, { type: 'success', count: restored.photos.length, prefix: 'restored', suffix: 'continued' })
        return
      } catch {
        statusState.value = { type: 'restorePathFailed' }
      }
    }

    const result = await pickAlbumDirectory(locale.value.fileSystem)
    replaceAlbum(result, { type: 'success', count: result.photos.length, prefix: 'read', suffix: 'remembered' })
  } catch (error) {
    statusState.value = error instanceof Error ? { type: 'custom', message: error.message } : { type: 'readFailed' }
  } finally {
    isLoading.value = false
  }
}

async function clearDirectory() {
  await clearSavedAlbumDirectoryHandle()
  releasePhotoUrls(photos.value)
  photos.value = []
  selectedIds.value = new Set()
  currentPreview.value = null
  directoryState.value = { type: 'none' }
  statusState.value = { type: 'cleared' }
}

function changeThumbnailMode(mode: ThumbnailMode) {
  thumbnailMode.value = mode
  localStorage.setItem(THUMBNAIL_STORAGE_KEY, mode)
}

function toggleAll() {
  if (allSelected.value) {
    selectedIds.value = new Set()
    return
  }

  selectedIds.value = new Set(photos.value.map((photo) => photo.id))
}

function togglePhoto(photoId: string) {
  const next = new Set(selectedIds.value)
  if (next.has(photoId)) {
    next.delete(photoId)
  } else {
    next.add(photoId)
  }
  selectedIds.value = next
}

function toggleDate(dateKey: string) {
  const group = dateGroups.value.find((item) => item.dateKey === dateKey)
  if (!group) return

  const next = new Set(selectedIds.value)
  const isWholeDaySelected = group.photos.every((photo) => next.has(photo.id))

  for (const photo of group.photos) {
    if (isWholeDaySelected) {
      next.delete(photo.id)
    } else {
      next.add(photo.id)
    }
  }

  selectedIds.value = next
}

async function deletePhotos(targets: PhotoItem[], confirmMessage: string, keepPreviewOpen = false) {
  if (!targets.length || isDeleting.value) return
  if (!window.confirm(confirmMessage)) return

  isDeleting.value = true
  const deletedIds = new Set<string>()
  const failedNames: string[] = []
  const previewIndexBeforeDelete = currentPreviewIndex.value

  for (const photo of targets) {
    try {
      await deletePhotoFile(photo)
      deletedIds.add(photo.id)
    } catch {
      failedNames.push(photo.name)
    }
  }

  const remainingPhotos = photos.value.filter((photo) => !deletedIds.has(photo.id))
  const deletedCurrentPreview = currentPreview.value ? deletedIds.has(currentPreview.value.id) : false

  photos.value = remainingPhotos
  selectedIds.value = new Set([...selectedIds.value].filter((id) => !deletedIds.has(id)))

  if (deletedCurrentPreview) {
    currentPreview.value = keepPreviewOpen
      ? remainingPhotos[Math.min(previewIndexBeforeDelete, remainingPhotos.length - 1)] ?? null
      : null
  }

  statusState.value = { type: 'deleted', deletedCount: deletedIds.size, failedNames }

  isDeleting.value = false
}

async function deleteSelectedPhotos() {
  const targets = photos.value.filter((photo) => selectedIds.value.has(photo.id))
  await deletePhotos(targets, locale.value.app.confirmDeleteSelected(targets.length))
}

async function deleteCurrentPreview() {
  if (!currentPreview.value) return
  await deletePhotos([currentPreview.value], locale.value.app.confirmDeleteCurrent, true)
}

function scrollToDate(dateKey: string) {
  document.getElementById(`date-${dateKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function openPreview(photo: PhotoItem) {
  currentPreview.value = photo
}

function closePreview() {
  currentPreview.value = null
}

function showPreviousPreview() {
  if (!hasPreviousPreview.value) return
  currentPreview.value = photos.value[currentPreviewIndex.value - 1]
}

function showNextPreview() {
  if (!hasNextPreview.value) return
  currentPreview.value = photos.value[currentPreviewIndex.value + 1]
}

onMounted(() => {
  restoreSavedDirectory()
})

onBeforeUnmount(() => {
  releasePhotoUrls(photos.value)
})
</script>

<template>
  <div class="app-shell">
    <TopBar
      :directory-name="directoryName"
      :total-count="totalCount"
      :selected-count="selectedCount"
      :all-selected="allSelected"
      :is-loading="isLoading"
      :is-deleting="isDeleting"
      :thumbnail-mode="thumbnailMode"
      :thumbnail-mode-options="thumbnailModeOptions"
      :language="language"
      :messages="locale.topBar"
      @choose-directory="chooseDirectory"
      @clear-directory="clearDirectory"
      @toggle-all="toggleAll"
      @delete-selected="deleteSelectedPhotos"
      @change-thumbnail-mode="changeThumbnailMode"
      @toggle-language="toggleLanguage"
    />

    <main class="album-layout">
      <DateSidebar :year-groups="yearGroups" :messages="locale.sidebar" @jump-to-date="scrollToDate" />

      <section class="album-content" :aria-label="locale.app.albumContentAria">
        <div class="status-card">
          <div>
            <p class="eyebrow">{{ locale.app.statusEyebrow }}</p>
            <h2>{{ totalCount ? locale.app.totalPhotos(totalCount) : locale.app.waitingTitle }}</h2>
          </div>
          <p>{{ statusMessage }}</p>
        </div>

        <PhotoGrid
          :date-groups="formattedDateGroups"
          :selected-ids="selectedIds"
          :thumbnail-mode="thumbnailMode"
          :messages="locale.grid"
          @toggle-photo="togglePhoto"
          @toggle-date="toggleDate"
          @open-preview="openPreview"
        />
      </section>
    </main>

    <Lightbox
      :photo="currentPreview"
      :has-previous="hasPreviousPreview"
      :has-next="hasNextPreview"
      :is-deleting="isDeleting"
      :messages="locale.lightbox"
      :date-messages="locale.date"
      @close="closePreview"
      @previous="showPreviousPreview"
      @next="showNextPreview"
      @delete-current="deleteCurrentPreview"
    />
  </div>
</template>
