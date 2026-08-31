// 抽卡吉时文案：吉时表格、推荐时间、注意事项和娱乐性说明文字。
import type { LocaleMessages } from '../types'

export const fortuneTimeZh: LocaleMessages['fortuneTime'] = {
      title: '2.9版本抽卡吉时', close: '关闭抽卡吉时窗口',
      intro: '根据日期整体宜忌、黄道时辰、求财/交易属性和时辰财神方位。时间均为北京时间，方位以本人面朝方向为准。',
      disclaimer: '娱乐性玄学推演，仅供参考；实际出率仍以游戏概率为准，欧非程度作者不负责。',
      tableTitle: '2.9版本吉时', date: '日期推荐', time: '吉时', direction: '面朝方位', rating: '适合程度',
      rows: [
        { date: '8月30日', time: '15:00—18:59', direction: '西南', rating: '中吉备用' },
        { date: '9月3日', time: '15:00—18:59', direction: '东北', rating: '大吉', highlighted: true },
        { date: '9月4日', time: '13:00—14:59', direction: '东北', rating: '大吉', highlighted: true },
        { date: '9月5日', time: '15:00—18:59', direction: '正北', rating: '大吉', highlighted: true },
        { date: '9月10日', time: '19:00—20:59', direction: '正东', rating: '吉' },
        { date: '9月12日', time: '19:00—20:59', direction: '东北', rating: '吉' },
        { date: '9月16日', time: '19:00—22:59', direction: '正南', rating: '最强主推', highlighted: true },
        { date: '9月20日', time: '11:00—12:59', direction: '西南', rating: '中吉备用' },
        { date: '9月21日', time: '15:00—16:59', direction: '正东', rating: '大吉', highlighted: true },
        { date: '9月22日', time: '11:00—14:59', direction: '正东', rating: '大吉', highlighted: true },
        { date: '9月24日', time: '05:00—06:59', direction: '正东', rating: '吉，但时间偏早' }
      ],
      recommendedTitle: '最推荐的四个窗口',
      recommendations: [
        { title: '9月16日19:00—20:59，面朝正南', details: ['成日。', '当日宜开市、交易、纳财。', '19点金匮、21点天德，连续性最好。', '适合版本主阁、双五星阁或集中投入。'] },
        { title: '9月3日15:00—18:59，面朝东北', details: ['成日。', '当日宜开市、交易、祈福。', '15点金匮、17点天德，两个连续黄道时段。'] },
        { title: '9月5日15:00—18:59，面朝正北', details: ['开日。', '当日宜开市、纳财、出行。', '适合新版本开阁或第一次主抽。'] },
        { title: '9月22日11:00—14:59，面朝正东', details: ['满日。', '当日宜开市、交易、立券、纳财。', '11点青龙、13点明堂，适合补齐套装。'] }
      ],
      avoidTitle: '不建议日期',
      avoidDates: '整日尽量避开：8月28日、8月31日、9月1日、9月6日至9月9日、9月13日至9月15日、9月17日至9月19日、9月23日。',
      avoidItems: ['9月1日、9月13日：破日，整体不适合抽阁。', '9月8日、9月14日：黄历明确“诸事不宜”或破日。', '8月31日、9月15日、9月17日至19日：日级忌开市或交易。', '每天的03:00—04:59属寅时，建议统一剔除，避免与部分玩家生肖相冲。'],
      summaryTitle: '总结一下',
      summary: '主阁集中抽取选9月16日19:00—20:59面朝正南；想在版本前期尽早开抽选9月3日15:00—18:59面朝东北；后期追齐补件选9月22日11:00—14:59面朝正东。',
      footnote: '娱乐性抽卡时间表，不代表会改变游戏实际概率。'
    }
