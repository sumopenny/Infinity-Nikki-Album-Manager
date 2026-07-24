<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AlbumViewNav, { type AlbumView } from './components/AlbumViewNav.vue'
import ConfirmDialog, { type ConfirmDialogTone } from './components/ConfirmDialog.vue'
import DateSidebar from './components/DateSidebar.vue'
import Lightbox from './components/Lightbox.vue'
import OperationNotice, { type OperationNoticeTone } from './components/OperationNotice.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import RecentlyDeletedGrid from './components/RecentlyDeletedGrid.vue'
import SelectionBar from './components/SelectionBar.vue'
import TopBar from './components/TopBar.vue'
import { DEFAULT_LANGUAGE, getThumbnailModeOptions, messages, type Language, type StatusPrefix, type StatusSuffix } from './i18n'
import { isThumbnailMode, type ThumbnailMode } from './types/thumbnail'
import { isThemeMode, type ThemeMode } from './types/theme'
import { groupDatesByYear, groupPhotosByDate, type PhotoItem, type RecentlyDeletedPhoto } from './utils/dateGrouping'
import {
  clearSavedAlbumDirectoryHandle,
  clearSavedX6GameDirectoryHandle,
  executeRelatedPhotoCleanup,
  formatFileSize,
  getSavedAlbumDirectoryHandle,
  listRecentlyDeleted,
  movePhotosToRecentlyDeleted,
  permanentlyDeleteRecentlyDeleted,
  pickAlbumDirectory,
  prepareRelatedPhotoCleanup,
  readAlbumDirectory,
  refreshAlbumDirectory,
  releasePhotoUrl,
  releasePhotoUrls,
  restoreRecentlyDeletedPhotos,
  type AlbumDirectoryResult,
  type RefreshAlbumResult
} from './utils/fileSystem'

const THUMBNAIL_STORAGE_KEY = 'infinity-nikki-thumbnail-mode'
const THEME_STORAGE_KEY = 'infinity-nikki-theme-mode'
const LANGUAGE_STORAGE_KEY = 'infinity-nikki-language'
const FAVORITES_STORAGE_KEY = 'infinity-nikki-favorite-photo-ids'
const storedThumbnailMode = localStorage.getItem(THUMBNAIL_STORAGE_KEY)
const storedThemeMode = localStorage.getItem(THEME_STORAGE_KEY)
const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY)

function isLanguage(value: string | null): value is Language {
  return value === 'zh' || value === 'en'
}

/**
 * 读取浏览器保存的收藏照片 ID。
 * 参数：无。
 * 返回：过滤掉非法值后的收藏集合。
 */
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
  | { type: 'custom'; message: string; tone?: StatusTone; loading?: boolean }

const photos = ref<PhotoItem[]>([])
const recentlyDeleted = ref<RecentlyDeletedPhoto[]>([])
const selectedIds = ref<Set<string>>(new Set())
const trashSelectedIds = ref<Set<string>>(new Set())
const favoriteIds = ref<Set<string>>(readStoredFavoriteIds())
const activeView = ref<AlbumView>('all')
const currentPreview = ref<PhotoItem | null>(null)
const language = ref<Language>(isLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE)
const directoryState = ref<DirectoryState>({ type: 'none' })
const statusState = ref<StatusState>({ type: 'initial' })
const isStatusNoticeVisible = ref(false)
const isLoading = ref(false)
const isRefreshing = ref(false)
const isDeleting = ref(false)
const isTrashBusy = ref(false)
const isCleaningRelatedPhotos = ref(false)
const isPreferenceUpdating = ref(false)
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
let topBarResizeObserver: ResizeObserver | null = null
let statusNoticeTimer: number | undefined
let focusRefreshTimer: number | undefined
let themeSwitchFrame: number | undefined

