import type { ThumbnailMode } from './types/thumbnail'
import type { ThemeMode } from './types/theme'
import type { RelatedCleanupFailureReason } from './utils/fileSystem'

export type Language = 'zh' | 'en'
export type StatusPrefix = 'read' | 'restored'
export type StatusSuffix = 'continued' | 'remembered'

export interface LocaleMessages {
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
    preparingRelatedCleanup: string
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
    githubText: string
    giteeText: string
    languageButton: string
    themeButton: (themeMode: ThemeMode) => string
    chooseDirectory: string
    loading: string
    clearDirectory: string
    refreshAlbum: string
    refreshing: string
    thumbnail: string
    cleaningRelated: string
    cleanRelatedPhotos: string
    currentAlbum: string
    view: string
    more: string
    albumMenuAria: string
    viewMenuAria: string
    moreMenuAria: string
    help: string
    helpTitle: string
    helpMouseTitle: string
    helpMouseItems: string[]
    helpKeyboardTitle: string
    helpKeyboardItems: string[]
    helpPathTitle: string
    helpPathText: string
    helpSafetyTitle: string
    helpSafetyText: string
    closeHelp: string
    author: string
    xiaohongshu: string
    xiaohongshuAuthor: string
    douyin: string
    douyinAuthor: string
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
    selectDay: string
    addFavorite: string
    removeFavorite: string
    imageLoadFailed: string
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
    invalidAlbumDirectory: string
    invalidX6GameDirectory: string
    restoreX6GamePermissionPrompt: string
    selectX6GameDirectoryPrompt: string
  }
}

export const DEFAULT_LANGUAGE: Language = 'zh'

const thumbnailModeValues: ThumbnailMode[] = ['default', 'half', 'wide', 'standard', 'portrait-wide', 'portrait-standard']

const thumbnailModeLabels: Record<Language, Record<ThumbnailMode, string>> = {
  zh: {
    default: '默认 1:1',
    half: '半尺寸 1:1',
    wide: '16:9',
    standard: '4:3',
    'portrait-wide': '9:16',
    'portrait-standard': '3:4'
  },
  en: {
    default: 'Default 1:1',
    half: 'Half 1:1',
    wide: '16:9',
    standard: '4:3',
    'portrait-wide': '9:16',
    'portrait-standard': '3:4'
  }
}

const englishMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function splitDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-')
  const monthIndex = Number(month) - 1
  const dayNumber = Number(day)
  return { year, month, day, monthIndex, dayNumber }
}

function zhDisplayDate(dateKey: string): string {
  const { year, month, day } = splitDateKey(dateKey)
  return year && month && day ? `${year}年${Number(month)}月${Number(day)}日` : dateKey
}

function zhMonthDay(dateKey: string): string {
  const { month, day } = splitDateKey(dateKey)
  return month && day ? `${Number(month)}月${Number(day)}日` : dateKey
}

function enDisplayDate(dateKey: string): string {
  const { year, day, monthIndex, dayNumber } = splitDateKey(dateKey)
  const monthName = englishMonths[monthIndex]
  return year && monthName && day ? `${monthName} ${dayNumber}, ${year}` : dateKey
}

function enMonthDay(dateKey: string): string {
  const { monthIndex, dayNumber } = splitDateKey(dateKey)
  const monthName = englishMonths[monthIndex]
  return monthName ? `${monthName} ${dayNumber}` : dateKey
}

/** 格式化操作提示中的字节容量。参数：bytes 为字节数。 */
function formatMessageFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}

export function getThumbnailModeOptions(language: Language): Array<{ value: ThumbnailMode; label: string }> {
  return thumbnailModeValues.map((value) => ({ value, label: thumbnailModeLabels[language][value] }))
}

