// 选择操作栏文案：选中数量、全选、收藏、删除、恢复、永久删除和取消操作文字。
import type { LocaleMessages } from '../types'

export const selectionBarZh: LocaleMessages['selectionBar'] = {
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
    }
export const selectionBarEn: LocaleMessages['selectionBar'] = {
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
    }

