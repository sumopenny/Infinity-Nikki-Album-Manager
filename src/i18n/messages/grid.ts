// 网格内容文案：照片卡片、空状态、备注、日期分组和图片操作相关文字。
import type { LocaleMessages } from '../types'

export const gridZh: LocaleMessages['grid'] = {
      emptyTitle: '开始整理你的暖暖摄影作品',
      emptyDescription: '选择高画质相册文件夹后，照片会按拍摄日期自动整理。',
      emptyFavoritesTitle: '收藏夹还是空的',
      emptyFavoritesDescription: '点击照片时间前的爱心，就能把喜欢的图片加入收藏夹。',
      recommendedPath: '推荐文件路径：\\InfinityNikki Launcher\\InfinityNikki\\X6Game\\Saved\\GamePlayPhotos\\你的id\\NikkiPhotos_HighQuality',
      hiddenFolderTip: '如果找不到 GamePlayPhotos，在文件夹上方栏点击“查看”→显示→隐藏的项目→点击勾选',
      selectDay: '选择这一天',
      addFavorite: '加入收藏夹',
      removeFavorite: '取消收藏',
      imageLoadFailed: '图片读取失败',
      editNote: '编辑备注',
      notePrompt: '请输入照片备注（最多15个字符）',
      noteSaved: '照片备注已保存。',
      noteLabel: '备注',
      noteTitle: '编辑照片备注',
      notePlaceholder: '请输入备注',
      noteSave: '保存备注',
      noteCancel: '取消',
      noteClose: '关闭备注编辑',
      photoCount: (count) => `${count} 张照片`
    }
export const gridEn: LocaleMessages['grid'] = {
      emptyTitle: 'Start organizing your Infinity Nikki photography',
      emptyDescription: 'Choose the high-quality album folder to organize photos automatically by capture date.',
      emptyFavoritesTitle: 'No favorites yet',
      emptyFavoritesDescription: 'Click the heart before a photo time to add that image to Favorites.',
      recommendedPath: 'Recommended path: \\InfinityNikki Launcher\\InfinityNikki\\X6Game\\Saved\\GamePlayPhotos\\Your ID\\NikkiPhotos_HighQuality',
      hiddenFolderTip: 'Can\'t find GamePlayPhotos? In the folder toolbar, click "View" → Show → Hidden items to check it.',
      selectDay: 'Select this day',
      addFavorite: 'Add to Favorites',
      removeFavorite: 'Remove from Favorites',
      imageLoadFailed: 'Failed to load image',
      editNote: 'Edit note',
      notePrompt: 'Enter a photo note (up to 15 characters)',
      noteSaved: 'Photo note saved.',
      noteLabel: 'Note',
      noteTitle: 'Edit photo note',
      notePlaceholder: 'Enter a note',
      noteSave: 'Save note',
      noteCancel: 'Cancel',
      noteClose: 'Close note editor',
      photoCount: (count) => `${count} photos`
    }

