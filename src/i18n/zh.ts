// 中文语言包：汇总应用、顶栏、弹窗、相册、回收站、文件系统和搭配码等中文文案。
import type { LocaleMessages } from './types'
import { appZh } from './messages/app'
import { topBarZh } from './messages/topBar'
import { fortuneTimeZh } from './messages/fortuneTime'
import { aboutZh } from './messages/about'
import { selectionBarZh } from './messages/selectionBar'
import { cleanupZh } from './messages/cleanup'
import { viewNavZh } from './messages/viewNav'
import { sidebarZh } from './messages/sidebar'
import { gridZh } from './messages/grid'
import { lightboxZh } from './messages/lightbox'
import { trashZh } from './messages/trash'
import { dateZh } from './messages/date'
import { fileSystemZh } from './messages/fileSystem'
import { outfitMessages } from './messages/outfit'

export const zh: LocaleMessages = {
  app: appZh,
  topBar: topBarZh,
  fortuneTime: fortuneTimeZh,
  about: aboutZh,
  selectionBar: selectionBarZh,
  cleanup: cleanupZh,
  viewNav: viewNavZh,
  sidebar: sidebarZh,
  grid: gridZh,
  lightbox: lightboxZh,
  trash: trashZh,
  date: dateZh,
  fileSystem: fileSystemZh
  ,outfit: outfitMessages.zh
}
