import { describe, expect, it } from 'vitest'
import { weatherName } from '../../src/utils/photo-params/weather'

describe('weatherName', () => {
  it('maps known weather enum values', () => {
    expect(weatherName(0, 'zh')).toBe('晴天')
    expect(weatherName(2, 'zh')).toBe('雨天')
    expect(weatherName(4, 'en')).toBe('Rainbow')
    expect(weatherName(7, 'en')).toBe('Sea of Stars')
  })

  it('keeps unknown enum values visible', () => {
    expect(weatherName(99, 'zh')).toBe('WeatherType 99')
  })
})