const locale = computed(() => messages[language.value])
const favoritePhotos = computed(() => photos.value.filter((photo) => favoriteIds.value.has(photo.id)))
const visiblePhotos = computed(() => (activeView.value === 'favorites' ? favoritePhotos.value : photos.value))
const previewPhotos = computed<PhotoItem[]>(() => (activeView.value === 'trash' ? recentlyDeleted.value : visiblePhotos.value))
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
const trashSelectedCount = computed(() => recentlyDeleted.value.filter((photo) => trashSelectedIds.value.has(photo.id)).length)
const visibleCount = computed(() => visiblePhotos.value.length)
const favoriteCount = computed(() => favoritePhotos.value.length)
const allSelected = computed(
  () => visibleCount.value > 0 && visiblePhotos.value.every((photo) => selectedIds.value.has(photo.id))
)
const allTrashSelected = computed(
  () => recentlyDeleted.value.length > 0 && recentlyDeleted.value.every((photo) => trashSelectedIds.value.has(photo.id))
)
const trashTotalSize = computed(() => recentlyDeleted.value.reduce((total, photo) => total + (photo.size ?? 0), 0))
const trashTotalSizeText = computed(() => formatFileSize(trashTotalSize.value))
const isAnyFileOperationBusy = computed(
  () => isLoading.value || isRefreshing.value || isDeleting.value || isTrashBusy.value || isCleaningRelatedPhotos.value
)
const thumbnailModeOptions = computed(() => getThumbnailModeOptions(language.value))
const directoryName = computed(() => {
  if (directoryState.value.type === 'remembered') return locale.value.app.rememberedDirectory(directoryState.value.name)
  if (directoryState.value.type === 'selected') return directoryState.value.name
  return locale.value.app.noDirectory
})
const viewTitle = computed(() => {
  if (activeView.value === 'favorites') return locale.value.viewNav.favorites
  if (activeView.value === 'trash') return locale.value.viewNav.recentlyDeleted
  return locale.value.viewNav.allPhotos
})
const statusMessage = computed(() => {
  const app = locale.value.app
  const state = statusState.value
  switch (state.type) {
    case 'reading': return app.readingStatus
    case 'restoring': return app.restoringStatus
    case 'restoreFailed': return app.restoreFailedStatus
    case 'restorePathFailed': return app.restorePathFailedStatus
    case 'readFailed': return app.readFailedStatus
    case 'cleared': return app.clearedStatus
    case 'success': return `${app.successStatus(state.count, state.prefix)}${state.suffix ? app.successSuffix(state.suffix) : ''}`
    case 'custom': return state.message
    default: return app.initialStatus
  }
})
const statusNoticeTone = computed<StatusTone>(() => {
  const state = statusState.value
  if (state.type === 'restoreFailed' || state.type === 'restorePathFailed' || state.type === 'readFailed') return 'error'
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
  return previewPhotos.value.findIndex((photo) => photo.id === currentPreview.value?.id)
})
const hasPreviousPreview = computed(() => currentPreviewIndex.value > 0)
const hasNextPreview = computed(
  () => currentPreviewIndex.value >= 0 && currentPreviewIndex.value < previewPhotos.value.length - 1
)

/** 清除操作通知计时器。参数：无。 */
function clearStatusNoticeTimer() {
  if (statusNoticeTimer === undefined) return
  window.clearTimeout(statusNoticeTimer)
  statusNoticeTimer = undefined
}

/** 关闭操作通知。参数：无。 */
function closeStatusNotice() {
  clearStatusNoticeTimer()
  isStatusNoticeVisible.value = false
}

/** 打开自定义确认弹窗。参数：options 为弹窗文案和风格。返回用户是否确认。 */
function openConfirmDialog(options: Omit<ConfirmDialogState, 'visible' | 'resolve'>): Promise<boolean> {
  if (confirmDialog.value.visible) return Promise.resolve(false)
  return new Promise((resolve) => {
    confirmDialog.value = { ...options, visible: true, resolve }
  })
}

/** 关闭自定义确认弹窗。参数：confirmed 表示用户是否确认。 */
function closeConfirmDialog(confirmed: boolean) {
  const resolve = confirmDialog.value.resolve
  confirmDialog.value = { visible: false, title: '', message: '', tone: 'info', confirmLabel: '' }
  resolve?.(confirmed)
}

/** 将未知异常转换为页面状态。参数：error 为异常，fallback 为默认状态。 */
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

watch(favoriteIds, (ids) => localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...ids])), { deep: true })
watch(language, (value) => {
  document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'
  localStorage.setItem(LANGUAGE_STORAGE_KEY, value)
}, { immediate: true })
watch(themeMode, (value) => {
  const root = document.documentElement
  const isThemeChange = Boolean(root.dataset.theme && root.dataset.theme !== value)

  if (themeSwitchFrame !== undefined) window.cancelAnimationFrame(themeSwitchFrame)
  if (isThemeChange) root.classList.add('is-theme-switching')
  root.dataset.theme = value

  if (isThemeChange) {
    themeSwitchFrame = window.requestAnimationFrame(() => {
      themeSwitchFrame = window.requestAnimationFrame(() => {
        root.classList.remove('is-theme-switching')
        themeSwitchFrame = undefined
      })
    })
  }
}, { immediate: true })

