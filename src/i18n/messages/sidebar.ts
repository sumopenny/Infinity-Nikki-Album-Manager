// 侧栏文案：日期导航、收藏入口、相册目录和时间分组相关文字。
import type { LocaleMessages } from '../types'

export const sidebarZh: LocaleMessages['sidebar'] = {
      aria: '日期侧边栏',
      title: '拍摄日期',
      empty: '选择相册后，这里会按年份和日期展开。',
      actionsTitle: '拍摄动作', noAction: '未使用动作', unparsed: '未解析',
      parseProgress: (completed, total) => `正在解析 ${completed}/${total}`,
      sort: '排序', sortId: '动作编号（新动作优先）', sortName: '名称', sortCount: '照片数量', sortLatest: '最近拍摄时间'
    }
export const sidebarEn: LocaleMessages['sidebar'] = {
      aria: 'Date sidebar',
      title: 'Capture Dates',
      empty: 'After choosing an album, dates will be grouped by year here.',
      actionsTitle: 'Capture Actions', noAction: 'No action', unparsed: 'Unparsed',
      parseProgress: (completed, total) => `Parsing ${completed}/${total}`,
      sort: 'Sort', sortId: 'Action ID (newest first)', sortName: 'Name', sortCount: 'Photo count', sortLatest: 'Latest capture'
    }

