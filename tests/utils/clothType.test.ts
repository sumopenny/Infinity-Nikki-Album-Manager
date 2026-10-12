import { describe, expect, it } from 'vitest'
import { getClothTypeLabel, inferClothTypeFromItemId } from '../../src/utils/outfit/clothType'

describe('getClothTypeLabel', () => {
  it('returns null for unknown or missing types', () => {
    expect(getClothTypeLabel(999, 'zh')).toBeNull()
    expect(getClothTypeLabel(null, 'en')).toBeNull()
  })

  it('infers native item types from their category prefix', () => {
    expect(inferClothTypeFromItemId(1020500290)).toBe(50)
    expect(inferClothTypeFromItemId(1025740294)).toBe(74)
    expect(inferClothTypeFromItemId(1020830001)).toBe(83)
    expect(inferClothTypeFromItemId(1020790033)).toBe(96)
    expect(inferClothTypeFromItemId(999)).toBeNull()
  })
})