/**
 * 合并最近删除扫描结果，复用未变化照片已加载的对象地址。
 * 参数：nextPhotos 为最新扫描结果。
 */
function mergeRecentlyDeleted(nextPhotos: RecentlyDeletedPhoto[]) {
  const currentByName = new Map(recentlyDeleted.value.map((photo) => [photo.trashName, photo]))
  const nextNames = new Set(nextPhotos.map((photo) => photo.trashName))
  for (const photo of recentlyDeleted.value) {
    if (!nextNames.has(photo.trashName)) releasePhotoUrl(photo)
  }
  recentlyDeleted.value = nextPhotos.map((photo) => {
    const existing = currentByName.get(photo.trashName)
    if (!existing) return photo
    existing.size = photo.size
    existing.fileSizeText = photo.fileSizeText
    return existing
  })
  const validIds = new Set(recentlyDeleted.value.map((photo) => photo.id))
  trashSelectedIds.value = new Set([...trashSelectedIds.value].filter((id) => validIds.has(id)))
}

/**
 * 替换当前相册并同步其最近删除目录。
 * 参数：result 为新相册结果，nextStatus 为完成后的状态提示。
 */
async function replaceAlbum(result: AlbumDirectoryResult, nextStatus: StatusState) {
  releasePhotoUrls(photos.value)
  releasePhotoUrls(recentlyDeleted.value)
  selectedIds.value = new Set()
  trashSelectedIds.value = new Set()
  currentPreview.value = null
  photos.value = result.photos
  recentlyDeleted.value = await listRecentlyDeleted(result.directoryHandle)
  // 收藏记录跨相册保留，切换相册时不再按当前照片裁剪，避免切回后丢失
  activeView.value = 'all'
  albumDirectoryHandle.value = result.directoryHandle
  directoryState.value = { type: 'selected', name: result.directoryName }
  statusState.value = nextStatus
}

/** 应用语言或主题偏好，并显示加载及完成提示。参数：preference 为要切换的偏好。 */
async function applyPreference(preference: 'language' | 'theme') {
  if (isPreferenceUpdating.value) return

  isPreferenceUpdating.value = true
  statusState.value = { type: 'custom', message: locale.value.app.preferencesUpdating, tone: 'info', loading: true }
  await new Promise<void>((resolve) => window.setTimeout(resolve, 280))

  if (preference === 'language') {
    language.value = language.value === 'zh' ? 'en' : 'zh'
  } else {
    themeMode.value = themeMode.value === 'light' ? 'dark' : 'light'
    localStorage.setItem(THEME_STORAGE_KEY, themeMode.value)
  }

  await nextTick()
  statusState.value = {
    type: 'custom',
    message: preference === 'language' ? locale.value.app.languageUpdated : locale.value.app.themeUpdated,
    tone: 'success'
  }
  isPreferenceUpdating.value = false
}

/** 切换中英文。参数：无。 */
function toggleLanguage() {
  return applyPreference('language')
}

/** 恢复浏览器记住的相册目录。参数：无。 */
async function restoreSavedDirectory() {
  const savedHandle = await getSavedAlbumDirectoryHandle()
  if (!savedHandle) return
  directoryState.value = { type: 'remembered', name: savedHandle.name }
  isLoading.value = true
  statusState.value = { type: 'restoring' }
  try {
    const result = await readAlbumDirectory(savedHandle, { requestPermission: false, messages: locale.value.fileSystem })
    await replaceAlbum(result, { type: 'success', count: result.photos.length, prefix: 'restored', suffix: 'continued' })
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'restoreFailed' })
  } finally {
    isLoading.value = false
  }
}

/** 选择或重新授权相册目录。参数：无。 */
async function chooseDirectory() {
  if (isAnyFileOperationBusy.value) return
  isLoading.value = true
  statusState.value = { type: 'reading' }
  try {
    const savedHandle = await getSavedAlbumDirectoryHandle()
    if (savedHandle && !photos.value.length) {
      try {
        const restored = await readAlbumDirectory(savedHandle, { requestPermission: true, messages: locale.value.fileSystem })
        await replaceAlbum(restored, { type: 'success', count: restored.photos.length, prefix: 'restored', suffix: 'continued' })
        return
      } catch {
        statusState.value = { type: 'restorePathFailed' }
      }
    }
    const result = await pickAlbumDirectory(locale.value.fileSystem)
    await replaceAlbum(result, { type: 'success', count: result.photos.length, prefix: 'read', suffix: 'remembered' })
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isLoading.value = false
  }
}

