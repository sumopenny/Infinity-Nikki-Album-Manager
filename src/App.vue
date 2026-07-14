<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import TopBar from './components/TopBar.vue'
import DateSidebar from './components/DateSidebar.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import Lightbox from './components/Lightbox.vue'
import ConfirmDialog, { type ConfirmDialogTone } from './components/ConfirmDialog.vue'
import OperationNotice, { type OperationNoticeTone } from './components/OperationNotice.vue'
import { groupDatesByYear, groupPhotosByDate, type PhotoItem } from './utils/dateGrouping'
import {
  clearSavedAlbumDirectoryHandle,
  clearSavedX6GameDirectoryHandle,
  deletePhotoFile,
  executeRelatedPhotoCleanup,
  getSavedAlbumDirectoryHandle,
  pickAlbumDirectory,
  prepareRelatedPhotoCleanup,
  readAlbumDirectory,
  releasePhotoUrls,
  type AlbumDirectoryResult
} from './utils/fileSystem'
import { isThumbnailMode, type ThumbnailMode } from './types/thumbnail'
import { DEFAULT_LANGUAGE, getThumbnailModeOptions, messages, type Language, type StatusPrefix, type StatusSuffix } from './i18n'
import { isThemeMode, type ThemeMode } from './types/theme'

const THUMBNAIL_STORAGE_KEY = 'infinity-nikki-thumbnail-mode'
const THEME_STORAGE_KEY = 'infinity-nikki-theme-mode'
const FAVORITES_STORAGE_KEY = 'infinity-nikki-favorite-photo-ids'
const storedThumbnailMode = localStorage.getItem(THUMBNAIL_STORAGE_KEY)
const storedThemeMode = localStorage.getItem(THEME_STORAGE_KEY)

function readStoredFavoriteIds(): Set<string> {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_STORAGE_KEY) ?? '[]')
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [])
  } catch {
    return new Set()
  }
}

type DirectoryState =
  | { type: 'none' }
  | { type: 'remembered'; name: string }
  | { type: 'selected'; name: string }

type StatusTone = OperationNoticeTone

interface ConfirmDialogState {
  visible: boolean
  title: string
  message: string
  tone: ConfirmDialogTone
  confirmLabel: string
  cancelLabel?: string
  resolve?: (confirmed: boolean) => void
}

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
  | { type: 'custom'; message: string; tone?: StatusTone; loading?: boolean }

const photos = ref<PhotoItem[]>([])
const selectedIds = ref<Set<string>>(new Set())
const favoriteIds = ref<Set<string>>(readStoredFavoriteIds())
const showFavoritesOnly = ref(false)
const currentPreview = ref<PhotoItem | null>(null)
const language = ref<Language>(DEFAULT_LANGUAGE)
const directoryState = ref<DirectoryState>({ type: 'none' })
const statusState = ref<StatusState>({ type: 'initial' })
const isStatusNoticeVisible = ref(false)
const isLoading = ref(false)
const isDeleting = ref(false)
const isCleaningRelatedPhotos = ref(false)
const confirmDialog = ref<ConfirmDialogState>({
  visible: false,
  title: '',
  message: '',
  tone: 'info',
  confirmLabel: ''
})
const albumDirectoryHandle = ref<FileSystemDirectoryHandle | null>(null)
const thumbnailMode = ref<ThumbnailMode>(isThumbnailMode(storedThumbnailMode) ? storedThumbnailMode : 'default')
const themeMode = ref<ThemeMode>(isThemeMode(storedThemeMode) ? storedThemeMode : 'light')
const appShellRef = ref<HTMLElement | null>(null)
const topBarRef = ref<InstanceType<typeof TopBar> | null>(null)
let topBarResizeObserver: ResizeObserver | null = null
let statusNoticeTimer: number | undefined

