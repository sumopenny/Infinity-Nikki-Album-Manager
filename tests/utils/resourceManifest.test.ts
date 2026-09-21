import { describe, expect, it } from 'vitest'
import { resourceImage, resourceName } from '../../src/utils/photo-params/resourceManifest'

describe('Nuan5 resource manifest', () => {
  it('resolves a light string ID to the database key and image template', () => {
    expect(resourceName('light', 'DirectionLight_L', 'zh')).toBe('侧光-左')
    expect(resourceImage('light', 'DirectionLight_L')).toBe('https://cdn.nikkialbums.com/light/1090030005.webp')
    expect(resourceImage('light', 1090030005)).toBe('https://cdn.nikkialbums.com/light/1090030005.webp')
  })

  it('resolves a filter string ID to the database key', () => {
    expect(resourceName('filter', 'Fresh_002', 'en')).toBe('Blossoming Pink')
    expect(resourceImage('filter', 'Fresh_002')).toBe('https://cdn.nikkialbums.com/filter/1090020002.webp')
  })

  it('resolves a normal pose name and NikkiGallery image', () => {
    expect(resourceName('pose', 1090012163, 'zh')).toBe('锋芒入定')
    expect(resourceName('pose', '1090012163', 'en')).toBe('锋芒入定')
    expect(resourceImage('pose', 1090012163)).toBe('https://nikkigallery.vip/static/img/photography/T_Icon_S0304_Suit_01.png')
  })

  it('supports Momo aliases', () => {
    expect(resourceName('momo', 'Trends_damiao_002', 'zh')).toBe('陶醉舞步')
    expect(resourceImage('momo', 'Trends_damiao_002')).toBe('https://cdn.nikkialbums.com/momo_pose/1090050002.webp')
  })

  it('falls back safely for disabled and unknown resources', () => {
    expect(resourceName('light', 'None', 'zh')).toBe('无')
    expect(resourceName('filter', 'new_filter_999', 'en')).toBe('new_filter_999')
    expect(resourceImage('light', 'new_light_999')).toBeUndefined()
    expect(resourceImage('pose', 'new_pose_999')).toBeUndefined()
  })
})
