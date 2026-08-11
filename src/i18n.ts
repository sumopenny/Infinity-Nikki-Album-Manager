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
    authorizeX6Game: string
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
    about: string
  }
  about: {
    title: string
    introTitle: string
    intro: string
    featuresTitle: string
    features: string[]
    changelogTitle: string
    changelog: Array<{ version: string; text: string }>
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
    invalidAlbumDirectory: string
    invalidX6GameDirectory: string
    restoreX6GamePermissionPrompt: string
    selectX6GameDirectoryPrompt: string
  }
}

export const DEFAULT_LANGUAGE: Language = 'zh'

// 当前网站版本号；更新日志新增版本时同步修改，用于检测是否需要在打开网站时重新弹出“关于网站”窗口
export const ABOUT_VERSION = '1.2.2'

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
      preferencesUpdating: '正在应用设置...',
      clearCacheDialogTitle: '清除缓存',
      clearCacheConfirmMessage: '将清除 X6Game 授权和搭配码指南“不再提示”状态，保留当前相册文件夹授权。不会删除电脑里的文件。确认后会继续使用当前相册重新加载。',
      clearCacheStatus: '缓存已清除，当前相册已重新加载。',
      authorizeX6GameStatus: 'X6Game 文件夹授权已完成。',
      x6GameAuthorizationCancelledStatus: '已取消 X6Game 文件夹授权。后续进入搭配码界面将不再自动弹出授权窗口，可在当前相册下拉框中点击“授权 X6Game”手动授权。',
      clearDataDialogTitle: '清除全部数据',
      clearDataFirstConfirmMessage: '将清除所有网站本地记录，包括相册文件夹授权、X6Game 授权和搭配码指南“不再提示”状态。网站会回到第一次打开的状态，需要重新选择相册。不会删除电脑里的真实文件。',
      clearDataSecondConfirmMessage: '请再次确认清除全部数据。这个操作只清除浏览器保存的网站状态和授权，不会删除电脑里的照片、clothe 或 trash 文件夹。',
      clearDataStatus: '全部网站数据已清除。需要继续管理相册时，请重新选择文件夹。',
      languageUpdated: '语言切换成功。',
      themeUpdated: '主题切换成功。',
      movingPhotosToTrash: '正在移入最近删除...',
      restoringPhotos: '正在恢复照片...',
      permanentlyDeletingPhotos: '正在永久删除照片...',
      dialogCloseAria: '关闭弹窗',
      dialogCancel: '取消',
      dialogConfirm: '确认删除',
      dialogContinueAuthorization: '继续授权',
      dialogOk: '我知道了',
      relatedCleanupDialogTitle: '确认清理关联图片',
      x6GameDirectoryDialogTitle: '授权 X6Game 文件夹',
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
      authorizeX6Game: '授权 X6Game',
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
      clearCache: '清除缓存',
      clearData: '清除数据',
      helpMouseTitle: '鼠标操作',
      helpMouseItems: ['单击照片可选择，双击打开大图预览。', '悬停照片可查看拍摄时间与文件大小。', '大图放大后可拖动查看，并可使用滚轮缩放。'],
      helpKeyboardTitle: '快捷键',
      helpKeyboardItems: ['方向键切换上一张或下一张。', 'Esc 关闭菜单、弹窗或大图预览。', 'Delete 删除当前预览照片。'],
      author: '作者：素茉penny',
      xiaohongshu: '小红书',
      xiaohongshuAuthor: '访问作者的小红书主页',
      douyin: '抖音',
      douyinAuthor: '访问作者的抖音主页',
      donate: '打赏我',
      donateTitle: '打赏支持',
      donateDescription: '作者为爱发电，网站制作不易，觉得好用的话可以来支持我~',
      donateWechat: '微信',
      donateAlipay: '支付宝',
      closeDonate: '关闭打赏窗口',
      about: '关于网站'
    },
    about: {
      title: '关于网站',
      introTitle: '网站简介',
      intro: '无限暖暖相册管理是一个纯本地运行的网站，照片和搭配码数据都只保存在你自己的设备上。',
      featuresTitle: '主要功能',
      features: [
        '相册管理：按拍摄日期整理游戏截图，支持预览、复制、收藏和移入相册。',
        '搭配码管理：管理星绘图册搭配方案，支持手动添加、批量导入 ZIP，并自动同步游戏内新搭配码。',
        '一键清理：快速清理低画质照片和游戏截图，释放磁盘空间。'
      ],
      changelogTitle: '当前版本【2026.8.11更新】',
      // 更新日志只保留当前版本，发布新版本时替换该条内容，当前版本会自动带上“当前版本”标识
      changelog: [
        { version: 'v1.2.2', text: '优化搭配码导入导出性能，完善 X6Game 授权与清理逻辑。家园码、组合码功能开发中。' }
      ],
      dontShowAgain: '不再提示',
      confirm: '我知道了',
      closeAria: '关闭关于窗口'
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
      deleteAllTitle: '清空全部最近删除',
      confirmDeleteAll: (count) => `确定永久清空最近删除中的全部 ${count} 张照片吗？此操作不可恢复。`,
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
      invalidAlbumDirectory: '不能选择 NikkiPhotos_LowQuality 或 ScreenShot 文件夹执行一键清理。',
      invalidX6GameDirectory: '所选目录不是当前相册对应的 X6Game 文件夹，请选择路径中的 X6Game 文件夹后重试。',
      restoreX6GamePermissionPrompt: '已保存的 X6Game 文件夹授权已经失效。点击“继续授权”后，请在浏览器权限窗口中允许本站点编辑该文件夹；如果浏览器无法恢复授权，页面会再提示你重新选择 X6Game 文件夹，用于一键清理和自动读取最新搭配码。',
      selectX6GameDirectoryPrompt: '授权后可使用一键清理低画质截图、自动读取游戏最新搭配码的功能。请在接下来的窗口中选择路径里的 X6Game 文件夹（...\\InfinityNikki Launcher\\InfinityNikki\\X6Game）。授权会被保存，后续可直接使用。'
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
      preferencesUpdating: 'Applying settings...',
      clearCacheDialogTitle: 'Clear cache',
      clearCacheConfirmMessage: 'This clears the X6Game authorization and the Outfit Guide “don’t show again” state, while keeping the current album folder authorization. It will not delete real photos, clothe, trash, or other files on your computer. The current album will reload afterward.',
      clearCacheStatus: 'Cache cleared. The current album has been reloaded.',
      authorizeX6GameStatus: 'X6Game folder authorization completed.',
      x6GameAuthorizationCancelledStatus: 'X6Game folder authorization was canceled. The authorization window will no longer open automatically when entering Outfit Codes; use Authorize X6Game from the Current album menu when needed.',
      clearDataDialogTitle: 'Clear all data',
      clearDataFirstConfirmMessage: 'This clears all website local records, including the album folder authorization, X6Game authorization, and Outfit Guide “don’t show again” state. The website will return to first-open state and ask you to choose an album again. It will not delete real files on your computer.',
      clearDataSecondConfirmMessage: 'Please confirm again to clear all data. This only clears website state and authorizations saved in the browser; it will not delete photos, clothe, or trash folders on your computer.',
      clearDataStatus: 'All website data has been cleared. Choose a folder again to continue managing your album.',
      languageUpdated: 'Language updated successfully.',
      themeUpdated: 'Theme updated successfully.',
      movingPhotosToTrash: 'Moving photos to Recently Deleted...',
      restoringPhotos: 'Restoring photos...',
      permanentlyDeletingPhotos: 'Permanently deleting photos...',
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
      authorizeX6Game: 'Authorize X6Game',
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
      clearCache: 'Clear cache',
      clearData: 'Clear data',
      helpMouseTitle: 'Mouse',
      helpMouseItems: ['Click a photo to select it; double-click to open the preview.', 'Hover a photo to see its capture time and file size.', 'Drag a zoomed preview and use the mouse wheel to zoom.'],
      helpKeyboardTitle: 'Keyboard',
      helpKeyboardItems: ['Use the arrow keys to move between photos.', 'Press Esc to close a menu, dialog, or preview.', 'Press Delete to delete the current preview photo.'],
      author: 'Author: 素茉Penny',
      xiaohongshu: 'Xiaohongshu',
      xiaohongshuAuthor: "Open the author's Xiaohongshu profile",
      douyin: 'Douyin',
      douyinAuthor: "Open the author's Douyin profile",
      donate: 'Tip me',
      donateTitle: 'Support the author',
      donateDescription: 'This site is a labor of love and took real effort to build. If you find it useful, you can support me here~',
      donateWechat: 'WeChat',
      donateAlipay: 'Alipay',
      closeDonate: 'Close donation window',
      about: 'About'
    },
    about: {
      title: 'About',
      introTitle: 'About this site',
      intro: 'Infinity Nikki Album Manager runs entirely locally. Your photos and outfit code data stay on your own device.',
      featuresTitle: 'Features',
      features: [
        'Album management: organize screenshots by capture date, with preview, copy, favorite and move-to-album.',
        'Recently deleted: deleted photos go to the trash folder first and can be restored or deleted forever.',
        'Outfit codes: manage Starry Gallery outfit plans with manual add, batch ZIP import, and auto sync of new in-game outfit codes.',
        'One-click cleanup: quickly clean low-quality photos and screenshots to free up disk space.'
      ],
      changelogTitle: 'Current version【2026.8.11 update】',
      changelog: [
        { version: 'v1.2.2', text: 'Optimized outfit code import and export performance, and improved X6Game authorization and cleanup logic. Home code and combination code features are in development.' }
      ],
      dontShowAgain: "Don't show again",
      confirm: 'Got it',
      closeAria: 'Close about window'
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
      deleteAllTitle: 'Permanently delete all',
      confirmDeleteAll: (count) => `Permanently delete all ${count} photos from trash? This cannot be undone.`,
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
      invalidAlbumDirectory: 'NikkiPhotos_LowQuality and ScreenShot cannot be selected for one-click cleanup.',
      invalidX6GameDirectory: 'The selected folder is not the X6Game folder that contains the current album. Select that X6Game folder and try again.',
      restoreX6GamePermissionPrompt: 'The saved X6Game folder permission has expired. Click “Continue authorization”, then allow this site to edit the folder in the browser permission prompt. If the browser cannot restore access, the page will ask you to select X6Game again.',
      selectX6GameDirectoryPrompt: 'Authorize the X6Game folder for the current game installation to clean related images and automatically read the latest in-game outfit code. Select the X6Game folder in the next folder picker (...\\InfinityNikki Launcher\\InfinityNikki\\X6Game). The authorization will be remembered for future use.'
    }
  }
}
