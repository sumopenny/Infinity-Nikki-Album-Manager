import type { ThumbnailMode } from './types/thumbnail'

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
    statusEyebrow: string
    waitingTitle: string
    albumContentAria: string
    rememberedDirectory: (name: string) => string
    successStatus: (count: number, prefix: StatusPrefix) => string
    successSuffix: (suffix: StatusSuffix) => string
    deletedStatus: (deletedCount: number, failedNames: string[]) => string
    totalPhotos: (count: number) => string
    confirmDeleteSelected: (count: number) => string
    confirmDeleteCurrent: string
  }
  topBar: {
    title: string
    starHint: string
    githubAria: string
    githubText: string
    languageButton: string
    languageAria: string
    chooseDirectory: string
    loading: string
    clearDirectory: string
    thumbnail: string
    deleting: string
    cancelSelectAll: string
    selectAll: string
    deleteSelected: (count: number) => string
  }
  sidebar: {
    aria: string
    title: string
    empty: string
    photoCount: (count: number) => string
  }
  grid: {
    emptyTitle: string
    emptyDescription: string
    recommendedPath: string
    selectDay: string
    photoCount: (count: number) => string
  }
  lightbox: {
    previousAria: string
    nextAria: string
    closeAria: string
    deleting: string
    deleteCurrent: string
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
  return year && month && day ? `${year}年${month}月${day}日` : dateKey
}

function zhMonthDay(dateKey: string): string {
  const { month, day } = splitDateKey(dateKey)
  return month && day ? `${month}月${day}日` : dateKey
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
      statusEyebrow: 'Album Status',
      waitingTitle: '等待选择相册路径',
      albumContentAria: '图片展示区',
      rememberedDirectory: (name) => `已记住：${name}`,
      successStatus: (count, prefix) => {
        const prefixText = prefix === 'restored' ? '已恢复' : '已读取'
        return count
          ? `${prefixText} ${count} 张照片。单击选中，双击查看大图；预览中可点删除按钮或按 Delete 删除，←/→ 翻页，Esc 关闭。`
          : '这个文件夹里没有找到符合命名格式的图片。'
      },
      successSuffix: (suffix) => (suffix === 'continued' ? '已继续使用上次记住的相册文件夹。' : '已记住本次选择的相册文件夹。'),
      deletedStatus: (deletedCount, failedNames) =>
        failedNames.length
          ? `已删除 ${deletedCount} 张，${failedNames.length} 张删除失败：${failedNames.join('、')}`
          : `已删除 ${deletedCount} 张照片。`,
      totalPhotos: (count) => `共 ${count} 张照片`,
      confirmDeleteSelected: (count) => `确定删除选中的 ${count} 张照片吗？这会同步删除电脑文件夹里的原图。`,
      confirmDeleteCurrent: '确定删除当前预览的这张照片吗？这会同步删除电脑文件夹里的原图。'
    },
    topBar: {
      title: '无限暖暖相册管理',
      starHint: '觉得网站不错的话，欢迎在 GitHub 右上角点个小星星 Star⭐~',
      githubAria: '访问GitHub仓库',
      githubText: '访问GitHub仓库',
      languageButton: '切换为英文版',
      languageAria: '切换到英文版',
      chooseDirectory: '选择/恢复相册路径',
      loading: '正在读取...',
      clearDirectory: '清除路径',
      thumbnail: '缩略图',
      deleting: '删除中...',
      cancelSelectAll: '取消全选',
      selectAll: '全选照片',
      deleteSelected: (count) => `删除选中照片（${count}）`
    },
    sidebar: {
      aria: '日期侧边栏',
      title: '拍摄日期',
      empty: '选择相册后，这里会按年份和日期展开。',
      photoCount: (count) => `${count} 张`
    },
    grid: {
      emptyTitle: '还没有照片',
      emptyDescription: '点击上方“选择/恢复相册路径”，读取命名为 2026_06_26_11_22_58_6316602.jpeg 这类格式的图片。',
      recommendedPath: '推荐文件路径：\\InfinityNikki Launcher\\InfinityNikki\\X6Game\\Saved\\GamePlayPhotos\\你的id\\NikkiPhotos_HighQuality',
      selectDay: '选择这一天',
      photoCount: (count) => `${count} 张照片`
    },
    lightbox: {
      previousAria: '查看上一张图片',
      nextAria: '查看下一张图片',
      closeAria: '关闭预览',
      deleting: '删除中...',
      deleteCurrent: '删除此图片'
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
      unsupportedBrowser: '当前浏览器不支持选择文件夹。请使用最新版 Chrome 或 Edge，并在 localhost/HTTPS 环境运行。'
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
      statusEyebrow: 'Album Status',
      waitingTitle: 'Waiting for an album folder',
      albumContentAria: 'Photo gallery',
      rememberedDirectory: (name) => `Remembered: ${name}`,
      successStatus: (count, prefix) => {
        const prefixText = prefix === 'restored' ? 'Restored' : 'Loaded'
        return count
          ? `${prefixText} ${count} photos. Click to select, double-click to preview; use Delete in preview, ←/→ to browse, and Esc to close.`
          : 'No images matching the filename pattern were found in this folder.'
      },
      successSuffix: (suffix) => (suffix === 'continued' ? 'Continued using the remembered album folder.' : 'Remembered this album folder.'),
      deletedStatus: (deletedCount, failedNames) =>
        failedNames.length
          ? `Deleted ${deletedCount}; ${failedNames.length} failed: ${failedNames.join(', ')}`
          : `Deleted ${deletedCount} photos.`,
      totalPhotos: (count) => `${count} photos total`,
      confirmDeleteSelected: (count) => `Delete the selected ${count} photos? This also deletes the original files from your computer.`,
      confirmDeleteCurrent: 'Delete the currently previewed photo? This also deletes the original file from your computer.'
    },
    topBar: {
      title: 'Infinity Nikki Album Manager',
      starHint: 'Like this website? Please give it a Star⭐ on GitHub~',
      githubAria: 'Open GitHub repository',
      githubText: 'GitHub',
      languageButton: 'Switch to Chinese',
      languageAria: 'Switch to Chinese',
      chooseDirectory: 'Choose / restore album folder',
      loading: 'Reading...',
      clearDirectory: 'Clear folder',
      thumbnail: 'Thumbnail',
      deleting: 'Deleting...',
      cancelSelectAll: 'Deselect all',
      selectAll: 'Select all',
      deleteSelected: (count) => `Delete selected (${count})`
    },
    sidebar: {
      aria: 'Date sidebar',
      title: 'Capture Dates',
      empty: 'After choosing an album, dates will be grouped by year here.',
      photoCount: (count) => `${count} photos`
    },
    grid: {
      emptyTitle: 'No photos yet',
      emptyDescription: 'Click “Choose / restore album folder” above to load images named like 2026_06_26_11_22_58_6316602.jpeg.',
      recommendedPath: 'Recommended path: \\InfinityNikki Launcher\\InfinityNikki\\X6Game\\Saved\\GamePlayPhotos\\Your ID\\NikkiPhotos_HighQuality',
      selectDay: 'Select this day',
      photoCount: (count) => `${count} photos`
    },
    lightbox: {
      previousAria: 'View previous photo',
      nextAria: 'View next photo',
      closeAria: 'Close preview',
      deleting: 'Deleting...',
      deleteCurrent: 'Delete this photo'
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
      unsupportedBrowser: 'This browser does not support folder selection. Please use the latest Chrome or Edge and run on localhost/HTTPS.'
    }
  }
}
