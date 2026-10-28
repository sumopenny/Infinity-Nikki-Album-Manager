// 抽卡吉时文案：吉时表格、推荐时间、注意事项和娱乐性说明文字。
import type { LocaleMessages } from '../types'

export const fortuneTimeZh: LocaleMessages['fortuneTime'] = {
  title: '2.11版本抽卡吉时',
  close: '关闭抽卡吉时窗口',
  intro:
    '根据日期整体宜忌、黄道时辰、求财/交易属性和时辰财神方位。时间均为北京时间，方位以本人面朝方向为准。',
  disclaimer: '娱乐性玄学推演，仅供参考；实际出率仍以游戏概率为准，欧非程度作者不负责。',
  tableTitle: '2.11版本吉时',
  date: '日期推荐',
  time: '吉时',
  direction: '面朝方位',
  zodiac: '需避开生肖',
  rating: '适合程度',
  rows: [
    {
      date: '11月3日',
      time: '13:00—14:59',
      direction: '东北',
      zodiac: '属猪应避开',
      rating: '吉，宜交易、纳财',
      highlighted: true
    },
    {
      date: '11月4日',
      time: '15:00—16:59；17:00—18:59',
      direction: '正北',
      zodiac: '属鼠应避开',
      rating: '大吉，成日，适合前期主抽',
      highlighted: true
    },
    {
      date: '11月10日',
      time: '11:00—12:59；15:00—16:59',
      direction: '正北；正东',
      zodiac: '属马应避开',
      rating: '吉'
    },
    {
      date: '11月12日',
      time: '07:00—08:59',
      direction: '正东',
      zodiac: '属猴应避开',
      rating: '吉，宜求财、交易'
    },
    {
      date: '11月13日',
      time: '11:00—12:59；17:00—18:59',
      direction: '东北；西南',
      zodiac: '属鸡应避开',
      rating: '大吉，定日',
      highlighted: true
    },
    {
      date: '11月16日',
      time: '11:00—12:59；15:00—16:59；17:00—18:59',
      direction: '正东；正南；正南',
      zodiac: '属鼠应避开',
      rating: '大吉，适合集中主抽',
      highlighted: true
    },
    {
      date: '11月17日',
      time: '05:00—06:59；15:00—16:59',
      direction: '正北；东北',
      zodiac: '属牛应避开',
      rating: '吉，成日'
    },
    {
      date: '11月19日',
      time: '05:00—06:59；11:00—12:59',
      direction: '正南；西南',
      zodiac: '属兔应避开',
      rating: '大吉，开日，宜祈福、交易',
      highlighted: true
    },
    {
      date: '11月22日',
      time: '05:00—06:59；11:00—12:59',
      direction: '正北；正南',
      zodiac: '属马应避开',
      rating: '吉，适合补抽'
    },
    {
      date: '11月24日',
      time: '07:00—10:59；19:00—20:59',
      direction: '东北；正东',
      zodiac: '属猴应避开',
      rating: '吉，宜纳财、开市、交易',
      highlighted: true
    },
    {
      date: '11月25日',
      time: '11:00—12:59；17:00—18:59',
      direction: '正北；正东',
      zodiac: '属鸡应避开',
      rating: '最强主推，定日，宜祈福、纳财、交易',
      highlighted: true
    }
  ],
  recommendedTitle: '主推排序',
  recommendations: [
    { title: '11月25日17:00—18:59，面朝正东', details: [] },
    { title: '11月4日17:00—18:59，面朝正北', details: [] },
    { title: '11月16日17:00—18:59，面朝正南', details: [] },
    { title: '11月19日11:00—12:59，面朝西南', details: [] },
    { title: '11月13日17:00—18:59，面朝西南', details: [] }
  ],
  avoidTitle: '不建议日期',
  avoidDates:
    '10月30日11点以后没有足够干净的正式窗口：当天为平日且日级忌开市，不建议为了抢开服立即抽。首个正式推荐窗口是11月3日13:00—14:59，面朝东北。',
  avoidItems: [
    '11月24日07:00—10:59分为两个时辰：07:00—08:59面朝东北，时段冲狗；09:00—10:59面朝东北，时段冲猪。'
  ],
  summaryTitle: '总结一下',
  summary:
    '2.11版本前期主抽选11月4日17:00—18:59正北，中期选11月16日17:00—18:59正南，后期集中追套首选11月25日17:00—18:59正东。',
  footnote: '娱乐性抽卡时间表，不代表会改变游戏实际概率。'
}

