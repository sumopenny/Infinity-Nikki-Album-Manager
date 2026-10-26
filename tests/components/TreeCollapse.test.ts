import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import TreeCollapse from '../../src/components/TreeCollapse.vue'
import DateSidebar from '../../src/components/DateSidebar.vue'
import { messages } from '../../src/i18n'

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  )
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('keeps closing content inert and cancels its removal when reopened quickly', async () => {
  const wrapper = mount(TreeCollapse, {
    props: { open: false },
    slots: { default: '<button>Date</button>' }
  })
  try {
    expect(wrapper.find('button').exists()).toBe(false)
    await wrapper.setProps({ open: true })
    expect(wrapper.attributes('inert')).toBeUndefined()
    expect(wrapper.find('button').exists()).toBe(true)
    await wrapper.setProps({ open: false })
    expect(wrapper.element.hasAttribute('inert')).toBe(true)
    expect(wrapper.attributes('aria-hidden')).toBe('true')
    expect(wrapper.find('button').exists()).toBe(true)
    await vi.advanceTimersByTimeAsync(80)
    await wrapper.setProps({ open: true })
    await vi.advanceTimersByTimeAsync(250)
    expect(wrapper.find('button').exists()).toBe(true)
    expect(wrapper.attributes('inert')).toBeUndefined()
    await wrapper.setProps({ open: false })
    await vi.advanceTimersByTimeAsync(210)
    expect(wrapper.find('button').exists()).toBe(false)
  } finally {
    wrapper.unmount()
  }
})

it('ignores nested transition events and releases content when its own height transition ends', async () => {
  const wrapper = mount(TreeCollapse, {
    props: { open: true },
    slots: { default: '<button>Date</button>' }
  })
  try {
    await wrapper.setProps({ open: false })
    await wrapper.get('button').trigger('transitionend', { propertyName: 'grid-template-rows' })
    expect(wrapper.find('button').exists()).toBe(true)
    await wrapper.trigger('transitionend', { propertyName: 'opacity' })
    expect(wrapper.find('button').exists()).toBe(true)
    await wrapper.trigger('transitionend', { propertyName: 'grid-template-rows' })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    wrapper.unmount()
  }
})

it('closes immediately when reduced motion is enabled', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true }))
  )
  const wrapper = mount(TreeCollapse, {
    props: { open: true },
    slots: { default: '<button>Date</button>' }
  })
  try {
    await wrapper.setProps({ open: false })
    expect(wrapper.find('button').exists()).toBe(false)
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    wrapper.unmount()
  }
})

it('preserves month expansion after closing and reopening a year and still jumps to dates', async () => {
  const date = {
    dateKey: '2026-10-22',
    year: '2026',
    monthDay: '10月22日',
    displayDate: '2026年10月22日',
    photos: []
  }
  const wrapper = mount(DateSidebar, {
    props: {
      yearGroups: [
        {
          year: '2026',
          photoCount: 0,
          months: [
            { monthKey: '2026-10', month: '10', photoCount: 0, dates: [date] },
            {
              monthKey: '2026-09',
              month: '09',
              photoCount: 0,
              dates: [{ ...date, dateKey: '2026-09-01', monthDay: '9月1日' }]
            }
          ]
        }
      ],
      actionGroups: [],
      mode: 'date',
      actionSort: 'id',
      language: 'zh',
      messages: messages.zh.sidebar
    }
  })
  try {
    expect(wrapper.get('.year-toggle').attributes('aria-expanded')).toBe('true')
    await wrapper.findAll('.month-toggle')[1]!.trigger('click')
    expect(wrapper.findAll('.date-link')).toHaveLength(2)
    await wrapper.get('.year-toggle').trigger('click')
    await vi.advanceTimersByTimeAsync(210)
    expect(wrapper.find('.month-toggle').exists()).toBe(false)
    await wrapper.get('.year-toggle').trigger('click')
    expect(
      wrapper
        .findAll('.month-toggle')
        .every((button) => button.attributes('aria-expanded') === 'true')
    ).toBe(true)
    await wrapper.findAll('.date-link')[1]!.trigger('click')
    expect(wrapper.emitted('jumpToDate')).toEqual([['2026-09-01']])
    await wrapper.findAll('.month-toggle')[1]!.trigger('click')
    await wrapper.get('.year-toggle').trigger('click')
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    if (wrapper.exists()) wrapper.unmount()
  }
})
