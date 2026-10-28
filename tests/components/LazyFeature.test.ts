import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, ref } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { lazyFeature } from '../../src/utils/lazyFeature'
import { reportError } from '../../src/utils/errorReporting/errorReporter'

vi.mock('../../src/utils/errorReporting/errorReporter', () => ({ reportError: vi.fn() }))
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

it('loads only when rendered, retries failures and reuses the resolved component', async () => {
  vi.useFakeTimers()
  const ready = defineComponent({ template: '<p class="feature-ready">Ready</p>' })
  const loader = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(ready)
  const language = ref<'zh' | 'en'>('zh')
  const Feature = lazyFeature(loader, () => language.value)
  const visible = ref(false)
  const wrapper = mount(defineComponent(() => () => (visible.value ? h(Feature) : null)))
  try {
    expect(loader).not.toHaveBeenCalled()
    visible.value = true
    await flushPromises()
    await vi.advanceTimersByTimeAsync(160)
    expect(wrapper.get('[role="status"]').text()).toContain('页面加载失败')
    expect(reportError).toHaveBeenCalledOnce()
    language.value = 'en'
    await flushPromises()
    expect(wrapper.get('button').text()).toBe('Retry')
    await wrapper.get('button').trigger('click')
    await flushPromises()
    expect(wrapper.get('.feature-ready').text()).toBe('Ready')
    expect(loader).toHaveBeenCalledTimes(2)
    visible.value = false
    await flushPromises()
    visible.value = true
    await flushPromises()
    expect(wrapper.find('.feature-ready').exists()).toBe(true)
    expect(loader).toHaveBeenCalledTimes(2)
  } finally {
    wrapper.unmount()
  }
})