/** 清除保存的目录授权和当前页面状态。参数：无。 */
async function clearDirectory() {
  if (isAnyFileOperationBusy.value) return
  await clearSavedAlbumDirectoryHandle()
  await clearSavedX6GameDirectoryHandle()
  releasePhotoUrls(photos.value)
  releasePhotoUrls(recentlyDeleted.value)
  photos.value = []
  recentlyDeleted.value = []
  selectedIds.value = new Set()
  trashSelectedIds.value = new Set()
  currentPreview.value = null
  albumDirectoryHandle.value = null
  activeView.value = 'all'
  directoryState.value = { type: 'none' }
  statusState.value = { type: 'cleared' }
}

/**
 * 应用增量刷新结果并清理失效状态。
 * 参数：result 为文件系统扫描结果。
 */
function applyRefreshResult(result: RefreshAlbumResult) {
  for (const photo of result.removedPhotos) releasePhotoUrl(photo)
  photos.value = result.photos
  mergeRecentlyDeleted(result.recentlyDeleted)
  const validPhotoIds = new Set(photos.value.map((photo) => photo.id))
  selectedIds.value = new Set([...selectedIds.value].filter((id) => validPhotoIds.has(id)))
  // 收藏记录不随刷新裁剪：其他相册的收藏必须保留，本相册临时缺失的文件重新出现后收藏仍生效
  if (currentPreview.value && !previewPhotos.value.some((photo) => photo.id === currentPreview.value?.id)) currentPreview.value = null
}

/**
 * 刷新相册和最近删除目录。
 * 参数：manual 表示是否由用户点击触发；手动刷新可请求权限且无变化时也提示。
 */
async function refreshAlbum(manual: boolean) {
  const directoryHandle = albumDirectoryHandle.value
  if (!directoryHandle || isAnyFileOperationBusy.value || confirmDialog.value.visible) return
  isRefreshing.value = true
  if (manual) statusState.value = { type: 'custom', message: locale.value.topBar.refreshing, tone: 'info', loading: true }
  try {
    const result = await refreshAlbumDirectory(directoryHandle, photos.value, {
      requestPermission: manual,
      messages: locale.value.fileSystem
    })
    applyRefreshResult(result)
    if (result.addedCount || result.removedCount) {
      statusState.value = { type: 'custom', message: locale.value.trash.refreshStatus(result.addedCount, result.removedCount), tone: 'success' }
    } else if (manual) {
      statusState.value = { type: 'custom', message: locale.value.trash.upToDate, tone: 'success' }
    }
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isRefreshing.value = false
  }
}

/** 切换缩略图尺寸。参数：mode 为目标模式。 */
function changeThumbnailMode(mode: ThumbnailMode) {
  thumbnailMode.value = mode
  localStorage.setItem(THUMBNAIL_STORAGE_KEY, mode)
}

/** 切换亮暗主题。参数：无。 */
function toggleTheme() {
  return applyPreference('theme')
}

/** 切换全部照片、收藏夹或最近删除视图。参数：view 为目标视图。 */
function changeAlbumView(view: AlbumView) {
  activeView.value = view
  currentPreview.value = null
  if (view === 'trash') void refreshAlbum(false)
}

/** 切换普通照片当前视图的全选状态。参数：无。 */
function toggleAll() {
  const visibleIds = new Set(visiblePhotos.value.map((photo) => photo.id))
  if (allSelected.value) {
    selectedIds.value = new Set([...selectedIds.value].filter((id) => !visibleIds.has(id)))
    return
  }
  selectedIds.value = new Set([...selectedIds.value, ...visibleIds])
}

/** 切换普通照片选中状态。参数：photoId 为照片 ID。 */
function togglePhoto(photoId: string) {
  const next = new Set(selectedIds.value)
  next.has(photoId) ? next.delete(photoId) : next.add(photoId)
  selectedIds.value = next
}

/** 切换最近删除照片选中状态。参数：photoId 为回收照片 ID。 */
function toggleTrashPhoto(photoId: string) {
  const next = new Set(trashSelectedIds.value)
  next.has(photoId) ? next.delete(photoId) : next.add(photoId)
  trashSelectedIds.value = next
}

/** 切换最近删除全选状态。参数：无。 */
function toggleAllTrash() {
  trashSelectedIds.value = allTrashSelected.value ? new Set() : new Set(recentlyDeleted.value.map((photo) => photo.id))
}