export const messages: Record<Language, LocaleMessages> = {
  zh: {
    app: {
      noDirectory: '尚未选择相册路径',
      initialStatus: '请选择包含无限暖暖截图的文件夹，推荐直接选择 NikkiPhotos_HighQuality 图片文件夹。',
      readingStatus: '正在读取相册，请稍候...',
      restoringStatus: '正在恢复上次选择的相册路径...',
      restoreFailedStatus: '恢复上次相册路径失败，请重新选择文件夹。',
      restorePathFailedStatus: '上次记住的路径无法恢复，请重新选择相册文件夹。',
      readFailedStatus: '读取相册失败，请重试。',
      clearedStatus: '已清除记住的相册路径。需要继续管理相册时，请重新选择文件夹。',
      operationNoticeTitle: '操作提示',
      operationNoticeCloseAria: '关闭操作提示',
      dialogCloseAria: '关闭弹窗',
      dialogCancel: '取消',
      dialogConfirm: '确认删除',
      dialogContinueAuthorization: '继续授权',
      dialogOk: '我知道了',
      relatedCleanupDialogTitle: '确认清理关联图片',
      x6GameDirectoryDialogTitle: '需要授权 X6Game 文件夹',
      albumContentAria: '图片展示区',
      rememberedDirectory: (name) => `已记住：${name}`,
      successStatus: (count, prefix) => {
        const prefixText = prefix === 'restored' ? '已恢复' : '已读取'
        return count ? `${prefixText} ${count} 张照片，` : '这个文件夹里没有找到符合命名格式的图片。'
      },
      successSuffix: (suffix) => (suffix === 'continued' ? '已继续使用上次记住的相册文件夹。' : '已记住本次选择的相册文件夹。'),
      preparingRelatedCleanup: '正在定位低画质照片和游戏截图。首次使用时，请在弹出的窗口中选择 X6Game 文件夹。',
      relatedCleanupCancelledStatus: '已取消清理，没有删除任何图片。',
      confirmRelatedCleanup: (count, missingDirectories) => {
        const missingText = missingDirectories.length ? `\n未找到并将跳过：${missingDirectories.join('、')}。` : ''
        return `确定删除 NikkiPhotos_LowQuality 和 ScreenShot 文件夹中的 ${count} 张图片吗？文件夹和其他类型文件会保留。${missingText}`
      },
      relatedCleanupStatus: (deletedCount, deletedBytes, failures, missingDirectories) => {
        const released = formatMessageFileSize(deletedBytes)
        const reasonText: Record<RelatedCleanupFailureReason, string> = {
          'unreadable-size': '无法读取文件大小，已跳过删除',
          'remove-failed': '文件可能被占用或目录权限已失效'
        }
        const failedText = failures.length
          ? `；${failures.length} 张未清理：${failures.map((failure) => `${failure.path}（${reasonText[failure.reason]}）`).join('、')}`
          : ''
        const missingText = missingDirectories.length ? `；未找到并已跳过：${missingDirectories.join('、')}` : ''
        return `已清理 ${deletedCount} 张图片，释放 ${released}${failedText}${missingText}。`
      },
      noRelatedPhotos: (missingDirectories) =>
        missingDirectories.length
          ? `没有找到可清理的图片；未找到并已跳过：${missingDirectories.join('、')}。`
          : 'NikkiPhotos_LowQuality 和 ScreenShot 文件夹中没有可清理的图片。'
    },
    topBar: {
      title: '无限暖暖相册管理',
      starHint: '觉得网站不错的话，欢迎在 GitHub/Gitee 右上角点个小星星 Star⭐~',
      githubText: '访问GitHub仓库',
      giteeText: '访问Gitee仓库',
      languageButton: '切换为英文版',
      themeButton: (themeMode) => (themeMode === 'light' ? '切换深色模式' : '切换白色主题'),
      chooseDirectory: '选择/恢复相册路径',
      loading: '正在读取...',
      clearDirectory: '清除路径',
      refreshAlbum: '刷新相册',
      refreshing: '刷新中...',
      thumbnail: '缩略图',
      cleaningRelated: '清理中...',
      cleanRelatedPhotos: '一键清理低画质与截图',
      currentAlbum: '当前相册',
      view: '视图',
      more: '更多',
      albumMenuAria: '打开当前相册菜单',
      viewMenuAria: '打开视图菜单',
      moreMenuAria: '打开更多菜单',
      help: '帮助',
      helpTitle: '相册操作帮助',
      helpMouseTitle: '鼠标操作',
      helpMouseItems: ['单击照片可选择，双击打开大图预览。', '悬停照片可查看拍摄时间与文件大小。', '大图放大后可拖动查看，并可使用滚轮缩放。'],
      helpKeyboardTitle: '快捷键',
      helpKeyboardItems: ['方向键切换上一张或下一张。', 'Esc 关闭菜单、弹窗或大图预览。', 'Delete 删除当前预览照片。'],
      helpPathTitle: '推荐路径',
      helpPathText: '\\InfinityNikki Launcher\\InfinityNikki\\X6Game\\Saved\\GamePlayPhotos\\你的ID\\NikkiPhotos_HighQuality',
      helpSafetyTitle: '删除安全',
      helpSafetyText: '普通删除会移动到当前相册的 trash 文件夹；只有在最近删除中执行永久删除才无法恢复。',
      closeHelp: '关闭帮助',
      author: '作者：素茉penny',
      xiaohongshu: '小红书',
      xiaohongshuAuthor: '访问作者的小红书主页',
      douyin: '抖音',
      douyinAuthor: '访问作者的抖音主页'
    },
    selectionBar: {
      selected: (count) => `已选择 ${count} 张`,
      selectAll: '全选',
      deselectAll: '取消全选',
      favorite: '收藏',
      unfavorite: '取消收藏',
      delete: '删除',
      restore: '恢复',
      permanentlyDelete: '永久删除',
      clearAll: '永久清空全部',
      cancel: '取消选择'
    },
    viewNav: {
      aria: '相册视图',
      title: '相册',
      allPhotos: '全部照片',
      favorites: '收藏夹',
      recentlyDeleted: '最近删除',
      count: (count) => `${count} 张`
    },
    sidebar: {
      aria: '日期侧边栏',
      title: '拍摄日期',
      empty: '选择相册后，这里会按年份和日期展开。'
    },
    grid: {
      emptyTitle: '开始整理你的暖暖摄影作品',
      emptyDescription: '选择高画质相册文件夹后，照片会按拍摄日期自动整理。',
      emptyFavoritesTitle: '收藏夹还是空的',
      emptyFavoritesDescription: '点击照片时间前的爱心，就能把喜欢的图片加入收藏夹。',
      recommendedPath: '推荐文件路径：\\InfinityNikki Launcher\\InfinityNikki\\X6Game\\Saved\\GamePlayPhotos\\你的id\\NikkiPhotos_HighQuality',
      selectDay: '选择这一天',
      addFavorite: '加入收藏夹',
      removeFavorite: '取消收藏',
      imageLoadFailed: '图片读取失败',
      photoCount: (count) => `${count} 张照片`
    },
    lightbox: {
      previousAria: '查看上一张图片',
      nextAria: '查看下一张图片',
      closeAria: '关闭预览',
      deleteCurrent: '移到最近删除',
      restoreCurrent: '恢复此图片',
      permanentlyDeleteCurrent: '永久删除'
      ,favorite: '收藏当前图片'
      ,removeFavorite: '取消收藏当前图片'
      ,zoomIn: '放大图片'
      ,zoomOut: '缩小图片'
      ,resetZoom: '恢复 100% 缩放'
    },
    trash: {
      emptyTitle: '最近删除为空',
      emptyDescription: '从相册删除的照片会移动到当前相册的 trash 文件夹，并显示在这里。',
      totalSummary: (count, size) => `共 ${count} 张照片，合计 ${size}`,
      deletedAt: (value) => `删除于 ${value}`,
      moveDialogTitle: '移到最近删除',
      permanentDeleteDialogTitle: '永久删除照片',
      confirmMove: (count) => `确定删除这 ${count} 张图片？可前往“最近删除”恢复或永久删除。`,
      confirmPermanentDelete: (count) => `将从电脑中永久删除这 ${count} 张照片，无法恢复。`,
      movedStatus: (count, failedNames) =>
        failedNames.length
          ? `已将 ${count} 张照片移到最近删除，${failedNames.length} 张失败：${failedNames.join('、')}`
          : `已将 ${count} 张照片移到最近删除。`,
      restoredStatus: (count, failedNames) =>
        failedNames.length
          ? `已恢复 ${count} 张照片，${failedNames.length} 张失败：${failedNames.join('、')}`
          : `已恢复 ${count} 张照片。`,
      permanentlyDeletedStatus: (count, failedNames) =>
        failedNames.length
          ? `已永久删除 ${count} 张照片，${failedNames.length} 张失败：${failedNames.join('、')}`
          : `已永久删除 ${count} 张照片。`,
      refreshStatus: (addedCount, removedCount) => `发现 ${addedCount} 张新照片，另有 ${removedCount} 张已从文件夹移除。`,
      upToDate: '相册已是最新。',
      imageLoadFailed: '图片读取失败'
    },
    date: {
      displayDate: zhDisplayDate,
      monthDay: zhMonthDay
    },
    fileSystem: {
      readFailed: '读取相册失败，请重试。',
      systemDirectory: '无法打开此文件夹：浏览器不允许网页访问包含系统文件或受保护的目录。请直接选择 NikkiPhotos_HighQuality 图片文件夹，不要选择游戏安装根目录、C 盘根目录、Windows、Program Files 等上级目录。',
      abortSelection: '已取消选择相册文件夹。',
      permissionRequired: '已记住上次相册路径，但浏览器需要重新授权。请点击“选择/恢复相册路径”完成授权。',
      unsupportedBrowser: '当前浏览器不支持选择文件夹。请使用最新版 Chrome 或 Edge，并在 localhost/HTTPS 环境运行。',
      invalidAlbumDirectory: '一键清理需要先选择 NikkiPhotos_HighQuality 文件夹。',
      invalidX6GameDirectory: '所选目录不是当前相册对应的 X6Game 文件夹，请选择路径中的 X6Game 文件夹后重试。',
      restoreX6GamePermissionPrompt: '已保存的 X6Game 文件夹授权已经失效。点击“继续授权”后，请在浏览器权限窗口中允许本站点编辑该文件夹；如果浏览器无法恢复授权，页面会再提示你重新选择 X6Game 文件夹。',
      selectX6GameDirectoryPrompt: '首次使用一键清理功能，需要授权当前游戏的 X6Game 文件夹。请在接下来的目录选择窗口中选择路径里的 X6Game 文件夹（...\\InfinityNikki Launcher\\InfinityNikki\\X6Game）。授权会被保存，后续可直接一键清理。'
    }
  },
  en: {
    app: {
      noDirectory: 'No album folder selected',
      initialStatus: 'Choose the folder that contains your Infinity Nikki screenshots. NikkiPhotos_HighQuality is recommended.',
      readingStatus: 'Reading album, please wait...',
      restoringStatus: 'Restoring the last selected album folder...',
      restoreFailedStatus: 'Failed to restore the last album folder. Please choose the folder again.',
      restorePathFailedStatus: 'The remembered folder cannot be restored. Please choose the album folder again.',
      readFailedStatus: 'Failed to read the album. Please try again.',
      clearedStatus: 'The remembered album folder has been cleared. Choose a folder again to continue managing your album.',
      operationNoticeTitle: 'Operation update',
      operationNoticeCloseAria: 'Close operation update',
      dialogCloseAria: 'Close dialog',
      dialogCancel: 'Cancel',
      dialogConfirm: 'Confirm delete',
      dialogContinueAuthorization: 'Continue authorization',
      dialogOk: 'Got it',
      relatedCleanupDialogTitle: 'Clean related images?',
      x6GameDirectoryDialogTitle: 'X6Game folder authorization required',
      albumContentAria: 'Photo gallery',
      rememberedDirectory: (name) => `Remembered: ${name}`,
      successStatus: (count, prefix) => {
        const prefixText = prefix === 'restored' ? 'Restored' : 'Loaded'
        return count ? `${prefixText} ${count} photos. ` : 'No images matching the filename pattern were found in this folder.'
      },
      successSuffix: (suffix) => (suffix === 'continued' ? 'Continued using the remembered album folder.' : 'Remembered this album folder.'),
      preparingRelatedCleanup: 'Locating low-quality photos and game screenshots. On first use, select the X6Game folder in the folder picker.',
      relatedCleanupCancelledStatus: 'Cleanup cancelled. No images were deleted.',
      confirmRelatedCleanup: (count, missingDirectories) => {
        const missingText = missingDirectories.length ? `\nNot found and skipped: ${missingDirectories.join(', ')}.` : ''
        return `Delete ${count} images from NikkiPhotos_LowQuality and ScreenShot? The folders and non-image files will be kept.${missingText}`
      },
      relatedCleanupStatus: (deletedCount, deletedBytes, failures, missingDirectories) => {
        const reasonText: Record<RelatedCleanupFailureReason, string> = {
          'unreadable-size': 'Could not read the file size, so deletion was skipped',
          'remove-failed': 'The file may be in use or folder permission may have expired'
        }
        const failedText = failures.length
          ? `; ${failures.length} skipped: ${failures.map((failure) => `${failure.path} (${reasonText[failure.reason]})`).join(', ')}`
          : ''
        const missingText = missingDirectories.length ? `; not found and skipped: ${missingDirectories.join(', ')}` : ''
        return `Cleaned ${deletedCount} images and released ${formatMessageFileSize(deletedBytes)}${failedText}${missingText}.`
      },
      noRelatedPhotos: (missingDirectories) =>
        missingDirectories.length
          ? `No images were available to clean; not found and skipped: ${missingDirectories.join(', ')}.`
          : 'No images were found in NikkiPhotos_LowQuality or ScreenShot.'
    },
    topBar: {
      title: 'Infinity Nikki Album Manager',
      starHint: 'Like this website? Please give it a Star⭐ on GitHub/Gitee ~',
      githubText: 'GitHub',
      giteeText: 'Gitee',
      languageButton: 'Switch to Chinese',
      themeButton: (themeMode) => (themeMode === 'light' ? 'Switch to dark mode' : 'Switch to white theme'),
      chooseDirectory: 'Choose / restore album folder',
      loading: 'Reading...',
      clearDirectory: 'Clear folder',
      refreshAlbum: 'Refresh album',
      refreshing: 'Refreshing...',
      thumbnail: 'Thumbnail',
      cleaningRelated: 'Cleaning...',
      cleanRelatedPhotos: 'Clean low-quality & screenshots',
      currentAlbum: 'Current album',
      view: 'View',
      more: 'More',
      albumMenuAria: 'Open current album menu',
      viewMenuAria: 'Open view menu',
      moreMenuAria: 'Open more menu',
      help: 'Help',
      helpTitle: 'Album help',
      helpMouseTitle: 'Mouse',
      helpMouseItems: ['Click a photo to select it; double-click to open the preview.', 'Hover a photo to see its capture time and file size.', 'Drag a zoomed preview and use the mouse wheel to zoom.'],
      helpKeyboardTitle: 'Keyboard',
      helpKeyboardItems: ['Use the arrow keys to move between photos.', 'Press Esc to close a menu, dialog, or preview.', 'Press Delete to delete the current preview photo.'],
      helpPathTitle: 'Recommended path',
      helpPathText: '\\InfinityNikki Launcher\\InfinityNikki\\X6Game\\Saved\\GamePlayPhotos\\Your ID\\NikkiPhotos_HighQuality',
      helpSafetyTitle: 'Deletion safety',
      helpSafetyText: 'Normal deletion moves files into the album trash folder. Only permanent deletion in Recently deleted cannot be undone.',
      closeHelp: 'Close help',
      author: 'Author: 素茉Penny',
      xiaohongshu: 'Xiaohongshu',
      xiaohongshuAuthor: "Open the author's Xiaohongshu profile",
      douyin: 'Douyin',
      douyinAuthor: "Open the author's Douyin profile"
    },
    selectionBar: {
      selected: (count) => `${count} selected`,
      selectAll: 'Select all',
      deselectAll: 'Deselect all',
      favorite: 'Favorite',
      unfavorite: 'Remove favorite',
      delete: 'Delete',
      restore: 'Restore',
      permanentlyDelete: 'Delete permanently',
      clearAll: 'Permanently clear all',
      cancel: 'Clear selection'
    },
    viewNav: {
      aria: 'Album views',
      title: 'Album',
      allPhotos: 'All photos',
      favorites: 'Favorites',
      recentlyDeleted: 'Recently deleted',
      count: (count) => `${count} photos`
    },
    sidebar: {
      aria: 'Date sidebar',
      title: 'Capture Dates',
      empty: 'After choosing an album, dates will be grouped by year here.'
    },
    grid: {
      emptyTitle: 'Start organizing your Infinity Nikki photography',
      emptyDescription: 'Choose the high-quality album folder to organize photos automatically by capture date.',
      emptyFavoritesTitle: 'No favorites yet',
      emptyFavoritesDescription: 'Click the heart before a photo time to add that image to Favorites.',
      recommendedPath: 'Recommended path: \\InfinityNikki Launcher\\InfinityNikki\\X6Game\\Saved\\GamePlayPhotos\\Your ID\\NikkiPhotos_HighQuality',
      selectDay: 'Select this day',
      addFavorite: 'Add to Favorites',
      removeFavorite: 'Remove from Favorites',
      imageLoadFailed: 'Failed to load image',
      photoCount: (count) => `${count} photos`
    },
    lightbox: {
      previousAria: 'View previous photo',
      nextAria: 'View next photo',
      closeAria: 'Close preview',
      deleteCurrent: 'Move to Recently deleted',
      restoreCurrent: 'Restore this photo',
      permanentlyDeleteCurrent: 'Delete permanently'
      ,favorite: 'Favorite current photo'
      ,removeFavorite: 'Remove current photo from favorites'
      ,zoomIn: 'Zoom in'
      ,zoomOut: 'Zoom out'
      ,resetZoom: 'Reset zoom to 100%'
    },
    trash: {
      emptyTitle: 'Recently deleted is empty',
      emptyDescription: 'Photos deleted from the album are moved to its trash folder and appear here.',
      totalSummary: (count, size) => `${count} photos, ${size} total`,
      deletedAt: (value) => `Deleted ${value}`,
      moveDialogTitle: 'Move to Recently deleted',
      permanentDeleteDialogTitle: 'Permanently delete photos',
      confirmMove: (count) => `Move these ${count} photos to Recently deleted? They can be restored later.`,
      confirmPermanentDelete: (count) => `Permanently delete these ${count} photos from this computer? This cannot be undone.`,
      movedStatus: (count, failedNames) =>
        failedNames.length
          ? `Moved ${count} photos to Recently deleted; ${failedNames.length} failed: ${failedNames.join(', ')}`
          : `Moved ${count} photos to Recently deleted.`,
      restoredStatus: (count, failedNames) =>
        failedNames.length
          ? `Restored ${count} photos; ${failedNames.length} failed: ${failedNames.join(', ')}`
          : `Restored ${count} photos.`,
      permanentlyDeletedStatus: (count, failedNames) =>
        failedNames.length
          ? `Permanently deleted ${count} photos; ${failedNames.length} failed: ${failedNames.join(', ')}`
          : `Permanently deleted ${count} photos.`,
      refreshStatus: (addedCount, removedCount) => `Found ${addedCount} new photos; ${removedCount} were removed externally.`,
      upToDate: 'The album is up to date.',
      imageLoadFailed: 'Failed to load image'
    },
    date: {
      displayDate: enDisplayDate,
      monthDay: enMonthDay
    },
    fileSystem: {
      readFailed: 'Failed to read the album. Please try again.',
      systemDirectory: 'Cannot open this folder: the browser does not allow web pages to access system or protected folders. Please choose NikkiPhotos_HighQuality directly instead of the game root folder, C drive root, Windows, Program Files, or other parent folders.',
      abortSelection: 'Album folder selection was canceled.',
      permissionRequired: 'The last album folder is remembered, but the browser needs permission again. Click “Choose / restore album folder” to authorize it.',
      unsupportedBrowser: 'This browser does not support folder selection. Please use the latest Chrome or Edge and run on localhost/HTTPS.',
      invalidAlbumDirectory: 'Choose NikkiPhotos_HighQuality before using related folder cleanup.',
      invalidX6GameDirectory: 'The selected folder is not the X6Game folder that contains the current album. Select that X6Game folder and try again.',
      restoreX6GamePermissionPrompt: 'The saved X6Game folder permission has expired. Click “Continue authorization”, then allow this site to edit the folder in the browser permission prompt. If the browser cannot restore access, the page will ask you to select X6Game again.',
      selectX6GameDirectoryPrompt: 'To use related folder cleanup for the first time, authorize the X6Game folder for the current game installation. Select the X6Game folder in the next folder picker (...\\InfinityNikki Launcher\\InfinityNikki\\X6Game). The authorization will be remembered for future cleanup.'
    }
  }
}