const locale = computed(() => messages[language.value])
const favoritePhotos = computed(() => photos.value.filter((photo) => favoriteIds.value.has(photo.id)))
const visiblePhotos = computed(() => (showFavoritesOnly.value ? favoritePhotos.value : photos.value))
const dateGroups = computed(() => groupPhotosByDate(visiblePhotos.value))
const formattedDateGroups = computed(() =>
  dateGroups.value.map((group) => ({
    ...group,
    displayDate: locale.value.date.displayDate(group.dateKey),
    monthDay: locale.value.date.monthDay(group.dateKey)
  }))
)
const yearGroups = computed(() => groupDatesByYear(formattedDateGroups.value))
const selectedCount = computed(() => visiblePhotos.value.filter((photo) => selectedIds.value.has(photo.id)).length)
const totalCount = computed(() => photos.value.length)
const visibleCount = computed(() => visiblePhotos.value.length)
const favoriteCount = computed(() => favoritePhotos.value.length)
const allSelected = computed(
  () => visibleCount.value > 0 && visiblePhotos.value.every((photo) => selectedIds.value.has(photo.id))
)
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
const statusNoticeTone = computed<StatusTone>(() => {
  const state = statusState.value

  if (state.type === 'restoreFailed' || state.type === 'restorePathFailed' || state.type === 'readFailed') return 'error'
  if (state.type === 'deleted') return state.failedNames.length ? 'warning' : 'success'
  if (state.type === 'success' || state.type === 'cleared') return 'success'
  if (state.type === 'custom') return state.tone ?? 'info'
  return 'info'
})
const isStatusNoticeLoading = computed(() => {
  const state = statusState.value
  return state.type === 'reading' || state.type === 'restoring' || (state.type === 'custom' && Boolean(state.loading))
})
const currentPreviewIndex = computed(() => {
  if (!currentPreview.value) return -1
  return visiblePhotos.value.findIndex((photo) => photo.id === currentPreview.value?.id)
})
const hasPreviousPreview = computed(() => currentPreviewIndex.value > 0)
const hasNextPreview = computed(
  () => currentPreviewIndex.value >= 0 && currentPreviewIndex.value < visiblePhotos.value.length - 1
)

function clearStatusNoticeTimer() {
  if (statusNoticeTimer === undefined) return
  window.clearTimeout(statusNoticeTimer)
  statusNoticeTimer = undefined
}

function closeStatusNotice() {
  clearStatusNoticeTimer()
  isStatusNoticeVisible.value = false
}

// 打开自定义确认弹窗。参数：options 为弹窗文案、风格和按钮设置。返回用户是否确认。
function openConfirmDialog(options: Omit<ConfirmDialogState, 'visible' | 'resolve'>): Promise<boolean> {
  if (confirmDialog.value.visible) return Promise.resolve(false)

  return new Promise((resolve) => {
    confirmDialog.value = {
      ...options,
      visible: true,
      resolve
    }
  })
}

// 关闭自定义确认弹窗。参数：confirmed 表示用户是否点击确认按钮。
function closeConfirmDialog(confirmed: boolean) {
  const resolve = confirmDialog.value.resolve
  confirmDialog.value = {
    visible: false,
    title: '',
    message: '',
    tone: 'info',
    confirmLabel: ''
  }
  resolve?.(confirmed)
}

function createErrorStatus(error: unknown, fallback: StatusState): StatusState {
  if (!(error instanceof Error)) return fallback
  const tone: StatusTone = error.message === locale.value.fileSystem.abortSelection ? 'info' : 'error'
  return { type: 'custom', message: error.message, tone }
}

watch(statusState, (nextStatus) => {
  clearStatusNoticeTimer()

  if (nextStatus.type === 'initial') {
    isStatusNoticeVisible.value = false
    return
  }

  isStatusNoticeVisible.value = true
  if (isStatusNoticeLoading.value) return

  const duration = statusNoticeTone.value === 'error' || statusNoticeTone.value === 'warning' ? 7200 : 5200
  statusNoticeTimer = window.setTimeout(() => {
    isStatusNoticeVisible.value = false
    statusNoticeTimer = undefined
  }, duration)
})

watch(
  favoriteIds,
  (nextFavoriteIds) => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...nextFavoriteIds]))
  },
  { deep: true }
)

watch(
  language,
  (nextLanguage) => {
    document.documentElement.lang = nextLanguage === 'zh' ? 'zh-CN' : 'en'
  },
  { immediate: true }
)

watch(
  themeMode,
  (nextThemeMode) => {
    document.documentElement.dataset.theme = nextThemeMode
  },
  { immediate: true }
)