/** 切换收藏状态。参数：photoId 为照片 ID。 */
function toggleFavorite(photoId: string) {
  const next = new Set(favoriteIds.value)
  next.has(photoId) ? next.delete(photoId) : next.add(photoId)
  favoriteIds.value = next
  if (activeView.value === 'favorites' && !next.has(photoId)) {
    selectedIds.value = new Set([...selectedIds.value].filter((id) => id !== photoId))
  }
}

/** 将当前选中的普通照片批量加入收藏，不取消已收藏项目。参数：无。 */
function favoriteSelectedPhotos() {
  const selectedPhotoIds = visiblePhotos.value.filter((photo) => selectedIds.value.has(photo.id)).map((photo) => photo.id)
  favoriteIds.value = new Set([...favoriteIds.value, ...selectedPhotoIds])
}

/** 取消当前收藏夹中选中照片的收藏状态，并移除已不可见的选择。参数：无。 */
function unfavoriteSelectedPhotos() {
  const targetIds = new Set(visiblePhotos.value.filter((photo) => selectedIds.value.has(photo.id)).map((photo) => photo.id))
  favoriteIds.value = new Set([...favoriteIds.value].filter((id) => !targetIds.has(id)))
  selectedIds.value = new Set([...selectedIds.value].filter((id) => !targetIds.has(id)))
}

/** 清空当前普通视图的照片选择。参数：无。 */
function clearAlbumSelection() {
  selectedIds.value = new Set()
}

/** 清空最近删除视图的照片选择。参数：无。 */
function clearTrashSelection() {
  trashSelectedIds.value = new Set()
}

/** 切换某一天全部照片的选中状态。参数：dateKey 为日期键。 */
function toggleDate(dateKey: string) {
  const group = dateGroups.value.find((item) => item.dateKey === dateKey)
  if (!group) return
  const next = new Set(selectedIds.value)
  const selected = group.photos.every((photo) => next.has(photo.id))
  for (const photo of group.photos) selected ? next.delete(photo.id) : next.add(photo.id)
  selectedIds.value = next
}

/**
 * 将普通照片移动到最近删除。
 * 参数：targets 为目标照片，keepPreviewOpen 表示删除预览图后是否继续预览相邻照片。
 */
async function movePhotosToTrash(targets: PhotoItem[], keepPreviewOpen = false) {
  if (!targets.length || isAnyFileOperationBusy.value) return
  const confirmed = await openConfirmDialog({
    title: locale.value.trash.moveDialogTitle,
    message: locale.value.trash.confirmMove(targets.length),
    tone: 'warning',
    confirmLabel: locale.value.app.dialogConfirm,
    cancelLabel: locale.value.app.dialogCancel
  })
  if (!confirmed) return

  isDeleting.value = true
  statusState.value = { type: 'custom', message: locale.value.app.movingPhotosToTrash, tone: 'info', loading: true }
  const previewIndex = currentPreviewIndex.value
  try {
    const result = await movePhotosToRecentlyDeleted(targets, favoriteIds.value)
    const movedIds = new Set(result.succeeded.map((photo) => photo.id))
    photos.value = photos.value.filter((photo) => !movedIds.has(photo.id))
    selectedIds.value = new Set([...selectedIds.value].filter((id) => !movedIds.has(id)))
    favoriteIds.value = new Set([...favoriteIds.value].filter((id) => !movedIds.has(id)))
    mergeRecentlyDeleted(await listRecentlyDeleted(targets[0].directoryHandle))

    if (currentPreview.value && movedIds.has(currentPreview.value.id)) {
      currentPreview.value = keepPreviewOpen
        ? visiblePhotos.value[Math.min(previewIndex, visiblePhotos.value.length - 1)] ?? null
        : null
    }
    statusState.value = {
      type: 'custom',
      message: locale.value.trash.movedStatus(result.succeeded.length, result.failedNames),
      tone: result.failedNames.length ? 'warning' : 'success'
    }
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isDeleting.value = false
  }
}

/** 将当前普通视图的选中照片移到最近删除。参数：无。 */
async function deleteSelectedPhotos() {
  await movePhotosToTrash(visiblePhotos.value.filter((photo) => selectedIds.value.has(photo.id)))
}

/** 将当前预览照片移到最近删除。参数：无。 */
async function deleteCurrentPreview() {
  if (!currentPreview.value || activeView.value === 'trash') return
  await movePhotosToTrash([currentPreview.value], true)
}

/**
 * 恢复最近删除照片。
 * 参数：targets 为待恢复的回收照片，keepPreviewOpen 表示是否继续预览相邻回收照片。
 */
