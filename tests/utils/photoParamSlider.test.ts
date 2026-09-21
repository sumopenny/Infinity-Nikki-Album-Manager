import { describe, expect, it } from 'vitest'
import { PHOTO_PARAM_RANGES, photoFocalLengthDisplay, rawFocalLengthDisplay, sliderPercent } from '../../src/utils/photo-params/slider'

describe('photo parameter slider ranges', () => {
  it('maps signed values around zero to the upstream slider midpoint', () => {
    expect(sliderPercent(-1, PHOTO_PARAM_RANGES.signed)).toBe(0)
    expect(sliderPercent(0, PHOTO_PARAM_RANGES.signed)).toBe(50)
    expect(sliderPercent(1, PHOTO_PARAM_RANGES.signed)).toBe(100)
  })

  it('keeps unit and aperture ranges aligned with the upstream editor', () => {
    expect(sliderPercent(0.4, PHOTO_PARAM_RANGES.unit)).toBe(40)
    expect(sliderPercent(1, PHOTO_PARAM_RANGES.aperture)).toBe(0)
    expect(sliderPercent(8, PHOTO_PARAM_RANGES.aperture)).toBe(50)
    expect(sliderPercent(15, PHOTO_PARAM_RANGES.aperture)).toBe(100)
  })

  it('converts raw and full-photo focal lengths using their separate units', () => {
    expect(rawFocalLengthDisplay(0.12)?.millimeters).toBeCloseTo(15.4)
    expect(rawFocalLengthDisplay(0.12)?.position).toBe(12)
    expect(photoFocalLengthDisplay(10)).toEqual({ millimeters: 10, position: 0 })
    expect(photoFocalLengthDisplay(32.5)).toEqual({ millimeters: 32.5, position: 50 })
    expect(photoFocalLengthDisplay(55)).toEqual({ millimeters: 55, position: 100 })
  })

  it('clamps values outside the editable range', () => {
    expect(sliderPercent(-2, PHOTO_PARAM_RANGES.unit)).toBe(0)
    expect(sliderPercent(2, PHOTO_PARAM_RANGES.unit)).toBe(100)
    expect(sliderPercent('not-a-number', PHOTO_PARAM_RANGES.unit)).toBe(50)
  })
})
