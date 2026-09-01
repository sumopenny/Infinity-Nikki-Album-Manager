// 国际化公共类型：定义语言键、状态文案参数、完整界面文案结构和各模块字段类型。
import type { ThemeMode } from '../types/theme'
import type { RelatedCleanupFailureReason, SpecialCleanupItem } from '../utils/file-system/cleanupFileSystem'
import type { OutfitMessages } from './messages/outfit'
export type Language = 'zh' | 'en'
export type StatusPrefix = 'read' | 'restored'
export type StatusSuffix = 'continued' | 'remembered'

export interface LocaleMessages {
  outfit: OutfitMessages
  app: {
    noDirectory: string
    initialStatus: string
    readingStatus: string
    restoringStatus: string
    restoreFailedStatus: string
    restorePathFailedStatus: string
    readFailedStatus: string
    clearedStatus: string
    operationNoticeTitle: string
    operationNoticeCloseAria: string
    preferencesUpdating: string
    clearCacheDialogTitle: string
    clearCacheConfirmMessage: string
    clearCacheStatus: string
    authorizeX6GameStatus: string
    x6GameAuthorizationCancelledStatus: string
    clearDataDialogTitle: string
    clearDataFirstConfirmMessage: string
    clearDataSecondConfirmMessage: string
    clearDataStatus: string
    languageUpdated: string
    themeUpdated: string
    movingPhotosToTrash: string
    restoringPhotos: string
    permanentlyDeletingPhotos: string
    dialogCloseAria: string
    dialogCancel: string
    dialogConfirm: string
    dialogContinueAuthorization: string
    dialogOk: string
    relatedCleanupDialogTitle: string
    x6GameDirectoryDialogTitle: string
    albumContentAria: string
    rememberedDirectory: (name: string) => string
    successStatus: (count: number, prefix: StatusPrefix) => string
    successSuffix: (suffix: StatusSuffix) => string
    relatedCleanupCancelledStatus: string
    confirmRelatedCleanup: (count: number, missingDirectories: string[]) => string
    relatedCleanupStatus: (
      deletedCount: number,
      deletedBytes: number,
      failures: Array<{ path: string; reason: RelatedCleanupFailureReason }>,
      missingDirectories: string[]
    ) => string
    noRelatedPhotos: (missingDirectories: string[]) => string
  }
  topBar: {
    title: string
    starHint: string
    searchPlaceholder: string
    clearSearch: string
    githubText: string
    giteeText: string
    languageButton: string
    themeButton: (themeMode: ThemeMode) => string
    chooseDirectory: string
    loading: string
    clearDirectory: string
    authorizeX6Game: string
    reauthorizeX6Game: string
    refreshAlbum: string
    refreshing: string
    thumbnail: string
    specialCleanup: string
    currentAlbum: string
    view: string
    more: string
    albumMenuAria: string
    viewMenuAria: string
    moreMenuAria: string
    clearCache: string
    clearData: string
    helpMouseTitle: string
    helpMouseItems: string[]
    helpKeyboardTitle: string
    helpKeyboardItems: string[]
    author: string
    xiaohongshu: string
    xiaohongshuAuthor: string
    douyin: string
    douyinAuthor: string
    donate: string
    donateTitle: string
    donateDescription: string
    donateWechat: string
    donateAlipay: string
    closeDonate: string
    feedback: string
    feedbackTitle: string
    feedbackOpenExternal: string
    feedbackClose: string
    about: string
    fortuneTime: string
  }
  fortuneTime: {
    title: string
    close: string
    intro: string
    disclaimer: string
    tableTitle: string
    date: string
    time: string
    direction: string
    rating: string
    rows: Array<{ date: string; time: string; direction: string; rating: string; highlighted?: boolean }>
    recommendedTitle: string
    recommendations: Array<{ title: string; details: string[] }>
    avoidTitle: string
    avoidDates: string
    avoidItems: string[]
    summaryTitle: string
    summary: string
    footnote: string
  }
  about: {
    title: string
    introTitle: string
    intro: string
    featuresTitle: string
    features: string[]
    changelogTitle: string
    changelog: Array<{ version: string; text: string }>
    historyLink: string
    historyTitle: string
    historyBack: string
    historyBackAria: string
    history: Array<{ version: string; text: string }>
    dontShowAgain: string
    confirm: string
    closeAria: string
  }
  selectionBar: {
    selected: (count: number) => string
    selectAll: string
    deselectAll: string
    favorite: string
    unfavorite: string
    delete: string
    restore: string
    permanentlyDelete: string
    clearAll: string
    cancel: string
  }
  cleanup: {
    dialogTitle: string
    dialogCloseAria: string
    authHint: string
    referenceHint: string
    authorize: string
    reauthorize: string
    authorizedAs: (name: string) => string
    clean: string
    cleaning: string
    items: Record<SpecialCleanupItem, { title: string; path: string; description: string }>
    confirmDirectoryCleanupTitle: string
    confirmDirectoryCleanup: (title: string, count: number, size: string) => string
    directoryCleanupStatus: (
      title: string,
      deletedCount: number,
      deletedBytes: number,
      failures: Array<{ path: string; reason: RelatedCleanupFailureReason }>,
      missingDirectories: string[]
    ) => string
    noDirectoryFilesToClean: (title: string, missingDirectories: string[]) => string
    accountDialogTitle: string
    accountDialogMessage: string
    accountInputLabel: string
    accountSelectPlaceholder: string
    allAccounts: string
    rememberChoice: string
    accountConfirm: string
    accountCancel: string
  }
  viewNav: {
    aria: string
    title: string
    allPhotos: string
    favorites: string
    recentlyDeleted: string
    count: (count: number) => string
  }
  sidebar: {
    aria: string
    title: string
    empty: string
  }
  grid: {
    emptyTitle: string
    emptyDescription: string
    emptyFavoritesTitle: string
    emptyFavoritesDescription: string
    recommendedPath: string
    hiddenFolderTip: string
    selectDay: string
    addFavorite: string
    removeFavorite: string
    imageLoadFailed: string
    editNote: string
    notePrompt: string
    noteSaved: string
    noteLabel: string
    noteTitle: string
    notePlaceholder: string
    noteSave: string
    noteCancel: string
    noteClose: string
    photoCount: (count: number) => string
  }
  lightbox: {
    previousAria: string
    nextAria: string
    closeAria: string
    deleteCurrent: string
    restoreCurrent: string
    permanentlyDeleteCurrent: string
    favorite: string
    removeFavorite: string
    zoomIn: string
    zoomOut: string
    resetZoom: string
    editNote: string
    noteLabel: string
  }
  trash: {
    emptyTitle: string
    emptyDescription: string
    totalSummary: (count: number, size: string) => string
    deletedAt: (value: string) => string
    moveDialogTitle: string
    permanentDeleteDialogTitle: string
    confirmMove: (count: number) => string
    confirmPermanentDelete: (count: number) => string
    movedStatus: (count: number, failedNames: string[]) => string
    restoredStatus: (count: number, failedNames: string[]) => string
    permanentlyDeletedStatus: (count: number, failedNames: string[]) => string
    deleteAllTitle: string
    confirmDeleteAll: (count: number) => string
    refreshStatus: (addedCount: number, removedCount: number) => string
    upToDate: string
    imageLoadFailed: string
  }
  date: {
    displayDate: (dateKey: string) => string
    monthDay: (dateKey: string) => string
  }
  fileSystem: {
    readFailed: string
    systemDirectory: string
    abortSelection: string
    permissionRequired: string
    unsupportedBrowser: string
    mobileBrowserUnsupported: string
    invalidAlbumDirectory: string
    invalidX6GameDirectory: string
    restoreX6GamePermissionPrompt: string
    selectX6GameDirectoryPrompt: string
  }
}

