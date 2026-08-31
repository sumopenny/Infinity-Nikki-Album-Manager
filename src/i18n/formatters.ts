// 国际化格式化函数：提供中文/英文日期、月份和文件大小的展示格式化。

const englishMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function splitDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-')
  const monthIndex = Number(month) - 1
  const dayNumber = Number(day)
  return { year, month, day, monthIndex, dayNumber }
}

export function zhDisplayDate(dateKey: string): string {
  const { year, month, day } = splitDateKey(dateKey)
  return year && month && day ? `${year}年${Number(month)}月${Number(day)}日` : dateKey
}

export function zhMonthDay(dateKey: string): string {
  const { month, day } = splitDateKey(dateKey)
  return month && day ? `${Number(month)}月${Number(day)}日` : dateKey
}

export function enDisplayDate(dateKey: string): string {
  const { year, day, monthIndex, dayNumber } = splitDateKey(dateKey)
  const monthName = englishMonths[monthIndex]
  return year && monthName && day ? `${monthName} ${dayNumber}, ${year}` : dateKey
}

export function enMonthDay(dateKey: string): string {
  const { monthIndex, dayNumber } = splitDateKey(dateKey)
  const monthName = englishMonths[monthIndex]
  return monthName ? `${monthName} ${dayNumber}` : dateKey
}

/** 格式化操作提示中的字节容量。参数：bytes 为字节数。 */
export function formatMessageFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`
}