export const fortuneTimeEn: LocaleMessages['fortuneTime'] = {
  title: 'Version 2.11 Lucky Pull Times',
  close: 'Close lucky pull times',
  intro:
    'Based on the day-level auspiciousness, zodiac hours, wealth/trade attributes, and the God of Wealth direction for each hour. All times are Beijing Time; face the listed direction while pulling.',
  disclaimer:
    'For entertainment and traditional-metaphysics speculation only. Actual drop rates follow the game probabilities; the author is not responsible for your luck.',
  tableTitle: 'Version 2.11 Lucky Times',
  date: 'Date',
  time: 'Lucky time',
  direction: 'Face toward',
  zodiac: 'Zodiac to avoid',
  rating: 'Rating',
  rows: [
    {
      date: 'Nov 3',
      time: '13:00–14:59',
      direction: 'Northeast',
      zodiac: 'Pig',
      rating: 'Auspicious; favors trade and wealth',
      highlighted: true
    },
    {
      date: 'Nov 4',
      time: '15:00–16:59; 17:00–18:59',
      direction: 'Due north',
      zodiac: 'Rat',
      rating: 'Highly auspicious; success day; good for early main pulls',
      highlighted: true
    },
    {
      date: 'Nov 10',
      time: '11:00–12:59; 15:00–16:59',
      direction: 'Due north; due east',
      zodiac: 'Horse',
      rating: 'Auspicious'
    },
    {
      date: 'Nov 12',
      time: '07:00–08:59',
      direction: 'Due east',
      zodiac: 'Monkey',
      rating: 'Auspicious; favors wealth and trade'
    },
    {
      date: 'Nov 13',
      time: '11:00–12:59; 17:00–18:59',
      direction: 'Northeast; southwest',
      zodiac: 'Rooster',
      rating: 'Highly auspicious; stable day',
      highlighted: true
    },
    {
      date: 'Nov 16',
      time: '11:00–12:59; 15:00–16:59; 17:00–18:59',
      direction: 'Due east; due south; due south',
      zodiac: 'Rat',
      rating: 'Highly auspicious; good for concentrated main pulls',
      highlighted: true
    },
    {
      date: 'Nov 17',
      time: '05:00–06:59; 15:00–16:59',
      direction: 'Due north; northeast',
      zodiac: 'Ox',
      rating: 'Auspicious; success day'
    },
    {
      date: 'Nov 19',
      time: '05:00–06:59; 11:00–12:59',
      direction: 'Due south; southwest',
      zodiac: 'Rabbit',
      rating: 'Highly auspicious; open day; favors blessings and trade',
      highlighted: true
    },
    {
      date: 'Nov 22',
      time: '05:00–06:59; 11:00–12:59',
      direction: 'Due north; due south',
      zodiac: 'Horse',
      rating: 'Auspicious; good for extra pulls'
    },
    {
      date: 'Nov 24',
      time: '07:00–10:59; 19:00–20:59',
      direction: 'Northeast; due east',
      zodiac: 'Monkey',
      rating: 'Auspicious; favors wealth, opening and trade',
      highlighted: true
    },
    {
      date: 'Nov 25',
      time: '11:00–12:59; 17:00–18:59',
      direction: 'Due north; due east',
      zodiac: 'Rooster',
      rating: 'Top recommendation; stable day; favors blessings, wealth and trade',
      highlighted: true
    }
  ],
  recommendedTitle: 'Recommended ranking',
  recommendations: [
    { title: 'Nov 25, 17:00–18:59, face due east', details: [] },
    { title: 'Nov 4, 17:00–18:59, face due north', details: [] },
    { title: 'Nov 16, 17:00–18:59, face due south', details: [] },
    { title: 'Nov 19, 11:00–12:59, face southwest', details: [] },
    { title: 'Nov 13, 17:00–18:59, face southwest', details: [] }
  ],
  avoidTitle: 'Dates to avoid',
  avoidDates:
    'After 11:00 on Oct 30 there is no sufficiently suitable official recommendation: it is a balanced day with opening a business listed as unfavorable. The first recommended window is Nov 3, 13:00–14:59, facing northeast.',
  avoidItems: [
    'Nov 24, 07:00–10:59 spans two hours: 07:00–08:59 faces northeast and clashes with Dog; 09:00–10:59 faces northeast and clashes with Pig.'
  ],
  summaryTitle: 'Summary',
  summary:
    'For early main pulls in version 2.11, choose Nov 4, 17:00–18:59, facing due north. For mid-version pulls, choose Nov 16, 17:00–18:59, facing due south. For late concentrated pulls, choose Nov 25, 17:00–18:59, facing due east.',
  footnote:
    'This is an entertainment-only pull-time table and does not change the game’s actual probabilities.'
}