export const fortuneTimeEn: LocaleMessages['fortuneTime'] = {
      title: 'Version 2.9 Lucky Pull Times', close: 'Close lucky pull times',
      intro: 'Based on the day-level auspiciousness, zodiac hours, wealth/trade attributes, and the God of Wealth direction for each hour. All times are Beijing Time; face the listed direction while pulling.',
      disclaimer: 'For entertainment and traditional-metaphysics speculation only. Actual drop rates follow the game probabilities; the author is not responsible for your luck.',
      tableTitle: 'Version 2.9 Lucky Times', date: 'Date', time: 'Lucky time', direction: 'Face toward', rating: 'Rating',
      rows: [
        { date: 'Aug 30', time: '15:00-18:59', direction: 'Southwest', rating: 'Moderately auspicious' },
        { date: 'Sep 3', time: '15:00-18:59', direction: 'Northeast', rating: 'Highly auspicious', highlighted: true },
        { date: 'Sep 4', time: '13:00-14:59', direction: 'Northeast', rating: 'Highly auspicious', highlighted: true },
        { date: 'Sep 5', time: '15:00-18:59', direction: 'Due north', rating: 'Highly auspicious', highlighted: true },
        { date: 'Sep 10', time: '19:00-20:59', direction: 'Due east', rating: 'Auspicious' },
        { date: 'Sep 12', time: '19:00-20:59', direction: 'Northeast', rating: 'Auspicious' },
        { date: 'Sep 16', time: '19:00-22:59', direction: 'Due south', rating: 'Top pick', highlighted: true },
        { date: 'Sep 20', time: '11:00-12:59', direction: 'Southwest', rating: 'Moderately auspicious' },
        { date: 'Sep 21', time: '15:00-16:59', direction: 'Due east', rating: 'Highly auspicious', highlighted: true },
        { date: 'Sep 22', time: '11:00-14:59', direction: 'Due east', rating: 'Highly auspicious', highlighted: true },
        { date: 'Sep 24', time: '05:00-06:59', direction: 'Due east', rating: 'Auspicious, but early' }
      ],
      recommendedTitle: 'Four most recommended windows',
      recommendations: [
        { title: 'Sep 16, 19:00-20:59, face due south', details: ['A completion day.', 'The day favors opening markets, trading, and receiving wealth.', '19:00 Golden Cabinet and 21:00 Heavenly Virtue create the best continuity.', 'Best for the main banner, double-five-star banners, or concentrated pulls.'] },
        { title: 'Sep 3, 15:00-18:59, face northeast', details: ['A completion day.', 'The day favors opening markets, trading, and prayer.', '15:00 Golden Cabinet and 17:00 Heavenly Virtue are consecutive auspicious hours.'] },
        { title: 'Sep 5, 15:00-18:59, face due north', details: ['An opening day.', 'The day favors opening markets, receiving wealth, and travel.', 'Best for opening a new-version banner or making the first main pull.'] },
        { title: 'Sep 22, 11:00-14:59, face due east', details: ['A fullness day.', 'The day favors opening markets, trading, contracts, and receiving wealth.', '11:00 Azure Dragon and 13:00 Bright Hall suit completing a set.'] }
      ],
      avoidTitle: 'Dates to avoid',
      avoidDates: 'Avoid the entire day when possible: Aug 28, Aug 31, Sep 1, Sep 6-9, Sep 13-15, Sep 17-19, and Sep 23.',
      avoidItems: ['Sep 1 and Sep 13: Break days, generally unsuitable for pulling.', 'Sep 8 and Sep 14: Almanac marks them as unsuitable for all activities or as Break days.', 'Aug 31, Sep 15, and Sep 17-19: The day-level signs discourage opening markets or trading.', '03:00-04:59 is the Tiger hour; excluding it uniformly avoids conflicts with some players’ zodiac signs.'],
      summaryTitle: 'Summary',
      summary: 'For concentrated main-banner pulls, choose Sep 16, 19:00-20:59, facing due south. To pull early in the version, choose Sep 3, 15:00-18:59, facing northeast. To complete missing pieces later, choose Sep 22, 11:00-14:59, facing due east.',
      footnote: 'This is an entertainment-only pull-time table and does not change the game’s actual probabilities.'
    }

