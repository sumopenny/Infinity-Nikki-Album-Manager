export type ThumbnailMode = 'default' | 'wide' | 'standard' | 'portrait-wide' | 'portrait-standard'

export type ThumbnailSize = 'small' | 'medium' | 'large'
export type ThumbnailRatioKind = 'photo' | 'outfit' | 'home'
export type ThumbnailKind = ThumbnailRatioKind | 'camera'
export const THUMBNAIL_SIZES: ThumbnailSize[] = ['small', 'medium', 'large']

export function isThumbnailSize(value: string | null): value is ThumbnailSize {
  return THUMBNAIL_SIZES.some((size) => size === value)
}

export const THUMBNAIL_MODE_OPTIONS: Array<{ value: ThumbnailMode; label: string }> = [
  { value: 'default', label: '1:1' },
  { value: 'wide', label: '16:9' },
  { value: 'standard', label: '4:3' },
  { value: 'portrait-wide', label: '9:16' },
  { value: 'portrait-standard', label: '3:4' }
]

export function isThumbnailMode(value: string | null): value is ThumbnailMode {
  return THUMBNAIL_MODE_OPTIONS.some((option) => option.value === value)
}