async function restoreTrashPhotos(targets: RecentlyDeletedPhoto[], keepPreviewOpen = false) {
  const directoryHandle = albumDirectoryHandle.value
  if (!directoryHandle || !targets.length || isAnyFileOperationBusy.value) return
  isTrashBusy.value = true
  statusState.value = { type: 'custom', message: locale.value.app.restoringPhotos, tone: 'info', loading: true }
  const previewIndex = currentPreviewIndex.value
  try {
    const result = await restoreRecentlyDeletedPhotos(targets, directoryHandle)
    const restoredTrashIds = new Set(result.succeeded.map((photo) => photo.id))
    recentlyDeleted.value = recentlyDeleted.value.filter((photo) => !restoredTrashIds.has(photo.id))
    trashSelectedIds.value = new Set([...trashSelectedIds.value].filter((id) => !restoredTrashIds.has(id)))
    photos.value = [...photos.value, ...result.restoredPhotos].sort((a, b) => b.timestamp - a.timestamp)
    result.succeeded.forEach((source, index) => {
      const restored = result.restoredPhotos[index]
      if (source.wasFavorite && restored) favoriteIds.value = new Set([...favoriteIds.value, restored.id])
    })
    if (currentPreview.value && restoredTrashIds.has(currentPreview.value.id)) {
      currentPreview.value = keepPreviewOpen
        ? recentlyDeleted.value[Math.min(previewIndex, recentlyDeleted.value.length - 1)] ?? null
        : null
    }
    statusState.value = {
      type: 'custom',
      message: locale.value.trash.restoredStatus(result.succeeded.length, result.failedNames),
      tone: result.failedNames.length ? 'warning' : 'success'
    }
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isTrashBusy.value = false
  }
}

/**
 * 永久删除最近删除照片并显示不可恢复影响范围。
 * 参数：targets 为待删除照片，keepPreviewOpen 表示是否继续预览相邻照片。
 */
async function permanentlyDeleteTrashPhotos(targets: RecentlyDeletedPhoto[], keepPreviewOpen = false) {
  if (!targets.length || isAnyFileOperationBusy.value) return
  const confirmed = await openConfirmDialog({
    title: locale.value.trash.permanentDeleteDialogTitle,
    message: locale.value.trash.confirmPermanentDelete(targets.length),
    tone: 'danger',
    confirmLabel: locale.value.app.dialogConfirm,
    cancelLabel: locale.value.app.dialogCancel
  })
  if (!confirmed) return

  isTrashBusy.value = true
  statusState.value = { type: 'custom', message: locale.value.app.permanentlyDeletingPhotos, tone: 'info', loading: true }
  const previewIndex = currentPreviewIndex.value
  try {
    const result = await permanentlyDeleteRecentlyDeleted(targets)
    const deletedIds = new Set(result.succeeded.map((photo) => photo.id))
    recentlyDeleted.value = recentlyDeleted.value.filter((photo) => !deletedIds.has(photo.id))
    trashSelectedIds.value = new Set([...trashSelectedIds.value].filter((id) => !deletedIds.has(id)))
    if (currentPreview.value && deletedIds.has(currentPreview.value.id)) {
      currentPreview.value = keepPreviewOpen
        ? recentlyDeleted.value[Math.min(previewIndex, recentlyDeleted.value.length - 1)] ?? null
        : null
    }
    statusState.value = {
      type: 'custom',
      message: locale.value.trash.permanentlyDeletedStatus(result.succeeded.length, result.failedNames),
      tone: result.failedNames.length ? 'warning' : 'success'
    }
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isTrashBusy.value = false
  }
}

/** 恢复当前选中的最近删除照片。参数：无。 */
async function restoreSelectedTrash() {
  await restoreTrashPhotos(recentlyDeleted.value.filter((photo) => trashSelectedIds.value.has(photo.id)))
}

/** 永久删除当前选中的最近删除照片。参数：无。 */
async function permanentlyDeleteSelectedTrash() {
  await permanentlyDeleteTrashPhotos(recentlyDeleted.value.filter((photo) => trashSelectedIds.value.has(photo.id)))
}

/** 恢复当前最近删除预览照片。参数：无。 */
async function restoreCurrentTrashPreview() {
  if (!currentPreview.value || activeView.value !== 'trash') return
  await restoreTrashPhotos([currentPreview.value as RecentlyDeletedPhoto], true)
}

/** 永久删除当前最近删除预览照片。参数：无。 */
async function permanentlyDeleteCurrentTrashPreview() {
  if (!currentPreview.value || activeView.value !== 'trash') return
  await permanentlyDeleteTrashPhotos([currentPreview.value as RecentlyDeletedPhoto], true)
}

