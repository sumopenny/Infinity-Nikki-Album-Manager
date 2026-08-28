import { describe, expect, it } from 'vitest'
import { groupDatesByYear, type DateGroup } from './photoGrouping'

/** 创建只包含分组所需字段的日期测试数据。参数：dateKey 为日期，count 为照片数量。 */
function createDateGroup(dateKey: string, count: number): DateGroup {
  return {
    dateKey,
    year: dateKey.slice(0, 4),
    monthDay: dateKey.slice(5),
    displayDate: dateKey,
    photos: Array.from({ length: count }, (_, index) => ({ id: `${dateKey}-${index}` } as DateGroup['photos'][number]))
  }
}

describe('groupDatesByYear', () => {
  it('groups dates by year and month in descending order with accurate counts', () => {
    const result = groupDatesByYear([
      createDateGroup('2025-12-30', 1),
      createDateGroup('2026-06-02', 2),
      createDateGroup('2026-07-04', 3),
      createDateGroup('2026-07-01', 4)
    ])

    expect(result.map((year) => year.year)).toEqual(['2026', '2025'])
    expect(result[0].photoCount).toBe(9)
    expect(result[0].months.map((month) => month.month)).toEqual(['07', '06'])
    expect(result[0].months[0].photoCount).toBe(7)
    expect(result[0].months[0].dates.map((date) => date.dateKey)).toEqual(['2026-07-04', '2026-07-01'])
  })
})
