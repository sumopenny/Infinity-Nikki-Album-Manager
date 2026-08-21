export interface ParsedPhotoDate {
  dateKey: string
  year: string
  monthDay: string
  displayDate: string
  timeText: string
  timestamp: number
}

const FILE_DATE_PATTERN = /^(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})(?:_(\d{2}))?/

/** 将文件时间戳转换为相册使用的日期元数据。 */
export function datePartsFromTimestamp(timestamp: number): ParsedPhotoDate | null {
  if (!Number.isFinite(timestamp)) return null
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return null
  const year = String(date.getFullYear()).padStart(4, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  return {
    dateKey: `${year}-${month}-${day}`,
    year,
    monthDay: `${month}月${day}日`,
    displayDate: `${year}年${month}月${day}日`,
    timeText: `${hour}:${minute}`,
    timestamp: date.getTime()
  }
}

export function parsePhotoDate(fileName: string): ParsedPhotoDate | null {
  const match = fileName.match(FILE_DATE_PATTERN)
  if (!match) return null

  const [, year, month, day, hour, minute, second = '00'] = match
  const timestamp = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime()

  return {
    dateKey: `${year}-${month}-${day}`,
    year,
    monthDay: `${month}月${day}日`,
    displayDate: `${year}年${month}月${day}日`,
    timeText: `${hour}:${minute}`,
    timestamp
  }
}

export interface PhotoItem extends ParsedPhotoDate {
  id: string
  name: string
  url: string | null
  fileSizeText: string
  fileSize?: number
  lastModified?: number
  fileHandle: FileSystemFileHandle
  directoryHandle: FileSystemDirectoryHandle
}

export interface RecentlyDeletedPhoto extends PhotoItem {
  trashName: string
  originalName: string
  deletedAt: number
  wasFavorite: boolean
  size: number | null
}

export interface DateGroup {
  dateKey: string
  year: string
  monthDay: string
  displayDate: string
  photos: PhotoItem[]
}

export interface YearGroup {
  year: string
  months: MonthGroup[]
  photoCount: number
}

export interface MonthGroup {
  monthKey: string
  month: string
  dates: DateGroup[]
  photoCount: number
}

export function groupPhotosByDate(photos: PhotoItem[]): DateGroup[] {
  const map = new Map<string, DateGroup>()

  for (const photo of photos) {
    if (!map.has(photo.dateKey)) {
      map.set(photo.dateKey, {
        dateKey: photo.dateKey,
        year: photo.year,
        monthDay: photo.monthDay,
        displayDate: photo.displayDate,
        photos: []
      })
    }
    map.get(photo.dateKey)?.photos.push(photo)
  }

  return [...map.values()]
    .map((group) => ({
      ...group,
      photos: group.photos.sort((a, b) => b.timestamp - a.timestamp)
    }))
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
}

/**
 * 将日期分组整理为年份、月份、日期三级时间轴。
 * 参数：groups 为按日期聚合的照片列表。
 * 返回：按年份和月份倒序排列并带照片计数的时间轴。
 */
export function groupDatesByYear(groups: DateGroup[]): YearGroup[] {
  const yearMap = new Map<string, Map<string, DateGroup[]>>()

  for (const group of groups) {
    const month = group.dateKey.slice(5, 7)
    const monthMap = yearMap.get(group.year) ?? new Map<string, DateGroup[]>()
    const dates = monthMap.get(month) ?? []
    dates.push(group)
    monthMap.set(month, dates)
    yearMap.set(group.year, monthMap)
  }

  return [...yearMap.entries()]
    .map(([year, monthMap]) => {
      const months = [...monthMap.entries()]
        .map(([month, dates]) => ({
          monthKey: `${year}-${month}`,
          month,
          dates: [...dates].sort((a, b) => b.dateKey.localeCompare(a.dateKey)),
          photoCount: dates.reduce((total, date) => total + date.photos.length, 0)
        }))
        .sort((a, b) => b.month.localeCompare(a.month))

      return {
        year,
        months,
        photoCount: months.reduce((total, month) => total + month.photoCount, 0)
      }
    })
    .sort((a, b) => b.year.localeCompare(a.year))
}