function replaceAlbum(result: AlbumDirectoryResult, nextStatus: StatusState) {
  releasePhotoUrls(photos.value)
  selectedIds.value = new Set()
  currentPreview.value = null
  photos.value = result.photos
  favoriteIds.value = new Set(result.photos.filter((photo) => favoriteIds.value.has(photo.id)).map((photo) => photo.id))
  if (showFavoritesOnly.value && !favoriteIds.value.size) showFavoritesOnly.value = false
  albumDirectoryHandle.value = result.directoryHandle
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
    statusState.value = createErrorStatus(error, { type: 'restoreFailed' })
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
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isLoading.value = false
  }
}

async function clearDirectory() {
  await clearSavedAlbumDirectoryHandle()
  await clearSavedX6GameDirectoryHandle()
  releasePhotoUrls(photos.value)
  photos.value = []
  selectedIds.value = new Set()
  currentPreview.value = null
  albumDirectoryHandle.value = null
  showFavoritesOnly.value = false
  directoryState.value = { type: 'none' }
  statusState.value = { type: 'cleared' }
}

// 切换缩略图尺寸。参数：mode 为目标缩略图模式，选择半尺寸时先提示性能风险。
async function changeThumbnailMode(mode: ThumbnailMode) {
  if (mode === 'half' && thumbnailMode.value !== 'half') {
    const confirmed = await openConfirmDialog({
      title: locale.value.app.halfThumbnailDialogTitle,
      message: locale.value.app.halfThumbnailDialogMessage,
      tone: 'warning',
      confirmLabel: locale.value.app.dialogConfirmChange,
      cancelLabel: locale.value.app.dialogCancel
    })
    if (!confirmed) return
  }

  thumbnailMode.value = mode
  localStorage.setItem(THUMBNAIL_STORAGE_KEY, mode)
}

function toggleTheme() {
  themeMode.value = themeMode.value === 'light' ? 'dark' : 'light'
  localStorage.setItem(THEME_STORAGE_KEY, themeMode.value)
}

