<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { CircleHelp, Download, FileUp, Plus, Trash2 } from 'lucide-vue-next'
import AboutDialog from './components/AboutDialog.vue'
import AlbumViewSwitcher, { type AlbumView } from './components/AlbumViewSwitcher.vue'
import CleanupAccountPicker from './components/CleanupAccountPicker.vue'
import CleanupDialog from './components/CleanupDialog.vue'
import ConfirmDialog, { type ConfirmDialogTone } from './components/ConfirmDialog.vue'
import DateSidebar from './components/DateSidebar.vue'
import Lightbox from './components/Lightbox.vue'
import OperationNotice, { type OperationNoticeTone } from './components/OperationNotice.vue'
import NoteDialog from './components/NoteDialog.vue'
import OutfitEditor from './components/OutfitEditor.vue'
import OutfitGrid from './components/OutfitGrid.vue'
import OutfitGuideDialog from './components/OutfitGuideDialog.vue'
import OutfitSidebar, { type OutfitFilter } from './components/OutfitSidebar.vue'
import PhotoGrid from './components/PhotoGrid.vue'
import RecentlyDeletedGrid from './components/RecentlyDeletedGrid.vue'
import SelectionBar from './components/SelectionBar.vue'
import TopBar from './components/TopBar.vue'
import { DEFAULT_LANGUAGE, getThumbnailModeOptions, messages, type Language, type StatusPrefix, type StatusSuffix } from './i18n'
import { isThumbnailMode, type ThumbnailMode } from './types/thumbnail'
import { isThemeMode, type ThemeMode } from './types/theme'
import { groupDatesByYear, groupPhotosByDate, type PhotoItem, type RecentlyDeletedPhoto } from './utils/photoGrouping'
import {
  clearSavedAlbumDirectoryHandle,
  formatFileSize,
  getSavedAlbumDirectoryHandle,
  pickAlbumDirectory,
  readAlbumDirectory,
  refreshAlbumDirectory,
  saveAlbumDirectoryHandle,
  type AlbumDirectoryResult,
  type RefreshAlbumResult
} from './utils/file-system/albumFileSystem'
import { clearRecentlyDeleted, listRecentlyDeleted, movePhotosToRecentlyDeleted, permanentlyDeleteRecentlyDeleted, restoreRecentlyDeletedPhotos } from './utils/file-system/trashFileSystem'
import { getX6GameDirectoryForAlbum, listGamePlayPhotoAccounts, pickStandaloneX6GameDirectory, resolveX6GameAccountDirectory } from './utils/file-system/directoryAccess'
import { clearSavedX6GameDirectoryHandle, getSavedX6GameDirectoryHandle } from './utils/file-system/directoryStorage'
import { executeSpecialCleanup, prepareSpecialCleanup, type SpecialCleanupItem } from './utils/file-system/cleanupFileSystem'
import { savePhotoNote } from './utils/file-system/photoMetadata'
import { releasePhotoUrl, releasePhotoUrls } from './utils/file-system/photoUrl'
import {
  deleteOutfit,
  deleteOutfits,
  deleteOutfitTag,
  readOutfitLibrary,
  saveOutfit,
  saveOutfitTags,
  type OutfitItem,
  type OutfitLibraryResult,
  type SaveOutfitInput,
  type SharedOutfitSource
} from './utils/outfit/outfitFileSystem'
import { exportOutfitBackup, importOutfitBackup } from './utils/outfit/outfitBackup'
import { isValidOutfitTag, MAX_OUTFIT_TAG_LENGTH, MAX_OUTFIT_TAGS, normalizeOutfitTag } from './utils/outfit/outfitTypes'

const THUMBNAIL_STORAGE_KEY = 'infinity-nikki-thumbnail-mode'
const OUTFIT_THUMBNAIL_STORAGE_KEY = 'infinity-nikki-outfit-thumbnail-mode'
const OUTFIT_GUIDE_DISMISSED_KEY = 'infinity-nikki-outfit-guide-dismissed'
const X6GAME_AUTO_PROMPT_DISMISSED_KEY = 'infinity-nikki-x6game-auto-prompt-dismissed'
const THEME_STORAGE_KEY = 'infinity-nikki-theme-mode'
const LANGUAGE_STORAGE_KEY = 'infinity-nikki-language'
const FAVORITES_STORAGE_KEY = 'infinity-nikki-favorite-photo-ids'
const ABOUT_STATE_STORAGE_KEY = 'infinity-nikki-about-state'
const CLEANUP_ACCOUNT_CHOICE_KEY = 'infinity-nikki-cleanup-account-choice'
// 当前版本直接取中文关于文案的第一条更新记录，避免版本号在多个位置重复维护。
const currentAboutVersion = messages.zh.about.changelog[0]?.version.replace(/^v/, '') ?? ''

function readCleanupAccountChoice(): string | null {
  try {
    return localStorage.getItem(CLEANUP_ACCOUNT_CHOICE_KEY)
  } catch {
    return null
  }
}

function persistCleanupAccountChoice(choice: string | null): void {
  try {
    if (choice) localStorage.setItem(CLEANUP_ACCOUNT_CHOICE_KEY, choice)
    else localStorage.removeItem(CLEANUP_ACCOUNT_CHOICE_KEY)
  } catch {
    // Storage is optional; cleanup remains usable without remembering a choice.
  }
}
const WEBSITE_LOCAL_STORAGE_KEYS = [
  THUMBNAIL_STORAGE_KEY,
  OUTFIT_THUMBNAIL_STORAGE_KEY,
  OUTFIT_GUIDE_DISMISSED_KEY,
  X6GAME_AUTO_PROMPT_DISMISSED_KEY,
  THEME_STORAGE_KEY,
  LANGUAGE_STORAGE_KEY,
  FAVORITES_STORAGE_KEY,
  ABOUT_STATE_STORAGE_KEY,
  CLEANUP_ACCOUNT_CHOICE_KEY
]
let suppressLocalPersistence = false
const storedThumbnailMode = localStorage.getItem(THUMBNAIL_STORAGE_KEY)
const storedOutfitThumbnailMode = localStorage.getItem(OUTFIT_THUMBNAIL_STORAGE_KEY)
const storedThemeMode = localStorage.getItem(THEME_STORAGE_KEY)
const storedLanguage = localStorage.getItem(LANGUAGE_STORAGE_KEY)

function isLanguage(value: string | null): value is Language {
  return value === 'zh' || value === 'en'
}

/**
 * 读取本地保存的“关于网站”窗口状态。
 * 参数：无。
 * 返回：记录的版本号和“不再提示”勾选状态；没有记录或解析失败时返回 null。
 */
function readStoredAboutState(): { version: string; dismissed: boolean } | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(ABOUT_STATE_STORAGE_KEY) ?? 'null') as { version?: unknown; dismissed?: unknown } | null
    if (parsed && typeof parsed.version === 'string') return { version: parsed.version, dismissed: parsed.dismissed === true }
  } catch {
    // 解析失败按没有记录处理
  }
  return null
}

