// 最近删除文案：回收站空状态、恢复、永久删除、清空和刷新结果相关文字。
import type { LocaleMessages } from '../types'

export const trashZh: LocaleMessages['trash'] = {
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
    }
export const trashEn: LocaleMessages['trash'] = {
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
    }

