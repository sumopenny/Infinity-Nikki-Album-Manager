export interface ParsedPhotoDate {
  dateKey: string
  year: string
  monthDay: string
  displayDate: string
  timeText: string
  timestamp: number
}

const FILE_DATE_PATTERN = /^(\d{4})_(\d{2})_(\d{2})_(\d{2})_(\d{2})(?:_(\d{2}))?/

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
  url: string
  file: File
  fileSizeText: string
  fileHandle: FileSystemFileHandle
  directoryHandle: FileSystemDirectoryHandle
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
  dates: DateGroup[]
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

export function groupDatesByYear(groups: DateGroup[]): YearGroup[] {
  const map = new Map<string, DateGroup[]>()

  for (const group of groups) {
    const dates = map.get(group.year) ?? []
    dates.push(group)
    map.set(group.year, dates)
  }

  return [...map.entries()]
    .map(([year, dates]) => ({ year, dates }))
    .sort((a, b) => b.year.localeCompare(a.year))
}
