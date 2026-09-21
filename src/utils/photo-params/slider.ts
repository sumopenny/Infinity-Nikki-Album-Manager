export interface SliderRange {
  min: number
  max: number
}

/** 上游 CameraParams 编辑器使用的数值范围。 */
export const PHOTO_PARAM_RANGES = {
  focalLength: { min: 0, max: 1 },
  photoFocalLength: { min: 10, max: 55 },
  aperture: { min: 1, max: 15 },
  unit: { min: 0, max: 1 },
  signed: { min: -1, max: 1 },
} as const satisfies Record<string, SliderRange>

/** 把上游滑杆数值换算为 0～100 的显示比例，并限制在轨道范围内。 */
export function sliderPercent(value: unknown, range: SliderRange, fallback = 50): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || !Number.isFinite(range.min) || !Number.isFinite(range.max) || range.max <= range.min) return fallback
  return Math.max(0, Math.min(100, ((parsed - range.min) / (range.max - range.min)) * 100))
}

/** CameraParams 原始焦距是 0～1，界面显示为 10～55mm。 */
export function rawFocalLengthDisplay(value: unknown): { millimeters: number; position: number } | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return {
    millimeters: 10 + parsed * 45,
    position: sliderPercent(parsed, PHOTO_PARAM_RANGES.focalLength),
  }
}

/** 完整照片 PhotoInfo 中保存的是实际焦距（10～55mm）。 */
export function photoFocalLengthDisplay(value: unknown): { millimeters: number; position: number } | null {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return {
    millimeters: parsed,
    position: sliderPercent(parsed, PHOTO_PARAM_RANGES.photoFocalLength),
  }
}
