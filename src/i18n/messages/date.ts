// 日期文案：中文和英文日期显示、月份显示及日期选择辅助文字。
import type { LocaleMessages } from '../types'
import { enDisplayDate, enMonthDay, zhDisplayDate, zhMonthDay } from '../formatters'

export const dateZh: LocaleMessages['date'] = {
      displayDate: zhDisplayDate,
      monthDay: zhMonthDay
    }
export const dateEn: LocaleMessages['date'] = {
      displayDate: enDisplayDate,
      monthDay: enMonthDay
    }

