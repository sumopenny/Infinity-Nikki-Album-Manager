export type ThumbnailMode = 'default' | 'half' | 'wide' | 'standard' | 'portrait-wide' | 'portrait-standard'

export const THUMBNAIL_MODE_OPTIONS: Array<{ value: ThumbnailMode; label: string }> = [
  { value: 'default', label: '默认 1:1' },
  { value: 'half', label: '半尺寸 1:1' },
  { value: 'wide', label: '16:9' },
  { value: 'standard', label: '4:3' },
  { value: 'portrait-wide', label: '9:16' },
  { value: 'portrait-standard', label: '3:4' }
]

export function isThumbnailMode(value: string | null): value is ThumbnailMode {
  return THUMBNAIL_MODE_OPTIONS.some((option) => option.value === value)
}
