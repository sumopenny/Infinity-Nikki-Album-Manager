// 视图导航文案：相册视图、收藏视图、搭配码视图和最近删除视图的名称及数量文字。
import type { LocaleMessages } from '../types'

export const viewNavZh: LocaleMessages['viewNav'] = {
      aria: '相册视图',
      title: '相册',
      allPhotos: '全部照片',
      favorites: '收藏夹',
      recentlyDeleted: '最近删除',
      count: (count) => `${count} 张`
    }
export const viewNavEn: LocaleMessages['viewNav'] = {
      aria: 'Album views',
      title: 'Album',
      allPhotos: 'All photos',
      favorites: 'Favorites',
      recentlyDeleted: 'Recently deleted',
      count: (count) => `${count} photos`
    }

