// 英文语言包：汇总应用、顶栏、弹窗、相册、回收站、文件系统和搭配码等英文文案。
import type { LocaleMessages } from './types'
import { appEn } from './messages/app'
import { topBarEn } from './messages/topBar'
import { fortuneTimeEn } from './messages/fortuneTime'
import { aboutEn } from './messages/about'
import { selectionBarEn } from './messages/selectionBar'
import { cleanupEn } from './messages/cleanup'
import { viewNavEn } from './messages/viewNav'
import { sidebarEn } from './messages/sidebar'
import { gridEn } from './messages/grid'
import { lightboxEn } from './messages/lightbox'
import { trashEn } from './messages/trash'
import { dateEn } from './messages/date'
import { fileSystemEn } from './messages/fileSystem'
import { outfitMessages } from './messages/outfit'

export const en: LocaleMessages = {
  app: appEn,
  topBar: topBarEn,
  fortuneTime: fortuneTimeEn,
  about: aboutEn,
  selectionBar: selectionBarEn,
  cleanup: cleanupEn,
  viewNav: viewNavEn,
  sidebar: sidebarEn,
  grid: gridEn,
  lightbox: lightboxEn,
  trash: trashEn,
  date: dateEn,
  fileSystem: fileSystemEn
  ,outfit: outfitMessages.en
}