// 切换当前视图内照片的全选状态。参数：无。收藏视图只影响当前可见的收藏照片。
function toggleAll() {
  const visibleIds = new Set(visiblePhotos.value.map((photo) => photo.id))

  if (allSelected.value) {
    selectedIds.value = new Set([...selectedIds.value].filter((id) => !visibleIds.has(id)))
    return
  }

  selectedIds.value = new Set([...selectedIds.value, ...visibleIds])
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

function toggleFavoritesOnly() {
  showFavoritesOnly.value = !showFavoritesOnly.value
  selectedIds.value = new Set()
  currentPreview.value = null
}

function toggleFavorite(photoId: string) {
  const next = new Set(favoriteIds.value)
  if (next.has(photoId)) {
    next.delete(photoId)
  } else {
    next.add(photoId)
  }

  favoriteIds.value = next
  if (showFavoritesOnly.value && !next.has(photoId)) selectedIds.value = new Set([...selectedIds.value].filter((id) => id !== photoId))
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
  if (!targets.length || isDeleting.value || isCleaningRelatedPhotos.value) return
  const confirmed = await openConfirmDialog({
    title: locale.value.app.deleteDialogTitle,
    message: confirmMessage,
    tone: 'danger',
    confirmLabel: locale.value.app.dialogConfirm,
    cancelLabel: locale.value.app.dialogCancel
  })
  if (!confirmed) return

  isDeleting.value = true
  const deletedIds = new Set<string>()
  const failedNames: string[] = []
  const previewIndexBeforeDelete = currentPreviewIndex.value
  const wasFavoritesView = showFavoritesOnly.value

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
  favoriteIds.value = new Set([...favoriteIds.value].filter((id) => !deletedIds.has(id)))
  if (showFavoritesOnly.value && !favoriteIds.value.size) showFavoritesOnly.value = false

  if (deletedCurrentPreview) {
    const remainingPreviewPhotos = wasFavoritesView ? favoritePhotos.value : photos.value
    currentPreview.value = keepPreviewOpen
      ? remainingPreviewPhotos[Math.min(previewIndexBeforeDelete, remainingPreviewPhotos.length - 1)] ?? null
      : null
  }

  statusState.value = { type: 'deleted', deletedCount: deletedIds.size, failedNames }

  isDeleting.value = false
}

async function deleteSelectedPhotos() {
  const targets = visiblePhotos.value.filter((photo) => selectedIds.value.has(photo.id))
  await deletePhotos(targets, locale.value.app.confirmDeleteSelected(targets.length))
}

async function deleteCurrentPreview() {
  if (!currentPreview.value) return
  await deletePhotos([currentPreview.value], locale.value.app.confirmDeleteCurrent, true)
}

async function cleanRelatedPhotos() {
  if (!albumDirectoryHandle.value || isLoading.value || isDeleting.value || isCleaningRelatedPhotos.value) return

  isCleaningRelatedPhotos.value = true
  statusState.value = { type: 'custom', message: locale.value.app.preparingRelatedCleanup, tone: 'info', loading: true }
  let didCancelDirectoryPrompt = false

  try {
    const plan = await prepareRelatedPhotoCleanup(albumDirectoryHandle.value, locale.value.fileSystem, {
      beforeRequestX6GamePermission: async () => {
        const confirmed = await openConfirmDialog({
          title: locale.value.app.x6GameDirectoryDialogTitle,
          message: locale.value.fileSystem.restoreX6GamePermissionPrompt,
          tone: 'info',
          confirmLabel: locale.value.app.dialogContinueAuthorization,
          cancelLabel: locale.value.app.dialogCancel
        })
        didCancelDirectoryPrompt = !confirmed
        return confirmed
      },
      beforePickX6GameDirectory: async () => {
        const confirmed = await openConfirmDialog({
          title: locale.value.app.x6GameDirectoryDialogTitle,
          message: locale.value.fileSystem.selectX6GameDirectoryPrompt,
          tone: 'info',
          confirmLabel: locale.value.app.dialogOk,
          cancelLabel: locale.value.app.dialogCancel
        })
        didCancelDirectoryPrompt = !confirmed
        return confirmed
      }
    })

    if (!plan.totalCount) {
      statusState.value = {
        type: 'custom',
        message: locale.value.app.noRelatedPhotos(plan.missingDirectories),
        tone: plan.missingDirectories.length ? 'warning' : 'info'
      }
      return
    }

    const confirmed = await openConfirmDialog({
      title: locale.value.app.relatedCleanupDialogTitle,
      message: locale.value.app.confirmRelatedCleanup(plan.totalCount, plan.missingDirectories),
      tone: 'warning',
      confirmLabel: locale.value.app.dialogConfirm,
      cancelLabel: locale.value.app.dialogCancel
    })

    if (!confirmed) {
      statusState.value = { type: 'custom', message: locale.value.app.relatedCleanupCancelledStatus, tone: 'info' }
      return
    }

    const result = await executeRelatedPhotoCleanup(plan)
    statusState.value = {
      type: 'custom',
      message: locale.value.app.relatedCleanupStatus(result.deletedCount, result.failedNames, result.missingDirectories),
      tone: result.failedNames.length || result.missingDirectories.length ? 'warning' : 'success'
    }
  } catch (error) {
    if (didCancelDirectoryPrompt) {
      statusState.value = { type: 'custom', message: locale.value.app.relatedCleanupCancelledStatus, tone: 'info' }
      return
    }
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isCleaningRelatedPhotos.value = false
  }
}

// 跳转到指定日期。参数：dateKey 为目标日期。
function scrollToDate(dateKey: string) {
  document.getElementById(`date-${dateKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function openPreview(photo: PhotoItem) {
  currentPreview.value = photo
}

function closePreview() {
  currentPreview.value = null
}

// 更新侧栏吸顶偏移量。参数：无。根据顶部工具栏实际高度设置 CSS 变量，避免侧栏滚动时被顶部栏遮住。
function updateSidebarStickyOffset() {
  const appShell = appShellRef.value
  const topBarElement = topBarRef.value?.$el as HTMLElement | undefined

  if (!appShell || !topBarElement) return

  // 预留 10px 间距，让左侧栏始终停在顶部工具栏下方。
  appShell.style.setProperty('--sidebar-sticky-top', `${Math.ceil(topBarElement.getBoundingClientRect().height) + 10}px`)
}

// 显示当前筛选结果中的上一张照片。参数：无。
function showPreviousPreview() {
  if (!hasPreviousPreview.value) return
  currentPreview.value = visiblePhotos.value[currentPreviewIndex.value - 1]
}

// 显示当前筛选结果中的下一张照片。参数：无。
function showNextPreview() {
  if (!hasNextPreview.value) return
  currentPreview.value = visiblePhotos.value[currentPreviewIndex.value + 1]
}

onMounted(() => {
  restoreSavedDirectory()
  nextTick(() => {
    updateSidebarStickyOffset()

    const topBarElement = topBarRef.value?.$el as HTMLElement | undefined
    if (!topBarElement || typeof ResizeObserver === 'undefined') return

    // 监听顶部工具栏换行、语言切换和窗口宽度变化造成的高度变化。
    topBarResizeObserver = new ResizeObserver(updateSidebarStickyOffset)
    topBarResizeObserver.observe(topBarElement)
  })
  window.addEventListener('resize', updateSidebarStickyOffset)
})

onBeforeUnmount(() => {
  clearStatusNoticeTimer()
  topBarResizeObserver?.disconnect()
  window.removeEventListener('resize', updateSidebarStickyOffset)
  releasePhotoUrls(photos.value)
})
</script>

<template>
  <div ref="appShellRef" class="app-shell">
    <TopBar
      ref="topBarRef"
      :directory-name="directoryName"
      :total-count="visibleCount"
      :selected-count="selectedCount"
      :all-selected="allSelected"
      :is-loading="isLoading"
      :is-deleting="isDeleting"
      :is-cleaning-related-photos="isCleaningRelatedPhotos"
      :has-album-directory="Boolean(albumDirectoryHandle)"
      :thumbnail-mode="thumbnailMode"
      :thumbnail-mode-options="thumbnailModeOptions"
      :theme-mode="themeMode"
      :language="language"
      :messages="locale.topBar"
      @choose-directory="chooseDirectory"
      @clear-directory="clearDirectory"
      @toggle-all="toggleAll"
      @clean-related-photos="cleanRelatedPhotos"
      @delete-selected="deleteSelectedPhotos"
      @change-thumbnail-mode="changeThumbnailMode"
      @toggle-language="toggleLanguage"
      @toggle-theme="toggleTheme"
    />

    <main class="album-layout">
      <div class="sidebar-column">
        <button
          class="favorites-button"
          type="button"
          :class="{ active: showFavoritesOnly }"
          :aria-pressed="showFavoritesOnly"
          @click="toggleFavoritesOnly"
        >
          <span>{{ showFavoritesOnly ? locale.app.showAllPhotos : locale.app.favoritesButton }}</span>
          <small>{{ locale.app.favoriteCount(favoriteCount) }}</small>
        </button>

        <div class="status-card">
          <div>
            <p class="eyebrow">{{ locale.app.statusEyebrow }}</p>
            <h2>{{ totalCount ? locale.app.totalPhotos(visibleCount, showFavoritesOnly) : locale.app.waitingTitle }}</h2>
          </div>
        </div>

        <DateSidebar :year-groups="yearGroups" :messages="locale.sidebar" @jump-to-date="scrollToDate" />
      </div>

      <section class="album-content" :aria-label="locale.app.albumContentAria">
        <PhotoGrid
          :date-groups="formattedDateGroups"
          :selected-ids="selectedIds"
          :favorite-ids="favoriteIds"
          :thumbnail-mode="thumbnailMode"
          :is-favorites-view="showFavoritesOnly"
          :messages="locale.grid"
          @toggle-photo="togglePhoto"
          @toggle-favorite="toggleFavorite"
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

    <ConfirmDialog
      :visible="confirmDialog.visible"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      :tone="confirmDialog.tone"
      :confirm-label="confirmDialog.confirmLabel"
      :cancel-label="confirmDialog.cancelLabel"
      :close-label="locale.app.dialogCloseAria"
      @confirm="closeConfirmDialog(true)"
      @cancel="closeConfirmDialog(false)"
    />

    <OperationNotice
      :visible="isStatusNoticeVisible"
      :title="locale.app.operationNoticeTitle"
      :message="statusMessage"
      :tone="statusNoticeTone"
      :is-loading="isStatusNoticeLoading"
      :close-label="locale.app.operationNoticeCloseAria"
      @close="closeStatusNotice"
    />
  </div>
</template>
