import { describe, expect, it } from 'vitest'
import { weatherName } from '../../src/utils/photo-params/weather'

describe('weatherName', () => {
  it('keeps unknown enum values visible', () => {
    expect(weatherName(99, 'zh')).toBe('WeatherType 99')
  })
})
