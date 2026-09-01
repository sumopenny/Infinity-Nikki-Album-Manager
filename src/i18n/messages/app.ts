// 应用级文案：相册初始化、状态提示、授权、清理确认和数据管理相关文字。
import type { LocaleMessages } from '../types'
import { formatMessageFileSize } from '../formatters'
import type { RelatedCleanupFailureReason } from '../../utils/file-system/cleanupFileSystem'

export const appZh: LocaleMessages['app'] = {
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
      relatedCleanupDialogTitle: '确认清理低画质图片和截图',
      x6GameDirectoryDialogTitle: '授权 X6Game 文件夹',
      albumContentAria: '图片展示区',
      rememberedDirectory: (name) => `已记住：${name}`,
      successStatus: (count, prefix) => {
        const prefixText = prefix === 'restored' ? '已恢复' : '已读取'
        return count ? `${prefixText} ${count} 张照片，` : '这个文件夹里没有找到符合命名格式的图片。'
      },
      successSuffix: (suffix) => (suffix === 'continued' ? '已继续使用上次记住的相册文件夹。' : '已记住本次选择的相册文件夹。'),
      relatedCleanupCancelledStatus: '已取消清理，没有删除任何图片。',
      confirmRelatedCleanup: (count, missingDirectories) => {
        const missingText = missingDirectories.length ? `\n未找到并将跳过：${missingDirectories.join('、')}。` : ''
        return `确定删除 NikkiPhotos_LowQuality 和 ScreenShot 文件夹中的 ${count} 张图片吗？${missingText}`
      },
      relatedCleanupStatus: (deletedCount, deletedBytes, failures, missingDirectories) => {
        const released = formatMessageFileSize(deletedBytes)
        const reasonText: Record<RelatedCleanupFailureReason, string> = {
          'unreadable-size': '无法读取文件大小，但仍尝试删除；释放容量可能少计',
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
    }
export const appEn: LocaleMessages['app'] = {
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
      relatedCleanupDialogTitle: 'Clean low-quality photos & screenshots?',
      x6GameDirectoryDialogTitle: 'X6Game folder authorization required',
      albumContentAria: 'Photo gallery',
      rememberedDirectory: (name) => `Remembered: ${name}`,
      successStatus: (count, prefix) => {
        const prefixText = prefix === 'restored' ? 'Restored' : 'Loaded'
        return count ? `${prefixText} ${count} photos. ` : 'No images matching the filename pattern were found in this folder.'
      },
      successSuffix: (suffix) => (suffix === 'continued' ? 'Continued using the remembered album folder.' : 'Remembered this album folder.'),
      relatedCleanupCancelledStatus: 'Cleanup cancelled. No images were deleted.',
      confirmRelatedCleanup: (count, missingDirectories) => {
        const missingText = missingDirectories.length ? `\nNot found and skipped: ${missingDirectories.join(', ')}.` : ''
        return `Delete ${count} images from NikkiPhotos_LowQuality and ScreenShot?${missingText}`
      },
      relatedCleanupStatus: (deletedCount, deletedBytes, failures, missingDirectories) => {
        const reasonText: Record<RelatedCleanupFailureReason, string> = {
          'unreadable-size': 'Could not read the file size; deletion was still attempted and released space may be understated',
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
    }