const storedAboutState = readStoredAboutState()

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
const outfits = ref<OutfitItem[]>([])
const outfitTags = ref<string[]>([])
const activeOutfitFilter = ref<OutfitFilter>('all')
const editingOutfit = ref<OutfitItem | null>(null)
const isOutfitEditorVisible = ref(false)
const isOutfitGuideVisible = ref(false)
const isOutfitGuideDismissed = ref(localStorage.getItem(OUTFIT_GUIDE_DISMISSED_KEY) === 'true')
const isAboutDialogVisible = ref(false)
// 版本号变化时本地记录失效，“不再提示”勾选状态随之重置
const isAboutDialogDismissed = ref(storedAboutState?.version === currentAboutVersion && storedAboutState.dismissed === true)
const isX6GameAutoPromptDismissed = ref(localStorage.getItem(X6GAME_AUTO_PROMPT_DISMISSED_KEY) === 'true')
const didCancelX6GameAutoPrompt = ref(false)
const isUpdatingOutfits = ref(false)
const outfitSidebarRef = ref<InstanceType<typeof OutfitSidebar> | null>(null)
const outfitEditorRef = ref<InstanceType<typeof OutfitEditor> | null>(null)
const outfitImportInput = ref<HTMLInputElement | null>(null)
const recentlyDeleted = ref<RecentlyDeletedPhoto[]>([])
const selectedIds = ref<Set<string>>(new Set())
const selectedOutfitIds = ref<Set<string>>(new Set())
const trashSelectedIds = ref<Set<string>>(new Set())
const favoriteIds = ref<Set<string>>(readStoredFavoriteIds())
const searchQuery = ref('')
const noteDialogPhoto = ref<PhotoItem | null>(null)
const isNoteDialogVisible = ref(false)
const activeView = ref<AlbumView>('all')
const currentPreview = ref<PhotoItem | null>(null)
const sharedOutfitSource = ref<SharedOutfitSource | null>(null)
const hasX6GameAuthorization = ref(false)
const language = ref<Language>(isLanguage(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE)
const directoryState = ref<DirectoryState>({ type: 'none' })
const statusState = ref<StatusState>({ type: 'initial' })
const isStatusNoticeVisible = ref(false)
const isLoading = ref(false)
const isRefreshing = ref(false)
const isDeleting = ref(false)
const isTrashBusy = ref(false)
const showCleanupDialog = ref(false)
const cleanupX6GameHandle = ref<FileSystemDirectoryHandle | null>(null)
const cleaningItem = ref<SpecialCleanupItem | null>(null)
const showCleanupAccountDialog = ref(false)
const cleanupAccounts = ref<string[]>([])
const cleanupRememberedChoice = ref<string | null>(null)
const cleanupAccountResolver = ref<((accountIds: string[] | null) => void) | null>(null)
const isSavingOutfit = ref(false)
const isImportingOutfits = ref(false)
const isExportingOutfits = ref(false)
const isOutfitMutationBusy = ref(false)
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
const outfitThumbnailMode = ref<ThumbnailMode>(isThumbnailMode(storedOutfitThumbnailMode) ? storedOutfitThumbnailMode : 'portrait-standard')
const themeMode = ref<ThemeMode>(isThemeMode(storedThemeMode) ? storedThemeMode : 'light')
const appShellRef = ref<HTMLElement | null>(null)
let topBarResizeObserver: ResizeObserver | null = null
let statusNoticeTimer: number | undefined
let statusNoticeDeadline = 0
let statusNoticeRemaining = 0
let isStatusNoticePaused = false
let focusRefreshTimer: number | undefined
let themeSwitchFrame: number | undefined
let suppressNextFocusRefresh = false

// 派生视图状态
const locale = computed(() => messages[language.value])
const outfitLocale = computed(() => messages[language.value].outfit)
const normalizedSearch = computed(() => searchQuery.value.trim().toLocaleLowerCase())
const matchesSearch = (value: string) => !normalizedSearch.value || value.toLocaleLowerCase().includes(normalizedSearch.value)
const favoritePhotos = computed(() => photos.value.filter((photo) => favoriteIds.value.has(photo.id)))
const visiblePhotos = computed(() => {
  const source = activeView.value === 'favorites' ? favoritePhotos.value : photos.value
  return source.filter((photo) => matchesSearch(`${photo.name} ${photo.note}`))
})
const visibleOutfits = computed(() => {
  let result = outfits.value
  if (activeOutfitFilter.value === 'pending') result = result.filter((outfit) => !outfit.code.trim())
  else if (activeOutfitFilter.value === 'uncategorized') result = result.filter((outfit) => !outfit.tags.length)
  if (activeOutfitFilter.value.startsWith('tag:')) {
    const tag = activeOutfitFilter.value.slice(4)
    result = result.filter((outfit) => outfit.tags[0] === tag)
  }
  return result.filter((outfit) => matchesSearch(`${outfit.name} ${outfit.note} ${outfit.code}`))
})
const previewPhotos = computed<PhotoItem[]>(() => {
  if (activeView.value === 'trash') return recentlyDeleted.value
  if (activeView.value === 'outfits') return visibleOutfits.value
  return visiblePhotos.value
})
const currentPreviewOutfit = computed(() => {
  if (activeView.value !== 'outfits' || !currentPreview.value) return null
  return outfits.value.find((outfit) => outfit.id === currentPreview.value?.id) ?? null
})
const dateGroups = computed(() => groupPhotosByDate(visiblePhotos.value))
const formattedDateGroups = computed(() =>
  dateGroups.value.map((group) => ({
    ...group,
    displayDate: locale.value.date.displayDate(group.dateKey),
    monthDay: locale.value.date.monthDay(group.dateKey)
  }))
)
const yearGroups = computed(() => groupDatesByYear(formattedDateGroups.value))
/** 当前作用域内被选中的照片（选中 ∩ 可见），所有批量操作统一从这里取，新增筛选维度时只需改这一处。 */
const scopedSelectedPhotos = computed(() => visiblePhotos.value.filter((photo) => selectedIds.value.has(photo.id)))
const selectedCount = computed(() => scopedSelectedPhotos.value.length)
const selectedOutfitCount = computed(() => visibleOutfits.value.filter((outfit) => selectedOutfitIds.value.has(outfit.id)).length)
const trashSelectedCount = computed(() => recentlyDeleted.value.filter((photo) => trashSelectedIds.value.has(photo.id)).length)
const visibleCount = computed(() => visiblePhotos.value.length)
const favoriteCount = computed(() => favoritePhotos.value.length)
const allSelected = computed(
  () => visibleCount.value > 0 && visiblePhotos.value.every((photo) => selectedIds.value.has(photo.id))
)
/** 选中的可见照片是否全部已收藏，决定多选栏显示收藏还是取消收藏。 */
const allSelectedFavorited = computed(
  () => selectedCount.value > 0 && scopedSelectedPhotos.value.every((photo) => favoriteIds.value.has(photo.id))
)
const allTrashSelected = computed(
  () => recentlyDeleted.value.length > 0 && recentlyDeleted.value.every((photo) => trashSelectedIds.value.has(photo.id))
)
const trashTotalSize = computed(() => recentlyDeleted.value.reduce((total, photo) => total + (photo.size ?? 0), 0))
const trashTotalSizeText = computed(() => formatFileSize(trashTotalSize.value))
const isAnyFileOperationBusy = computed(
  () => isLoading.value || isRefreshing.value || isDeleting.value || isTrashBusy.value || cleaningItem.value !== null ||
    isSavingOutfit.value || isImportingOutfits.value || isExportingOutfits.value
    || isUpdatingOutfits.value || isOutfitMutationBusy.value
)
const allOutfitsSelected = computed(
  () => visibleOutfits.value.length > 0 && visibleOutfits.value.every((outfit) => selectedOutfitIds.value.has(outfit.id))
)
const thumbnailModeOptions = computed(() => getThumbnailModeOptions(language.value))
const displayedThumbnailMode = computed(() => activeView.value === 'outfits' ? outfitThumbnailMode.value : thumbnailMode.value)
const directoryName = computed(() => {
  if (directoryState.value.type === 'remembered') return locale.value.app.rememberedDirectory(directoryState.value.name)
  if (directoryState.value.type === 'selected') return directoryState.value.name
  return locale.value.app.noDirectory
})
const viewTitle = computed(() => {
  if (activeView.value === 'outfits') return outfitLocale.value.viewName
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

/** 鼠标悬停时暂停通知自动隐藏计时，避免用户阅读长提示时通知突然消失。 */
function pauseStatusNoticeTimer() {
  if (!isStatusNoticeVisible.value || isStatusNoticeLoading.value || isStatusNoticePaused) return
  statusNoticeRemaining = Math.max(0, statusNoticeDeadline - Date.now())
  clearStatusNoticeTimer()
  isStatusNoticePaused = true
}

/** 鼠标离开通知后从暂停时的剩余时间继续计时。 */
function resumeStatusNoticeTimer() {
  if (!isStatusNoticePaused || !isStatusNoticeVisible.value || isStatusNoticeLoading.value) return
  isStatusNoticePaused = false
  const remaining = statusNoticeRemaining
  statusNoticeDeadline = Date.now() + remaining
  statusNoticeTimer = window.setTimeout(() => {
    isStatusNoticeVisible.value = false
    statusNoticeTimer = undefined
    statusNoticeRemaining = 0
  }, remaining)
}

/** 关闭操作通知。参数：无。 */
function closeStatusNotice() {
  clearStatusNoticeTimer()
  isStatusNoticePaused = false
  statusNoticeRemaining = 0
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

// 通用通知、偏好与持久化
watch(statusState, (nextStatus) => {
  clearStatusNoticeTimer()
  isStatusNoticePaused = false
  statusNoticeRemaining = 0
  if (nextStatus.type === 'initial') {
    isStatusNoticeVisible.value = false
    return
  }
  isStatusNoticeVisible.value = true
  if (isStatusNoticeLoading.value) return
  const duration = statusNoticeTone.value === 'error' || statusNoticeTone.value === 'warning' ? 7200 : 5200
  statusNoticeRemaining = duration
  statusNoticeDeadline = Date.now() + duration
  statusNoticeTimer = window.setTimeout(() => {
    isStatusNoticeVisible.value = false
    statusNoticeTimer = undefined
    statusNoticeRemaining = 0
  }, duration)
})

watch(favoriteIds, (ids) => {
  if (!suppressLocalPersistence) localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...ids]))
}, { deep: true })
watch(language, (value) => {
  document.documentElement.lang = value === 'zh' ? 'zh-CN' : 'en'
  if (!suppressLocalPersistence) localStorage.setItem(LANGUAGE_STORAGE_KEY, value)
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

// 相册加载、恢复与刷新
/**
 * 替换当前相册并同步其最近删除目录。
 * 参数：result 为新相册结果，nextStatus 为完成后的状态提示。
 */
async function replaceAlbum(result: AlbumDirectoryResult, nextStatus: StatusState) {
  const [outfitResult, nextRecentlyDeleted] = await Promise.all([
    readOutfitLibrary(result.directoryHandle),
    listRecentlyDeleted(result.directoryHandle)
  ])
  await saveAlbumDirectoryHandle(result.directoryHandle)

  releasePhotoUrls(photos.value)
  releasePhotoUrls(outfits.value)
  releasePhotoUrls(recentlyDeleted.value)
  sharedOutfitSource.value = null
  selectedIds.value = new Set()
  selectedOutfitIds.value = new Set()
  trashSelectedIds.value = new Set()
  currentPreview.value = null
  editingOutfit.value = null
  isOutfitEditorVisible.value = false
  isOutfitGuideVisible.value = false
  photos.value = result.photos
  outfits.value = outfitResult.outfits
  outfitTags.value = outfitResult.tags
  recentlyDeleted.value = nextRecentlyDeleted
  // 收藏记录跨相册保留，切换相册时不再按当前照片裁剪，避免切回后丢失
  activeView.value = 'all'
  albumDirectoryHandle.value = result.directoryHandle
  directoryState.value = { type: 'selected', name: result.directoryName }
  statusState.value = outfitResult.failedCount
    ? { type: 'custom', message: outfitLocale.value.operations.albumOpenedWithFailures(outfitResult.failedCount), tone: 'warning' }
    : nextStatus
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
    if (!suppressLocalPersistence) localStorage.setItem(THEME_STORAGE_KEY, themeMode.value)
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
  isLoading.value = true
  try {
    const savedHandle = await getSavedAlbumDirectoryHandle()
    if (!savedHandle) return
    directoryState.value = { type: 'remembered', name: savedHandle.name }
    statusState.value = { type: 'restoring' }
    const result = await readAlbumDirectory(savedHandle, { requestPermission: false, messages: locale.value.fileSystem })
    await replaceAlbum(result, { type: 'success', count: result.photos.length, prefix: 'restored', suffix: 'continued' })
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'restoreFailed' })
  } finally {
    isLoading.value = false
  }
}

/** 静默检查是否存在可复用的 X6Game 授权，用于显示“重新授权”入口。参数：无。 */
async function restoreSavedX6GameAuthorization() {
  try {
    const savedHandle = await getSavedX6GameDirectoryHandle()
    if (!savedHandle || savedHandle.name !== 'X6Game') return
    const permission = savedHandle.queryPermission ? await savedHandle.queryPermission({ mode: 'readwrite' }) : 'granted'
    hasX6GameAuthorization.value = permission === 'granted'
  } catch {
    hasX6GameAuthorization.value = false
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

/** 清除页面内已加载的相册和选择状态。参数：无。 */
function resetLoadedAlbumState(options: { clearSharedOutfit?: boolean } = {}) {
  releasePhotoUrls(photos.value)
  releasePhotoUrls(outfits.value)
  releasePhotoUrls(recentlyDeleted.value)
  photos.value = []
  outfits.value = []
  outfitTags.value = []
  recentlyDeleted.value = []
  selectedIds.value = new Set()
  selectedOutfitIds.value = new Set()
  trashSelectedIds.value = new Set()
  currentPreview.value = null
  editingOutfit.value = null
  isOutfitEditorVisible.value = false
  isOutfitGuideVisible.value = false
  if (options.clearSharedOutfit !== false) sharedOutfitSource.value = null
}

/** 清除保存的目录授权和当前页面状态。参数：无。 */
async function clearDirectory() {
  if (isAnyFileOperationBusy.value) return
  await clearSavedAlbumDirectoryHandle()
  resetLoadedAlbumState({ clearSharedOutfit: false })
  albumDirectoryHandle.value = null
  activeView.value = 'all'
  directoryState.value = { type: 'none' }
  statusState.value = { type: 'cleared' }
}

/** 移除浏览器保存的网站本地键值。参数：无。 */
function clearWebsiteLocalStorage() {
  for (const key of WEBSITE_LOCAL_STORAGE_KEYS) localStorage.removeItem(key)
}

/** 标记搭配码界面不再自动弹出 X6Game 授权窗口。参数：无。 */
function dismissX6GameAutoPrompt() {
  isX6GameAutoPromptDismissed.value = true
  didCancelX6GameAutoPrompt.value = true
  if (!suppressLocalPersistence) localStorage.setItem(X6GAME_AUTO_PROMPT_DISMISSED_KEY, 'true')
  statusState.value = { type: 'custom', message: locale.value.app.x6GameAuthorizationCancelledStatus, tone: 'info' }
}

/** 清除缓存但保留当前相册授权。参数：无。 */
async function clearCache() {
  if (isAnyFileOperationBusy.value) return
  const directoryHandle = albumDirectoryHandle.value
  if (!directoryHandle) return
  const confirmed = await openConfirmDialog({
    title: locale.value.app.clearCacheDialogTitle,
    message: locale.value.app.clearCacheConfirmMessage,
    tone: 'warning',
    confirmLabel: locale.value.topBar.clearCache,
    cancelLabel: locale.value.app.dialogCancel
  })
  if (!confirmed) return

  try {
    await clearSavedX6GameDirectoryHandle()
    localStorage.removeItem(OUTFIT_GUIDE_DISMISSED_KEY)
    localStorage.removeItem(X6GAME_AUTO_PROMPT_DISMISSED_KEY)
    sharedOutfitSource.value = null
    hasX6GameAuthorization.value = false
    cleanupX6GameHandle.value = null
    isOutfitGuideDismissed.value = false
    isX6GameAutoPromptDismissed.value = false
    didCancelX6GameAutoPrompt.value = false
    const result = await readAlbumDirectory(directoryHandle, { requestPermission: false, messages: locale.value.fileSystem })
    await replaceAlbum(result, { type: 'custom', message: locale.value.app.clearCacheStatus, tone: 'success' })
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  }
}

/** 确认后清除所有网站本地数据和授权。参数：无。 */
async function clearData() {
  if (isAnyFileOperationBusy.value) return
  const confirmed = await openConfirmDialog({
    title: locale.value.app.clearDataDialogTitle,
    message: locale.value.app.clearDataFirstConfirmMessage,
    tone: 'danger',
    confirmLabel: locale.value.topBar.clearData,
    cancelLabel: locale.value.app.dialogCancel
  })
  if (!confirmed) return

  suppressLocalPersistence = true
  try {
    await clearSavedAlbumDirectoryHandle()
    await clearSavedX6GameDirectoryHandle()
    clearWebsiteLocalStorage()
    resetLoadedAlbumState()
    cleanupX6GameHandle.value = null
    hasX6GameAuthorization.value = false
    favoriteIds.value = new Set()
    activeOutfitFilter.value = 'all'
    albumDirectoryHandle.value = null
    activeView.value = 'all'
    directoryState.value = { type: 'none' }
    language.value = DEFAULT_LANGUAGE
    thumbnailMode.value = 'default'
    outfitThumbnailMode.value = 'portrait-standard'
    themeMode.value = 'light'
    isOutfitGuideDismissed.value = false
    isX6GameAutoPromptDismissed.value = false
    didCancelX6GameAutoPrompt.value = false
    statusState.value = { type: 'custom', message: locale.value.app.clearDataStatus, tone: 'success' }
    await nextTick()
  } finally {
    suppressLocalPersistence = false
  }
}

/**
 * 应用增量刷新结果并清理失效状态。
 * 参数：result 为文件系统扫描结果。
 */
function applyRefreshResult(result: RefreshAlbumResult) {
  for (const photo of result.removedPhotos) releasePhotoUrl(photo)
  for (const photo of result.replacedPhotos) releasePhotoUrl(photo)
  photos.value = result.photos
  mergeRecentlyDeleted(result.recentlyDeleted)
  const validPhotoIds = new Set(photos.value.map((photo) => photo.id))
  selectedIds.value = new Set([...selectedIds.value].filter((id) => validPhotoIds.has(id)))
  // 收藏记录不随刷新裁剪：其他相册的收藏必须保留，本相册临时缺失的文件重新出现后收藏仍生效
  if (currentPreview.value) {
    const refreshedPreview = previewPhotos.value.find((photo) => photo.id === currentPreview.value?.id)
    currentPreview.value = refreshedPreview ?? null
  }
}

/**
 * 刷新相册和最近删除目录。
 * 参数：manual 表示是否由用户点击触发；手动刷新可请求权限，并始终显示“更新中”和结果提示；
 * 后台自动刷新平时静默，检测到新增导入时补显示“更新中”，并在有新增、移除或失败时显示结果。
 */
async function refreshAlbum(manual: boolean) {
  const directoryHandle = albumDirectoryHandle.value
  if (!directoryHandle || isAnyFileOperationBusy.value || confirmDialog.value.visible || isOutfitEditorVisible.value) return
  isRefreshing.value = true
  if (manual) {
    statusState.value = {
      type: 'custom',
      message: activeView.value === 'outfits' ? outfitLocale.value.updating : locale.value.topBar.refreshing,
      tone: 'info',
      loading: true
    }
  }
  try {
    const result = await refreshAlbumDirectory(directoryHandle, photos.value, {
      requestPermission: manual,
      messages: locale.value.fileSystem
    })
    applyRefreshResult(result)
    const outfitResult = await refreshOutfitLibrary(true, activeView.value === 'outfits', () => {
      // 后台刷新检测到新增导入时补显示“更新中”；手动刷新的提示已在进入时显示
      if (manual) return
      statusState.value = {
        type: 'custom',
        message: activeView.value === 'outfits' ? outfitLocale.value.updating : locale.value.topBar.refreshing,
        tone: 'info',
        loading: true
      }
    })
    if (didCancelX6GameAutoPrompt.value) return
    const outfitAddedCount = outfitResult.importedExternalCount + outfitResult.importedSharedCount
    if (outfitAddedCount || outfitResult.failedCount) {
      statusState.value = {
        type: 'custom',
        message: outfitLocale.value.scanComplete(outfitAddedCount, outfitResult.failedCount),
        tone: outfitResult.failedCount ? 'warning' : 'success'
      }
    } else if (result.addedCount || result.removedCount) {
      statusState.value = { type: 'custom', message: locale.value.trash.refreshStatus(result.addedCount, result.removedCount), tone: 'success' }
    } else if (manual) {
      // 仅用户手动刷新时提示“已是最新”，后台刷新无变化则完全静默
      statusState.value = {
        type: 'custom',
        message: activeView.value === 'outfits' ? outfitLocale.value.upToDate : locale.value.trash.upToDate,
        tone: 'success'
      }
    }
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isRefreshing.value = false
  }
}

/** 切换缩略图尺寸。参数：mode 为目标模式。 */
function changeThumbnailMode(mode: ThumbnailMode) {
  if (activeView.value === 'outfits') {
    outfitThumbnailMode.value = mode
    if (!suppressLocalPersistence) localStorage.setItem(OUTFIT_THUMBNAIL_STORAGE_KEY, mode)
    return
  }
  thumbnailMode.value = mode
  if (!suppressLocalPersistence) localStorage.setItem(THUMBNAIL_STORAGE_KEY, mode)
}

/** 切换亮暗主题。参数：无。 */
function toggleTheme() {
  return applyPreference('theme')
}

// X6Game 授权与搭配码流程
/** 获取或恢复当前相册对应的 X6Game 授权，用于自动读取游戏最新搭配码。参数：prompt 表示是否允许弹出授权说明，autoPrompt 表示是否为搭配码界面自动触发。 */
async function ensureSharedOutfitSource(prompt: boolean, autoPrompt = prompt, forcePick = false): Promise<SharedOutfitSource | null> {
  const directoryHandle = albumDirectoryHandle.value
  if (!directoryHandle) return null
  if (sharedOutfitSource.value && !forcePick) return sharedOutfitSource.value
  if (autoPrompt && isX6GameAutoPromptDismissed.value) return null

  let didCancelDirectoryPrompt = false
  try {
    const result = await getX6GameDirectoryForAlbum(directoryHandle, locale.value.fileSystem, {
      allowUnrelatedAlbum: true,
      forcePick,
      beforeRequestX6GamePermission: async () => {
        if (!prompt || forcePick) return true
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
        if (!prompt || forcePick) return true
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
    sharedOutfitSource.value = { x6GameDirectory: result.directoryHandle }
    hasX6GameAuthorization.value = true
    isX6GameAutoPromptDismissed.value = false
    didCancelX6GameAutoPrompt.value = false
    if (!suppressLocalPersistence) localStorage.removeItem(X6GAME_AUTO_PROMPT_DISMISSED_KEY)
    return sharedOutfitSource.value
  } catch (error) {
    if (autoPrompt && (didCancelDirectoryPrompt || (error instanceof Error && error.message === locale.value.fileSystem.abortSelection))) {
      dismissX6GameAutoPrompt()
      return null
    }
    if (didCancelDirectoryPrompt) return null
    if (prompt) statusState.value = createErrorStatus(error, { type: 'readFailed' })
    return null
  }
}

/** 手动授权当前相册对应的 X6Game 文件夹。参数：无。 */
async function authorizeX6GameDirectory() {
  if (!albumDirectoryHandle.value || isAnyFileOperationBusy.value) return
  const source = await ensureSharedOutfitSource(true, false, hasX6GameAuthorization.value)
  if (!source) return
  statusState.value = { type: 'custom', message: locale.value.app.authorizeX6GameStatus, tone: 'success' }
}

/** 重新扫描搭配方案，并释放已经失效的图片地址。参数：importExternal 表示是否接收外部图片，promptSharedAccess 表示是否允许弹出授权，onImportStart 在检测到新增导入时触发。 */
function applyOutfitLibraryResult(result: OutfitLibraryResult) {
  const previousPreviewId = activeView.value === 'outfits' ? currentPreview.value?.id : null
  releasePhotoUrls(outfits.value)
  outfits.value = result.outfits
  outfitTags.value = result.tags
  const validOutfitIds = new Set(result.outfits.map((outfit) => outfit.id))
  selectedOutfitIds.value = new Set([...selectedOutfitIds.value].filter((id) => validOutfitIds.has(id)))
  if (activeOutfitFilter.value.startsWith('tag:') && !result.tags.includes(activeOutfitFilter.value.slice(4))) {
    activeOutfitFilter.value = 'all'
  }
  if (previousPreviewId) currentPreview.value = result.outfits.find((outfit) => outfit.id === previousPreviewId) ?? null
}

/** 重新扫描搭配方案，并释放已经失效的图片地址。参数：importExternal 表示是否接收外部图片，promptSharedAccess 表示是否允许弹出授权，onImportStart 在检测到新增导入时触发。 */
async function refreshOutfitLibrary(importExternal: boolean, promptSharedAccess = false, onImportStart?: () => void): Promise<OutfitLibraryResult> {
  const directoryHandle = albumDirectoryHandle.value
  if (!directoryHandle) return { outfits: [], tags: [], importedExternalCount: 0, importedSharedCount: 0, failedCount: 0 }
  const sharedSource = await ensureSharedOutfitSource(promptSharedAccess)
  const result = await readOutfitLibrary(directoryHandle, { importExternal, create: true, sharedSource, onImportStart })
  applyOutfitLibraryResult(result)
  return result
}

/** 显示搭配码更新结果。参数：result 为扫描结果；无新增和失败时提示已是最新状态。 */
function showOutfitRefreshResult(result: OutfitLibraryResult) {
  const addedCount = result.importedExternalCount + result.importedSharedCount
  if (result.sharedFailureStage) {
    showOutfitStatus(
      outfitLocale.value.sharedImportResult[result.sharedFailureStage],
      result.sharedFailureStage === 'duplicate' ? 'success' : 'warning'
    )
    return
  }
  showOutfitStatus(
    addedCount || result.failedCount
      ? outfitLocale.value.scanComplete(addedCount, result.failedCount)
      : outfitLocale.value.upToDate,
    result.failedCount ? 'warning' : 'success'
  )
}

/**
 * 更新搭配码库。
 * 参数：importExternal 表示是否接收直接放入 clothe 的图片；
 * announce 表示是否为用户明确触发，用户触发时立即显示“更新中”和完整结果；
 * 后台扫描在检测到新增导入时才补显示“更新中”，无新增且无失败则完全静默。
 */
async function updateOutfitLibrary(importExternal = true, announce = true) {
  if (isUpdatingOutfits.value) return
  isUpdatingOutfits.value = true
  // announced 标记“更新中”是否已弹出，避免后台扫描补提示时重复显示
  let announced = announce
  if (announce) showOutfitStatus(outfitLocale.value.updating, 'info', true)
  try {
    didCancelX6GameAutoPrompt.value = false
    const result = await refreshOutfitLibrary(importExternal, true, () => {
      if (announced) return
      announced = true
      showOutfitStatus(outfitLocale.value.updating, 'info', true)
    })
    if (didCancelX6GameAutoPrompt.value) return
    const addedCount = result.importedExternalCount + result.importedSharedCount
    if (announce || addedCount || result.failedCount) showOutfitRefreshResult(result)
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isUpdatingOutfits.value = false
  }
}

/** 切换相册视图并清空上个视图的选中状态（重复点击当前视图不清空）。参数：view 为目标视图；进入搭配码时按用户偏好显示操作指南。 */
function changeAlbumView(view: AlbumView) {
  const isViewChanged = view !== activeView.value
  const isEnteringOutfits = view === 'outfits' && isViewChanged
  activeView.value = view
  currentPreview.value = null
  // 视图真正变化时清空所有选中状态，避免上个视图的选中残留；重复点击当前视图不受影响
  if (isViewChanged) {
    selectedIds.value = new Set()
    selectedOutfitIds.value = new Set()
    trashSelectedIds.value = new Set()
  }
  activeOutfitFilter.value = 'all'
  if (view === 'trash') void refreshAlbum(false)
  if (view === 'outfits') void updateOutfitLibrary(true)
  isOutfitGuideVisible.value = isEnteringOutfits && !isOutfitGuideDismissed.value
}

/** 关闭搭配码操作指南。参数：dontShowAgain 表示后续进入模块时是否不再显示；同时同步本地偏好。 */
function closeOutfitGuide(dontShowAgain: boolean) {
  isOutfitGuideDismissed.value = dontShowAgain
  if (!suppressLocalPersistence) {
    if (dontShowAgain) localStorage.setItem(OUTFIT_GUIDE_DISMISSED_KEY, 'true')
    else localStorage.removeItem(OUTFIT_GUIDE_DISMISSED_KEY)
  }
  isOutfitGuideVisible.value = false
}

/** 从更多菜单打开“关于网站”窗口。参数：无。 */
function openAboutDialog() {
  isAboutDialogVisible.value = true
}

/** 关闭“关于网站”窗口。参数：dontShowAgain 表示当前版本是否不再自动弹出；同时把版本号和勾选状态保存到本地。 */
function closeAboutDialog(dontShowAgain: boolean) {
  isAboutDialogDismissed.value = dontShowAgain
  if (!suppressLocalPersistence) {
    localStorage.setItem(ABOUT_STATE_STORAGE_KEY, JSON.stringify({ version: currentAboutVersion, dismissed: dontShowAgain }))
  }
  isAboutDialogVisible.value = false
}

function showOutfitStatus(message: string, tone: StatusTone = 'success', loading = false) {
  statusState.value = { type: 'custom', message, tone, loading }
}

function changeOutfitFilter(filter: OutfitFilter) {
  selectedOutfitIds.value = new Set()
  activeOutfitFilter.value = filter
}

function openOutfitEditor(outfit: OutfitItem | null = null) {
  editingOutfit.value = outfit
  isOutfitEditorVisible.value = true
}

async function editPhotoNote(photo: PhotoItem | null) {
  const directory = albumDirectoryHandle.value
  if (!directory || !photo || isAnyFileOperationBusy.value) return
  noteDialogPhoto.value = photo
  isNoteDialogVisible.value = true
}

function closeNoteDialog() {
  if (isAnyFileOperationBusy.value) return
  isNoteDialogVisible.value = false
  noteDialogPhoto.value = null
}

async function saveNoteDialog(value: string) {
  const directory = albumDirectoryHandle.value
  const photo = noteDialogPhoto.value
  if (!directory || !photo || isAnyFileOperationBusy.value) return
  try {
    photo.note = await savePhotoNote(directory, photo.name, value)
    isNoteDialogVisible.value = false
    noteDialogPhoto.value = null
    showOutfitStatus(locale.value.grid.noteSaved)
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  }
}

/** 关闭搭配码编辑窗口。参数：scan 表示关闭后是否自动重扫搭配码库；自动重扫属于后台行为，无变化时保持静默。 */
async function closeOutfitEditor(scan = true) {
  if (isSavingOutfit.value) return
  isOutfitEditorVisible.value = false
  editingOutfit.value = null
  if (!scan) return
  await updateOutfitLibrary(true, false)
}

/** 保存搭配方案。参数：input 为图片、搭配码和标签；保存及重新扫描全部成功后才关闭编辑窗口。 */
async function handleSaveOutfit(input: Omit<SaveOutfitInput, 'outfit'>) {
  const directoryHandle = albumDirectoryHandle.value
  if (!directoryHandle || isAnyFileOperationBusy.value) return
  isSavingOutfit.value = true
  showOutfitStatus(outfitLocale.value.saving, 'info', true)
  try {
    await saveOutfit(directoryHandle, { ...input, outfit: editingOutfit.value ?? undefined })
    const wasEditing = Boolean(editingOutfit.value)
    await refreshOutfitLibrary(true)
    isOutfitEditorVisible.value = false
    editingOutfit.value = null
    showOutfitStatus(
      outfitLocale.value.operations.saveSucceeded(wasEditing),
      'success'
    )
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isSavingOutfit.value = false
  }
}

/** 新增搭配标签。参数：用户输入的原始标签文本。 */
async function addOutfitTag(rawTag: string, selectInEditor = false) {
  const directoryHandle = albumDirectoryHandle.value
  if (!directoryHandle || isAnyFileOperationBusy.value) return
  const tag = normalizeOutfitTag(rawTag)
  const reserved = new Set(['全部', '待填写', '未分类', 'all', 'pending', 'uncategorized'])
  if (!isValidOutfitTag(tag)) {
    showOutfitStatus(outfitLocale.value.operations.invalidTag(MAX_OUTFIT_TAG_LENGTH), 'warning')
    return
  }
  if (reserved.has(tag.toLowerCase()) || outfitTags.value.includes(tag)) {
    showOutfitStatus(outfitLocale.value.operations.duplicateOrReservedTag, 'warning')
    return
  }
  if (outfitTags.value.length >= MAX_OUTFIT_TAGS) {
    showOutfitStatus(outfitLocale.value.operations.tagLimitReached(MAX_OUTFIT_TAGS), 'warning')
    return
  }
  isOutfitMutationBusy.value = true
  try {
    outfitTags.value = await saveOutfitTags(directoryHandle, [tag, ...outfitTags.value])
    outfitSidebarRef.value?.closeTagInput()
    if (selectInEditor) outfitEditorRef.value?.selectCreatedTag(tag)
    showOutfitStatus(outfitLocale.value.operations.tagAdded)
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isOutfitMutationBusy.value = false
  }
}

/** 保存用户在左侧栏调整后的标签顺序。参数：tags 为拖拽完成后的完整标签数组。 */
async function reorderOutfitTags(tags: string[]) {
  const directoryHandle = albumDirectoryHandle.value
  if (!directoryHandle || isAnyFileOperationBusy.value) return
  const previousTags = [...outfitTags.value]
  outfitTags.value = [...tags]
  isOutfitMutationBusy.value = true
  try {
    outfitTags.value = await saveOutfitTags(directoryHandle, tags)
  } catch (error) {
    outfitTags.value = previousTags
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isOutfitMutationBusy.value = false
  }
}

async function removeOutfitTag(tag: string) {
  const directoryHandle = albumDirectoryHandle.value
  if (!directoryHandle || isAnyFileOperationBusy.value) return
  const usedCount = outfits.value.filter((outfit) => outfit.tags[0] === tag).length
  if (usedCount) {
    const confirmed = await openConfirmDialog({
      title: outfitLocale.value.operations.deleteTagTitle,
      message: outfitLocale.value.operations.deleteTagMessage(tag, usedCount),
      tone: 'warning',
      confirmLabel: outfitLocale.value.operations.deleteTagTitle,
      cancelLabel: locale.value.app.dialogCancel
    })
    if (!confirmed) return
  }
  try {
    isOutfitMutationBusy.value = true
    const result = await deleteOutfitTag(directoryHandle, outfits.value, tag)
    outfitTags.value = result.tags
    await refreshOutfitLibrary(false)
    showOutfitStatus(outfitLocale.value.operations.tagDeleted)
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isOutfitMutationBusy.value = false
  }
}

async function copyOutfitCode(outfit: OutfitItem) {
  if (!outfit.code) return
  try {
    await navigator.clipboard.writeText(outfit.code)
    showOutfitStatus(outfitLocale.value.operations.copySucceeded)
  } catch {
    showOutfitStatus(outfitLocale.value.operations.copyFailed(outfit.code), 'warning')
  }
}

/** 删除单个搭配方案，先弹确认框再执行删除。参数：outfit 为待删除的搭配方案。 */
async function removeOutfit(outfit: OutfitItem) {
  if (isAnyFileOperationBusy.value) return
  const confirmed = await openConfirmDialog({
    title: outfitLocale.value.operations.deleteOutfitTitle,
    message: outfitLocale.value.operations.confirmPermanentDelete,
    tone: 'danger',
    confirmLabel: outfitLocale.value.operations.permanentlyDelete,
    cancelLabel: locale.value.app.dialogCancel
  })
  if (!confirmed) return
  try {
    isOutfitMutationBusy.value = true
    await deleteOutfit(outfit)
    releasePhotoUrl(outfit)
    if (currentPreview.value?.id === outfit.id) currentPreview.value = null
    outfits.value = outfits.value.filter((item) => item.id !== outfit.id)
    showOutfitStatus(outfitLocale.value.operations.outfitDeleted)
  } catch (error) {
    await refreshOutfitLibrary(false).catch(() => undefined)
    showOutfitStatus(outfitLocale.value.operations.deleteIncomplete, 'warning')
  } finally {
    isOutfitMutationBusy.value = false
  }
}

/** 永久删除当前选中的搭配方案。参数：无；删除结果不会进入最近删除。 */
async function deleteSelectedOutfits() {
  const targets = visibleOutfits.value.filter((outfit) => selectedOutfitIds.value.has(outfit.id))
  if (!targets.length || isAnyFileOperationBusy.value) return
  const confirmed = await openConfirmDialog({
    title: outfitLocale.value.operations.deleteSelectedTitle,
    message: outfitLocale.value.operations.confirmPermanentDelete,
    tone: 'danger',
    confirmLabel: outfitLocale.value.operations.permanentlyDelete,
    cancelLabel: locale.value.app.dialogCancel
  })
  if (!confirmed) return

  isOutfitMutationBusy.value = true
  showOutfitStatus(outfitLocale.value.operations.deletingSelected, 'info', true)
  try {
    const result = await deleteOutfits(targets)
    const deletedIds = new Set(result.deleted.map((outfit) => outfit.id))
    const failedNames = result.failedNames
    result.deleted.forEach((outfit) => releasePhotoUrl(outfit))
    if (currentPreview.value && deletedIds.has(currentPreview.value.id)) currentPreview.value = null
    selectedOutfitIds.value = new Set([...selectedOutfitIds.value].filter((id) => !deletedIds.has(id)))
    outfits.value = outfits.value.filter((outfit) => !deletedIds.has(outfit.id))
    showOutfitStatus(outfitLocale.value.operations.deletedSelected(deletedIds.size, failedNames.length), failedNames.length ? 'warning' : 'success')
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isOutfitMutationBusy.value = false
  }
}

/** 确认后将搭配码 ZIP 直接导出到当前相册根目录。参数：无。 */
async function exportOutfits() {
  const directoryHandle = albumDirectoryHandle.value
  if (!directoryHandle || isAnyFileOperationBusy.value) return
  const confirmed = await openConfirmDialog({
    title: outfitLocale.value.operations.exportTitle,
    message: outfitLocale.value.operations.exportConfirm(directoryHandle.name),
    tone: 'info',
    confirmLabel: outfitLocale.value.operations.exportAction,
    cancelLabel: locale.value.app.dialogCancel
  })
  if (!confirmed) return
  isExportingOutfits.value = true
  showOutfitStatus(outfitLocale.value.exporting, 'info', true)
  try {
    const result = await exportOutfitBackup(directoryHandle, directoryHandle)
    statusState.value = {
      type: 'custom',
      message: outfitLocale.value.operations.exportSucceeded(result.fileName, result.count),
      tone: 'success'
    }
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isExportingOutfits.value = false
  }
}

function chooseOutfitBackup() {
  if (isAnyFileOperationBusy.value) return
  suppressNextFocusRefresh = true
  outfitImportInput.value?.click()
}

async function importOutfits(event: Event) {
  const directoryHandle = albumDirectoryHandle.value
  const input = event.target as HTMLInputElement
  suppressNextFocusRefresh = false
  const file = input.files?.[0]
  input.value = ''
  if (!directoryHandle || !file || isAnyFileOperationBusy.value) return
  isImportingOutfits.value = true
  showOutfitStatus(outfitLocale.value.importing, 'info', true)
  try {
    const result = await importOutfitBackup(directoryHandle, file)
    applyOutfitLibraryResult(result.library)
    const tagNote = result.rejectedTagCount
      ? outfitLocale.value.operations.rejectedTags(result.rejectedTagCount)
      : ''
    showOutfitStatus(
      outfitLocale.value.operations.importCompleted(result.addedCount, result.duplicateCount, result.failedCount, tagNote),
      result.failedCount || result.rejectedTagCount ? 'warning' : 'success'
    )
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    isImportingOutfits.value = false
  }
}

// 相册、搭配码与最近删除选择状态
/** 切换普通照片当前视图的全选状态。参数：无。 */
function toggleAll() {
  const visibleIds = new Set(visiblePhotos.value.map((photo) => photo.id))
  if (allSelected.value) {
    selectedIds.value = new Set([...selectedIds.value].filter((id) => !visibleIds.has(id)))
    return
  }
  selectedIds.value = new Set([...selectedIds.value, ...visibleIds])
}

/** 切换当前搭配码筛选结果的全选状态。参数：无。 */
function toggleAllOutfits() {
  const visibleIds = new Set(visibleOutfits.value.map((outfit) => outfit.id))
  selectedOutfitIds.value = allOutfitsSelected.value
    ? new Set([...selectedOutfitIds.value].filter((id) => !visibleIds.has(id)))
    : new Set([...selectedOutfitIds.value, ...visibleIds])
}

/** 切换单个搭配方案的选中状态。参数：outfitId 为方案 ID。 */
function toggleOutfit(outfitId: string) {
  const next = new Set(selectedOutfitIds.value)
  next.has(outfitId) ? next.delete(outfitId) : next.add(outfitId)
  selectedOutfitIds.value = next
}

/** 清空搭配方案选择。参数：无。 */
function clearOutfitSelection() {
  selectedOutfitIds.value = new Set()
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
  const selectedPhotoIds = scopedSelectedPhotos.value.map((photo) => photo.id)
  favoriteIds.value = new Set([...favoriteIds.value, ...selectedPhotoIds])
}

/** 取消选中照片的收藏状态；收藏夹视图中照片会消失故同步移除选择，普通视图保留选择以便再次收藏。参数：无。 */
function unfavoriteSelectedPhotos() {
  const targetIds = new Set(scopedSelectedPhotos.value.map((photo) => photo.id))
  favoriteIds.value = new Set([...favoriteIds.value].filter((id) => !targetIds.has(id)))
  if (activeView.value === 'favorites') {
    selectedIds.value = new Set([...selectedIds.value].filter((id) => !targetIds.has(id)))
  }
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
    mergeRecentlyDeleted(
      [...recentlyDeleted.value, ...result.movedPhotos].sort((a, b) => b.deletedAt - a.deletedAt)
    )

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
  await movePhotosToTrash(scopedSelectedPhotos.value)
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
 * 参数：targets 为待删除照片，options 控制是否继续预览相邻照片及是否已在调用方完成确认。
 */
async function permanentlyDeleteTrashPhotos(
  targets: RecentlyDeletedPhoto[],
  options: { keepPreviewOpen?: boolean; skipConfirmation?: boolean; clearDirectory?: boolean } = {}
) {
  if (!targets.length || isAnyFileOperationBusy.value) return
  if (!options.skipConfirmation) {
    const confirmed = await openConfirmDialog({
      title: locale.value.trash.permanentDeleteDialogTitle,
      message: locale.value.trash.confirmPermanentDelete(targets.length),
      tone: 'danger',
      confirmLabel: locale.value.app.dialogConfirm,
      cancelLabel: locale.value.app.dialogCancel
    })
    if (!confirmed) return
  }

  isTrashBusy.value = true
  statusState.value = { type: 'custom', message: locale.value.app.permanentlyDeletingPhotos, tone: 'info', loading: true }
  const previewIndex = currentPreviewIndex.value
  const keepPreviewOpen = options.keepPreviewOpen ?? false
  try {
    const result = options.clearDirectory && albumDirectoryHandle.value
      ? await clearRecentlyDeleted(albumDirectoryHandle.value, targets)
      : await permanentlyDeleteRecentlyDeleted(targets)
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

/** 一键清空全部最近删除。参数：无。 */
async function deleteAllTrash() {
  if (!recentlyDeleted.value.length) return
  const confirmed = await openConfirmDialog({
    title: locale.value.trash.permanentDeleteDialogTitle,
    message: locale.value.trash.confirmDeleteAll(recentlyDeleted.value.length),
    tone: 'danger',
    confirmLabel: locale.value.app.dialogConfirm,
    cancelLabel: locale.value.app.dialogCancel
  })
  if (!confirmed) return
  await permanentlyDeleteTrashPhotos([...recentlyDeleted.value], { skipConfirmation: true, clearDirectory: true })
}

/** 恢复当前最近删除预览照片。参数：无。 */
async function restoreCurrentTrashPreview() {
  if (!currentPreview.value || activeView.value !== 'trash') return
  await restoreTrashPhotos([currentPreview.value as RecentlyDeletedPhoto], true)
}

/** 永久删除当前最近删除预览照片。参数：无。 */
async function permanentlyDeleteCurrentTrashPreview() {
  if (!currentPreview.value || activeView.value !== 'trash') return
  await permanentlyDeleteTrashPhotos(
    [currentPreview.value as RecentlyDeletedPhoto],
    { keepPreviewOpen: true }
  )
}

// 专项清理
/** 打开专项清理窗口，并静默恢复已保存的 X6Game 授权。参数：无。 */
async function openCleanupDialog() {
  showCleanupDialog.value = true
  if (cleanupX6GameHandle.value) return

  const savedHandle = await getSavedX6GameDirectoryHandle()
  if (!savedHandle || savedHandle.name !== 'X6Game') return

  try {
    // 只在浏览器仍保留授权时直接恢复，不主动弹出权限请求
    const permission = savedHandle.queryPermission ? await savedHandle.queryPermission({ mode: 'readwrite' }) : 'granted'
    if (permission === 'granted') {
      cleanupX6GameHandle.value = savedHandle
      hasX6GameAuthorization.value = true
    }
  } catch {
    // 静默恢复失败时，用户可在窗口内手动授权
  }
}

/** 在专项清理窗口中授权 X6Game 文件夹。参数：无。 */
async function authorizeCleanupFolder() {
  if (isAnyFileOperationBusy.value) return
  let didCancelDirectoryPrompt = false
  const alreadyAuthorized = Boolean(cleanupX6GameHandle.value || hasX6GameAuthorization.value)
  try {
    const handle = await pickStandaloneX6GameDirectory(locale.value.fileSystem, {
      forcePick: true,
      beforeRequestX6GamePermission: async () => {
        if (alreadyAuthorized) return true
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
        if (alreadyAuthorized) return true
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
    cleanupX6GameHandle.value = handle
    hasX6GameAuthorization.value = true
    statusState.value = { type: 'custom', message: locale.value.app.authorizeX6GameStatus, tone: 'success' }
  } catch (error) {
    if (didCancelDirectoryPrompt) return
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  }
}

/** 处理多账号选择结果。参数：accountIds 为确认的账号列表，取消时传 null；remember 为是否记住选择，choice 为具体选项（'all' 或账号 id）。 */
function resolveCleanupAccounts(accountIds: string[] | null, remember = false, choice = '') {
  showCleanupAccountDialog.value = false
  if (accountIds) {
    // 勾选“记住我的选择”时保存选项，取消勾选时清除；窗口下次仍会打开并回填，方便改选
    persistCleanupAccountChoice(remember && choice ? choice : null)
  }
  cleanupAccountResolver.value?.(accountIds)
  cleanupAccountResolver.value = null
}

/** 确定低画质清理的目标账号：优先从当前相册推导，失败时列出全部账号让用户选择。参数：x6GameHandle 为已授权的 X6Game 目录。返回：目标账号 id 列表；用户取消时返回 null。 */
async function resolveCleanupAccountIds(x6GameHandle: FileSystemDirectoryHandle): Promise<string[] | null> {
  // 优先沿用现有逻辑：从当前相册路径推导账号 id
  const albumHandle = albumDirectoryHandle.value
  if (albumHandle) {
    try {
      const accountId = await resolveX6GameAccountDirectory(x6GameHandle, albumHandle, locale.value.fileSystem)
      if (accountId) return [accountId]
    } catch {
      // 相册与 X6Game 无关时改为扫描账号文件夹
    }
  }

  const accounts = await listGamePlayPhotoAccounts(x6GameHandle)
  if (accounts.length <= 1) return accounts

  // 多账号时弹窗让用户选择清理全部账号或指定账号 id，并带出记住的选择用于回填
  cleanupAccounts.value = accounts
  cleanupRememberedChoice.value = readCleanupAccountChoice()
  showCleanupAccountDialog.value = true
  return new Promise<string[] | null>((resolve) => {
    cleanupAccountResolver.value = resolve
  })
}

/** 清理低画质图片和截图。参数：x6GameHandle 为已授权的 X6Game 目录。 */
async function cleanLowQualityPhotos(x6GameHandle: FileSystemDirectoryHandle) {
  const accountIds = await resolveCleanupAccountIds(x6GameHandle)
  if (!accountIds) {
    statusState.value = { type: 'custom', message: locale.value.app.relatedCleanupCancelledStatus, tone: 'info' }
    return
  }

  const plan = await prepareSpecialCleanup(x6GameHandle, 'lowQuality', accountIds)
  if (!plan.fileCount) {
    statusState.value = {
      type: 'custom',
      message: locale.value.app.noRelatedPhotos(plan.missingDirectories),
      tone: plan.missingDirectories.length ? 'warning' : 'info'
    }
    return
  }

  const confirmed = await openConfirmDialog({
    title: locale.value.app.relatedCleanupDialogTitle,
    message: locale.value.app.confirmRelatedCleanup(plan.fileCount, plan.missingDirectories),
    tone: 'warning',
    confirmLabel: locale.value.app.dialogConfirm,
    cancelLabel: locale.value.app.dialogCancel
  })
  if (!confirmed) {
    statusState.value = { type: 'custom', message: locale.value.app.relatedCleanupCancelledStatus, tone: 'info' }
    return
  }

  const result = await executeSpecialCleanup(plan)
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
}

/** 清空目录类清理项的内容并保留文件夹本身。参数：x6GameHandle 为已授权的 X6Game 目录，item 为目录类清理项。 */
async function cleanSpecialDirectory(x6GameHandle: FileSystemDirectoryHandle, item: Exclude<SpecialCleanupItem, 'lowQuality'>) {
  const itemTitle = locale.value.cleanup.items[item].title
  const plan = await prepareSpecialCleanup(x6GameHandle, item)
  if (!plan.fileCount) {
    statusState.value = {
      type: 'custom',
      message: locale.value.cleanup.noDirectoryFilesToClean(itemTitle, plan.missingDirectories),
      tone: plan.missingDirectories.length ? 'warning' : 'info'
    }
    return
  }

  const confirmed = await openConfirmDialog({
    title: locale.value.cleanup.confirmDirectoryCleanupTitle,
    message: locale.value.cleanup.confirmDirectoryCleanup(
      itemTitle,
      plan.fileCount,
      `${formatFileSize(plan.totalBytes)}${plan.totalBytesKnown ? '' : language.value === 'zh' ? '（部分文件大小未知）' : ' (some file sizes unknown)'}`
    ),
    tone: 'warning',
    confirmLabel: locale.value.app.dialogConfirm,
    cancelLabel: locale.value.app.dialogCancel
  })
  if (!confirmed) {
    statusState.value = { type: 'custom', message: locale.value.app.relatedCleanupCancelledStatus, tone: 'info' }
    return
  }

  const result = await executeSpecialCleanup(plan)
  statusState.value = {
    type: 'custom',
    message: locale.value.cleanup.directoryCleanupStatus(
      itemTitle,
      result.deletedCount,
      result.deletedBytes,
      result.failures,
      result.missingDirectories
    ),
    tone: result.failures.length || result.missingDirectories.length ? 'warning' : 'success'
  }
}

/** 执行专项清理项。参数：item 为清理项标识。 */
async function cleanSpecialItem(item: SpecialCleanupItem) {
  const x6GameHandle = cleanupX6GameHandle.value
  if (!x6GameHandle || cleaningItem.value !== null) return
  cleaningItem.value = item
  try {
    if (item === 'lowQuality') {
      await cleanLowQualityPhotos(x6GameHandle)
    } else {
      await cleanSpecialDirectory(x6GameHandle, item)
    }
  } catch (error) {
    statusState.value = createErrorStatus(error, { type: 'readFailed' })
  } finally {
    cleaningItem.value = null
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
  if (suppressNextFocusRefresh) {
    suppressNextFocusRefresh = false
    return
  }
  if (document.visibilityState === 'hidden' || !albumDirectoryHandle.value || isOutfitEditorVisible.value) return
  if (focusRefreshTimer !== undefined) window.clearTimeout(focusRefreshTimer)
  focusRefreshTimer = window.setTimeout(() => {
    focusRefreshTimer = undefined
    void refreshAlbum(false)
  }, 400)
}

// 生命周期
onMounted(() => {
  void restoreSavedDirectory()
  void restoreSavedX6GameAuthorization()
  // 没有记录、版本号变化或未勾选“不再提示”时，打开网站自动显示“关于网站”窗口
  if (!storedAboutState || storedAboutState.version !== currentAboutVersion || !storedAboutState.dismissed) {
    isAboutDialogVisible.value = true
  }
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
  releasePhotoUrls(outfits.value)
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
      :has-album-directory="Boolean(albumDirectoryHandle)"
      :has-x6-game-authorization="hasX6GameAuthorization"
      :thumbnail-mode="displayedThumbnailMode"
      :thumbnail-mode-options="thumbnailModeOptions"
      :theme-mode="themeMode"
      :language="language"
      :messages="locale.topBar"
      :fortune-messages="locale.fortuneTime"
      :search-query="searchQuery"
      @choose-directory="chooseDirectory"
      @clear-directory="clearDirectory"
      @refresh-album="refreshAlbum(true)"
      @authorize-x6-game="authorizeX6GameDirectory"
      @open-cleanup="openCleanupDialog"
      @clear-cache="clearCache"
      @clear-data="clearData"
      @change-thumbnail-mode="changeThumbnailMode"
      @toggle-language="toggleLanguage"
      @toggle-theme="toggleTheme"
      @open-about="openAboutDialog"
      @update-search="searchQuery = $event"
    />

    <main class="album-layout" :class="{ 'without-album': !albumDirectoryHandle }">
      <div v-if="albumDirectoryHandle" class="sidebar-column">
        <AlbumViewSwitcher
          :active-view="activeView"
          :all-count="photos.length"
          :outfits-count="outfits.length"
          :favorite-count="favoriteCount"
          :trash-count="recentlyDeleted.length"
          :outfit-label="outfitLocale.viewName"
          :disabled="!albumDirectoryHandle || isAnyFileOperationBusy"
          :messages="locale.viewNav"
          @change-view="changeAlbumView"
        />

        <OutfitSidebar
          v-if="activeView === 'outfits'"
          ref="outfitSidebarRef"
          :outfits="outfits"
          :tags="outfitTags"
          :active-filter="activeOutfitFilter"
          :disabled="isAnyFileOperationBusy"
          :messages="outfitLocale"
          @change-filter="changeOutfitFilter"
          @add-tag="addOutfitTag"
          @delete-tag="removeOutfitTag"
          @reorder-tags="reorderOutfitTags"
        />
        <DateSidebar
          v-else-if="activeView !== 'trash'"
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
          <p class="hidden-folder-tip">{{ locale.grid.hiddenFolderTip }}</p>
        </div>

        <header v-else class="gallery-header" :class="{ 'is-outfit-header': activeView === 'outfits' }">
          <div>
            <p class="eyebrow">{{ activeView === 'trash' ? 'TRASH' : activeView === 'outfits' ? outfitLocale.eyebrow : 'ALBUM' }}</p>
            <div v-if="activeView === 'outfits'" class="outfit-title-row">
              <h2>{{ viewTitle }}</h2>
              <button class="outfit-guide-open" type="button" :title="outfitLocale.guideOpen" :aria-label="outfitLocale.guideOpen" @click="isOutfitGuideVisible = true">
                <CircleHelp :size="17" aria-hidden="true" />
              </button>
            </div>
            <h2 v-else class="trash-header-title">{{ viewTitle }}
              <button v-if="activeView === 'trash' && recentlyDeleted.length" type="button" class="trash-clear-all-btn" :title="locale.trash.deleteAllTitle" :aria-label="locale.trash.deleteAllTitle" :disabled="isAnyFileOperationBusy" @click="deleteAllTrash">
                <Trash2 :size="18" aria-hidden="true" />
              </button>
            </h2>
          </div>
          <div v-if="activeView === 'outfits'" class="outfit-header-actions">
            <button type="button" :disabled="isAnyFileOperationBusy" @click="chooseOutfitBackup">
              <Download :size="16" aria-hidden="true" />{{ isImportingOutfits ? outfitLocale.importing : outfitLocale.importData }}
            </button>
            <button type="button" :disabled="isAnyFileOperationBusy" @click="exportOutfits">
              <FileUp :size="16" aria-hidden="true" />{{ isExportingOutfits ? outfitLocale.exporting : outfitLocale.exportData }}
            </button>
            <button class="primary-button" type="button" :disabled="isAnyFileOperationBusy" @click="openOutfitEditor()">
              <Plus :size="16" aria-hidden="true" />{{ outfitLocale.addOutfit }}
            </button>
          </div>
          <p v-if="activeView === 'trash'">{{ locale.trash.totalSummary(recentlyDeleted.length, trashTotalSizeText) }}</p>
          <p v-else-if="activeView !== 'outfits'">{{ locale.viewNav.count(visibleCount) }}</p>
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
        <OutfitGrid
          v-else-if="albumDirectoryHandle && activeView === 'outfits'"
          :outfits="visibleOutfits"
          :selected-ids="selectedOutfitIds"
          :thumbnail-mode="outfitThumbnailMode"
          :messages="outfitLocale"
          :disabled="isAnyFileOperationBusy"
          @copy="copyOutfitCode"
          @edit="openOutfitEditor"
          @delete="removeOutfit"
          @open-preview="openPreview"
          @toggle-outfit="toggleOutfit"
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
          @edit-note="editPhotoNote"
        />
      </section>
    </main>

    <SelectionBar
      :mode="activeView === 'trash' ? 'trash' : activeView === 'outfits' ? 'outfit' : activeView === 'favorites' ? 'favorites' : 'album'"
      :selected-count="activeView === 'trash' ? trashSelectedCount : activeView === 'outfits' ? selectedOutfitCount : selectedCount"
      :all-selected="activeView === 'trash' ? allTrashSelected : activeView === 'outfits' ? allOutfitsSelected : allSelected"
      :all-selected-favorited="allSelectedFavorited"
      :all-items-selected="activeView === 'trash' && allTrashSelected"
      :is-busy="activeView === 'outfits' ? isAnyFileOperationBusy : isDeleting || isTrashBusy"
      :messages="locale.selectionBar"
      @toggle-all="activeView === 'trash' ? toggleAllTrash() : activeView === 'outfits' ? toggleAllOutfits() : toggleAll()"
      @favorite="favoriteSelectedPhotos"
      @unfavorite="unfavoriteSelectedPhotos"
      @delete="activeView === 'trash' ? permanentlyDeleteSelectedTrash() : activeView === 'outfits' ? deleteSelectedOutfits() : deleteSelectedPhotos()"
      @restore="restoreSelectedTrash"
      @cancel="activeView === 'trash' ? clearTrashSelection() : activeView === 'outfits' ? clearOutfitSelection() : clearAlbumSelection()"
    />

    <Lightbox
      :photo="currentPreview"
      :has-previous="hasPreviousPreview"
      :has-next="hasNextPreview"
      :is-deleting="isDeleting || isTrashBusy"
      :keyboard-enabled="!confirmDialog.visible && !isOutfitEditorVisible"
      :mode="activeView === 'trash' ? 'trash' : activeView === 'outfits' ? 'outfit' : 'album'"
      :outfit="currentPreviewOutfit"
      :outfit-messages="outfitLocale"
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
      @copy-outfit="currentPreviewOutfit && copyOutfitCode(currentPreviewOutfit)"
      @edit-outfit="currentPreviewOutfit && openOutfitEditor(currentPreviewOutfit)"
      @edit-photo-note="editPhotoNote(currentPreview)"
    />

    <OutfitEditor
      ref="outfitEditorRef"
      :visible="isOutfitEditorVisible"
      :outfit="editingOutfit"
      :tags="outfitTags"
      :busy="isAnyFileOperationBusy"
      :messages="outfitLocale"
      @close="closeOutfitEditor()"
      @save="handleSaveOutfit"
      @add-tag="addOutfitTag($event, true)"
    />

    <NoteDialog
      :visible="isNoteDialogVisible"
      :title="locale.grid.noteTitle"
      :label="locale.grid.noteLabel"
      :placeholder="locale.grid.notePlaceholder"
      :initial-value="noteDialogPhoto?.note ?? ''"
      :save-label="locale.grid.noteSave"
      :cancel-label="locale.grid.noteCancel"
      :close-label="locale.grid.noteClose"
      :max-length="15"
      :busy="isAnyFileOperationBusy"
      @save="saveNoteDialog"
      @cancel="closeNoteDialog"
    />

    <OutfitGuideDialog
      :visible="isOutfitGuideVisible"
      :dismissed="isOutfitGuideDismissed"
      :messages="outfitLocale"
      @close="closeOutfitGuide"
    />

    <AboutDialog
      :visible="isAboutDialogVisible"
      :dismissed="isAboutDialogDismissed"
      :messages="locale.about"
      :top-bar-messages="locale.topBar"
      @close="closeAboutDialog"
    />

    <CleanupDialog
      :visible="showCleanupDialog"
      :authorized-name="cleanupX6GameHandle?.name ?? null"
      :busy-item="cleaningItem"
      :disabled="isAnyFileOperationBusy"
      :messages="locale.cleanup"
      @close="showCleanupDialog = false"
      @authorize="authorizeCleanupFolder"
      @clean="cleanSpecialItem"
    />

    <CleanupAccountPicker
      :visible="showCleanupAccountDialog"
      :accounts="cleanupAccounts"
      :remembered-choice="cleanupRememberedChoice"
      :messages="locale.cleanup"
      @confirm="resolveCleanupAccounts"
      @cancel="resolveCleanupAccounts(null)"
    />

    <input ref="outfitImportInput" class="visually-hidden" type="file" accept=".zip,application/zip" @change="importOutfits" />

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
      @pause="pauseStatusNoticeTimer"
      @resume="resumeStatusNoticeTimer"
    />
  </div>
</template>