/** 执行原有低画质和截图永久清理。参数：无。 */
async function cleanRelatedPhotos() {
  if (!albumDirectoryHandle.value || isAnyFileOperationBusy.value) return
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
      message: locale.value.app.relatedCleanupStatus(
        result.deletedCount,
        result.deletedBytes,
        result.failures,
        result.missingDirectories
      ),
      tone: result.failures.length || result.missingDirectories.length ? 'warning' : 'success'
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

/** 跳转到指定日期。参数：dateKey 为日期键。 */
function scrollToDate(dateKey: string) {
  document.getElementById(`date-${dateKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

/** 打开照片大图。参数：photo 为目标照片。 */
function openPreview(photo: PhotoItem) {
  currentPreview.value = photo
}

/** 关闭照片大图。参数：无。 */
function closePreview() {
  currentPreview.value = null
}

/** 更新左侧栏顶部偏移。参数：无。 */
function updateSidebarStickyOffset() {
  const topBarElement = document.querySelector<HTMLElement>('.app-header')
  if (!appShellRef.value || !topBarElement) return
  appShellRef.value.style.setProperty('--sidebar-sticky-top', `${Math.ceil(topBarElement.getBoundingClientRect().height) + 10}px`)
}

/** 显示当前视图上一张预览照片。参数：无。 */
function showPreviousPreview() {
  if (hasPreviousPreview.value) currentPreview.value = previewPhotos.value[currentPreviewIndex.value - 1]
}

/** 显示当前视图下一张预览照片。参数：无。 */
function showNextPreview() {
  if (hasNextPreview.value) currentPreview.value = previewPhotos.value[currentPreviewIndex.value + 1]
}

/** 合并窗口聚焦和页面可见事件后执行自动刷新。参数：无。 */
function scheduleFocusRefresh() {
  if (document.visibilityState === 'hidden' || !albumDirectoryHandle.value) return
  if (focusRefreshTimer !== undefined) window.clearTimeout(focusRefreshTimer)
  focusRefreshTimer = window.setTimeout(() => {
    focusRefreshTimer = undefined
    void refreshAlbum(false)
  }, 400)
}

onMounted(() => {
  void restoreSavedDirectory()
  nextTick(() => {
    updateSidebarStickyOffset()
    const topBarElement = document.querySelector<HTMLElement>('.app-header')
    if (!topBarElement || typeof ResizeObserver === 'undefined') return
    topBarResizeObserver = new ResizeObserver(updateSidebarStickyOffset)
    topBarResizeObserver.observe(topBarElement)
  })
  window.addEventListener('resize', updateSidebarStickyOffset)
  window.addEventListener('focus', scheduleFocusRefresh)
  document.addEventListener('visibilitychange', scheduleFocusRefresh)
})

onBeforeUnmount(() => {
  clearStatusNoticeTimer()
  if (focusRefreshTimer !== undefined) window.clearTimeout(focusRefreshTimer)
  if (themeSwitchFrame !== undefined) window.cancelAnimationFrame(themeSwitchFrame)
  document.documentElement.classList.remove('is-theme-switching')
  topBarResizeObserver?.disconnect()
  window.removeEventListener('resize', updateSidebarStickyOffset)
  window.removeEventListener('focus', scheduleFocusRefresh)
  document.removeEventListener('visibilitychange', scheduleFocusRefresh)
  releasePhotoUrls(photos.value)
  releasePhotoUrls(recentlyDeleted.value)
})
</script>

<template>
  <div ref="appShellRef" class="app-shell">
    <TopBar
      :directory-name="directoryName"
      :is-loading="isLoading"
      :is-refreshing="isRefreshing"
      :is-deleting="isDeleting || isTrashBusy"
      :is-cleaning-related-photos="isCleaningRelatedPhotos"
      :has-album-directory="Boolean(albumDirectoryHandle)"
      :thumbnail-mode="thumbnailMode"
      :thumbnail-mode-options="thumbnailModeOptions"
      :theme-mode="themeMode"
      :language="language"
      :messages="locale.topBar"
      @choose-directory="chooseDirectory"
      @clear-directory="clearDirectory"
      @refresh-album="refreshAlbum(true)"
      @clean-related-photos="cleanRelatedPhotos"
      @change-thumbnail-mode="changeThumbnailMode"
      @toggle-language="toggleLanguage"
      @toggle-theme="toggleTheme"
    />

    <main class="album-layout" :class="{ 'without-album': !albumDirectoryHandle }">
      <div v-if="albumDirectoryHandle" class="sidebar-column">
        <AlbumViewNav
          :active-view="activeView"
          :all-count="photos.length"
          :favorite-count="favoriteCount"
          :trash-count="recentlyDeleted.length"
          :disabled="!albumDirectoryHandle || isAnyFileOperationBusy"
          :messages="locale.viewNav"
          @change-view="changeAlbumView"
        />

        <DateSidebar
          v-if="activeView !== 'trash'"
          :year-groups="yearGroups"
          :language="language"
          :messages="locale.sidebar"
          @jump-to-date="scrollToDate"
        />
      </div>

      <section class="album-content" :aria-label="locale.app.albumContentAria">
        <div v-if="!albumDirectoryHandle" class="empty-album-start">
          <div class="empty-start-mark" aria-hidden="true"></div>
          <h2>{{ locale.grid.emptyTitle }}</h2>
          <p>{{ locale.grid.emptyDescription }}</p>
          <button class="primary-button" type="button" :disabled="isLoading" @click="chooseDirectory">
            {{ isLoading ? locale.topBar.loading : locale.topBar.chooseDirectory }}
          </button>
          <p class="recommended-path">{{ locale.grid.recommendedPath }}</p>
        </div>

        <header v-else class="gallery-header">
          <div>
            <p class="eyebrow">{{ activeView === 'trash' ? 'TRASH' : 'ALBUM' }}</p>
            <h2>{{ viewTitle }}</h2>
          </div>
          <p v-if="activeView === 'trash'">{{ locale.trash.totalSummary(recentlyDeleted.length, trashTotalSizeText) }}</p>
          <p v-else>{{ locale.viewNav.count(visibleCount) }}</p>
        </header>

        <RecentlyDeletedGrid
          v-if="albumDirectoryHandle && activeView === 'trash'"
          :photos="recentlyDeleted"
          :selected-ids="trashSelectedIds"
          :thumbnail-mode="thumbnailMode"
          :language="language"
          :messages="locale.trash"
          @toggle-photo="toggleTrashPhoto"
          @open-preview="openPreview"
        />
        <PhotoGrid
          v-else-if="albumDirectoryHandle"
          :date-groups="formattedDateGroups"
          :selected-ids="selectedIds"
          :favorite-ids="favoriteIds"
          :thumbnail-mode="thumbnailMode"
          :is-favorites-view="activeView === 'favorites'"
          :messages="locale.grid"
          @toggle-photo="togglePhoto"
          @toggle-favorite="toggleFavorite"
          @toggle-date="toggleDate"
          @open-preview="openPreview"
        />
      </section>
    </main>

    <SelectionBar
      :mode="activeView === 'trash' ? 'trash' : activeView === 'favorites' ? 'favorites' : 'album'"
      :selected-count="activeView === 'trash' ? trashSelectedCount : selectedCount"
      :all-selected="activeView === 'trash' ? allTrashSelected : allSelected"
      :all-items-selected="activeView === 'trash' && allTrashSelected"
      :is-busy="isDeleting || isTrashBusy"
      :messages="locale.selectionBar"
      @toggle-all="activeView === 'trash' ? toggleAllTrash() : toggleAll()"
      @favorite="favoriteSelectedPhotos"
      @unfavorite="unfavoriteSelectedPhotos"
      @delete="activeView === 'trash' ? permanentlyDeleteSelectedTrash() : deleteSelectedPhotos()"
      @restore="restoreSelectedTrash"
      @cancel="activeView === 'trash' ? clearTrashSelection() : clearAlbumSelection()"
    />

    <Lightbox
      :photo="currentPreview"
      :has-previous="hasPreviousPreview"
      :has-next="hasNextPreview"
      :is-deleting="isDeleting || isTrashBusy"
      :keyboard-enabled="!confirmDialog.visible"
      :mode="activeView === 'trash' ? 'trash' : 'album'"
      :is-favorite="Boolean(currentPreview && favoriteIds.has(currentPreview.id))"
      :messages="locale.lightbox"
      :date-messages="locale.date"
      @close="closePreview"
      @previous="showPreviousPreview"
      @next="showNextPreview"
      @delete-current="deleteCurrentPreview"
      @toggle-favorite="currentPreview && toggleFavorite(currentPreview.id)"
      @restore-current="restoreCurrentTrashPreview"
      @permanently-delete-current="permanentlyDeleteCurrentTrashPreview"
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
