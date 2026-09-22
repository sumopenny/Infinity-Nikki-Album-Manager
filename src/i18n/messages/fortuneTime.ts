// 抽卡吉时文案：吉时表格、推荐时间、注意事项和娱乐性说明文字。
import type { LocaleMessages } from '../types'

export const fortuneTimeZh: LocaleMessages['fortuneTime'] = {
      title: '2.10版本抽卡吉时', close: '关闭抽卡吉时窗口',
      intro: '根据日期整体宜忌、黄道时辰、求财/交易属性和时辰财神方位。时间均为北京时间，方位以本人面朝方向为准。',
      disclaimer: '娱乐性玄学推演，仅供参考；实际出率仍以游戏概率为准，欧非程度作者不负责。',
      tableTitle: '2.10版本吉时', date: '日期推荐', time: '吉时', direction: '面朝方位', rating: '适合程度',
      rows: [
        { date: '9月24日', time: '19:00—20:59', direction: '正北', rating: '更新后首选', highlighted: true },
        { date: '9月28日', time: '07:00—08:59；13:00—14:59；19:00—22:59', direction: '正东；正南；西南', rating: '大吉', highlighted: true },
        { date: '10月2日', time: '05:00—06:59；11:00—12:59', direction: '西南；正东', rating: '可抽' },
        { date: '10月3日', time: '07:00—08:59', direction: '正东', rating: '可抽' },
        { date: '10月4日', time: '11:00—12:59', direction: '东北', rating: '大吉', highlighted: true },
        { date: '10月6日', time: '09:00—10:59', direction: '西南', rating: '吉' },
        { date: '10月8日', time: '11:00—14:59', direction: '正南', rating: '可补抽' },
        { date: '10月10日', time: '19:00—20:59', direction: '正东', rating: '可补抽' },
        { date: '10月11日', time: '05:00—06:59；17:00—18:59', direction: '东北；正东', rating: '大吉', highlighted: true },
        { date: '10月13日', time: '07:00—10:59；19:00—20:59', direction: '正东；西南', rating: '最强主推', highlighted: true },
        { date: '10月15日', time: '21:00—22:59', direction: '正东', rating: '可补抽' },
        { date: '10月16日', time: '19:00—22:59', direction: '正南', rating: '吉' },
        { date: '10月23日', time: '05:00—06:59；17:00—18:59', direction: '正北；东北', rating: '大吉', highlighted: true },
        { date: '10月25日', time: '07:00—08:59', direction: '东北', rating: '可补抽' },
        { date: '10月28日', time: '11:00—14:59', direction: '正南', rating: '可补抽' },
        { date: '10月29日', time: '01:00—02:59；15:00—16:59', direction: '正北；西南', rating: '大吉', highlighted: true }
      ],
      recommendedTitle: '主推排序',
      recommendations: [
        { title: '10月13日07:00—10:59，面朝正东', details: [] },
        { title: '9月28日19:00—22:59，面朝西南', details: [] },
        { title: '10月23日17:00—18:59，面朝东北', details: [] },
        { title: '10月29日15:00—16:59，面朝西南', details: [] },
        { title: '10月4日11:00—12:59，面朝东北', details: [] }
      ],
      avoidTitle: '不建议日期',
      avoidDates: '不建议作为大众主推的日期：9月25—26日、10月1日、10月5日、10月7日、10月9日、10月14日、10月17—21日、10月24日、10月26—27日，以及10月30日03:49前。',
      avoidItems: ['其中10月9日为“诸事不宜”，10月30日截止前也没有干净的抽卡窗口。'],
      summaryTitle: '总结一下',
      summary: '版本更新后想尽早抽选9月24日19点正北；主阁或双五星首选10月13日07:00—10:59正东，后期补件选10月29日15:00—16:59西南。',
      footnote: '娱乐性抽卡时间表，不代表会改变游戏实际概率。'
    }
export const fortuneTimeEn: LocaleMessages['fortuneTime'] = {
      title: 'Version 2.10 Lucky Pull Times', close: 'Close lucky pull times',
      intro: 'Based on the day-level auspiciousness, zodiac hours, wealth/trade attributes, and the God of Wealth direction for each hour. All times are Beijing Time; face the listed direction while pulling.',
      disclaimer: 'For entertainment and traditional-metaphysics speculation only. Actual drop rates follow the game probabilities; the author is not responsible for your luck.',
      tableTitle: 'Version 2.10 Lucky Times', date: 'Date', time: 'Lucky time', direction: 'Face toward', rating: 'Rating',
      rows: [
        { date: 'Sep 24', time: '19:00-20:59', direction: 'Due north', rating: 'First choice after update', highlighted: true },
        { date: 'Sep 28', time: '07:00-08:59; 13:00-14:59; 19:00-22:59', direction: 'Due east; due south; southwest', rating: 'Highly auspicious', highlighted: true },
        { date: 'Oct 2', time: '05:00-06:59; 11:00-12:59', direction: 'Southwest; due east', rating: 'Pullable' },
        { date: 'Oct 3', time: '07:00-08:59', direction: 'Due east', rating: 'Pullable' },
        { date: 'Oct 4', time: '11:00-12:59', direction: 'Northeast', rating: 'Highly auspicious', highlighted: true },
        { date: 'Oct 6', time: '09:00-10:59', direction: 'Southwest', rating: 'Auspicious' },
        { date: 'Oct 8', time: '11:00-14:59', direction: 'Due south', rating: 'Good for extra pulls' },
        { date: 'Oct 10', time: '19:00-20:59', direction: 'Due east', rating: 'Good for extra pulls' },
        { date: 'Oct 11', time: '05:00-06:59; 17:00-18:59', direction: 'Northeast; due east', rating: 'Highly auspicious', highlighted: true },
        { date: 'Oct 13', time: '07:00-10:59; 19:00-20:59', direction: 'Due east; southwest', rating: 'Top recommendation', highlighted: true },
        { date: 'Oct 15', time: '21:00-22:59', direction: 'Due east', rating: 'Good for extra pulls' },
        { date: 'Oct 16', time: '19:00-22:59', direction: 'Due south', rating: 'Auspicious' },
        { date: 'Oct 23', time: '05:00-06:59; 17:00-18:59', direction: 'Due north; northeast', rating: 'Highly auspicious', highlighted: true },
        { date: 'Oct 25', time: '07:00-08:59', direction: 'Northeast', rating: 'Good for extra pulls' },
        { date: 'Oct 28', time: '11:00-14:59', direction: 'Due south', rating: 'Good for extra pulls' },
        { date: 'Oct 29', time: '01:00-02:59; 15:00-16:59', direction: 'Due north; southwest', rating: 'Highly auspicious', highlighted: true }
      ],
      recommendedTitle: 'Recommended ranking',
      recommendations: [
        { title: 'Oct 13, 07:00-10:59, face due east', details: [] },
        { title: 'Sep 28, 19:00-22:59, face southwest', details: [] },
        { title: 'Oct 23, 17:00-18:59, face northeast', details: [] },
        { title: 'Oct 29, 15:00-16:59, face southwest', details: [] },
        { title: 'Oct 4, 11:00-12:59, face northeast', details: [] }
      ],
      avoidTitle: 'Dates to avoid',
      avoidDates: 'Dates not recommended as general picks: Sep 25-26, Oct 1, Oct 5, Oct 7, Oct 9, Oct 14, Oct 17-21, Oct 24, Oct 26-27, and before 03:49 on Oct 30.',
      avoidItems: ['Oct 9 is marked as unsuitable for all activities, and there is no clean pull window before the Oct 30 cutoff.'],
      summaryTitle: 'Summary',
      summary: 'To pull as soon as possible after the version update, choose Sep 24 at 19:00, facing due north. For the main banner or double five-star pulls, choose Oct 13, 07:00-10:59, facing due east. For late-version completion pulls, choose Oct 29, 15:00-16:59, facing southwest.',
      footnote: 'This is an entertainment-only pull-time table and does not change the game’s actual probabilities.'
    }
