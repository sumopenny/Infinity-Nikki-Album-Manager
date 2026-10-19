import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref, type Component } from 'vue'
import { afterEach, expect, it, vi } from 'vitest'
import { lazyComponent } from '../../src/utils/lazyComponent'

afterEach(() => vi.useRealTimers())

it('offers a page reload after a stalled module exceeds 15 seconds without reopening a closed dialog when the download finishes', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
  let finish!: (value: { default: Component }) => void
  const loader = vi.fn(
    () =>
      new Promise<{ default: Component }>((resolve) => {
        finish = resolve
      })
  )
  const Module = lazyComponent(loader, true)
  const visible = ref(true)
  const wrapper = mount(
    {
      components: { Module },
      setup: () => ({ visible }),
      template: '<Module :visible="visible" @close="visible = false" />'
    },
    { global: { stubs: { Teleport: true } } }
  )
  try {
    await vi.advanceTimersByTimeAsync(14999)
    expect(wrapper.text()).toContain('正在加载')
    await vi.advanceTimersByTimeAsync(1)
    await flushPromises()
    expect(wrapper.text()).toContain('功能加载失败')
    expect(wrapper.text()).toContain('重新加载页面')
    expect(loader).toHaveBeenCalledOnce()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === '关闭')!
      .trigger('click')
    finish({
      default: defineComponent({
        props: { visible: Boolean },
        template: '<p v-if="visible">Late feature</p>'
      })
    })
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Late feature')
    visible.value = true
    await flushPromises()
    expect(wrapper.text()).toContain('Late feature')
  } finally {
    wrapper.unmount()
  }
})

it('shows a failed module and retries only after the user requests it', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const loader = vi
    .fn()
    .mockRejectedValueOnce(new Error('Chunk unavailable'))
    .mockResolvedValueOnce({
      default: defineComponent({ template: '<p>Feature ready</p>' })
    })
  const Module = lazyComponent(loader)
  const wrapper = mount({ components: { Module }, template: '<Module />' })
  await flushPromises()
  await vi.advanceTimersByTimeAsync(201)
  expect(wrapper.text()).toContain('功能加载失败')
  expect(loader).toHaveBeenCalledTimes(1)
  await wrapper.get('button').trigger('click')
  await flushPromises()
  expect(wrapper.text()).toBe('Feature ready')
  expect(loader).toHaveBeenCalledTimes(2)
  wrapper.unmount()
})

it('closes a pending dialog, restores focus and does not steal focus when its download finishes', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  const trigger = document.createElement('button')
  const other = document.createElement('button')
  document.body.append(trigger, other)
  trigger.focus()
  type TestModule = { default: Component }
  let finish!: (module: TestModule) => void
  const Module = lazyComponent(
    () =>
      new Promise<TestModule>((resolve) => {
        finish = resolve
      }),
    true
  )
  const visible = ref(true)
  const wrapper = mount(
    {
      components: { Module },
      setup: () => ({ visible }),
      template: '<Module :visible="visible" @close="visible = false" />'
    },
    { attachTo: document.body }
  )
  try {
    await vi.advanceTimersByTimeAsync(201)
    await flushPromises()
    document.querySelector<HTMLButtonElement>('[role="dialog"] button')!.click()
    await flushPromises()
    expect(document.activeElement).toBe(trigger)
    other.focus()
    finish({
      default: defineComponent({
        props: { visible: Boolean },
        template: '<p v-if="visible">Ready</p>'
      })
    })
    await flushPromises()
    expect(document.activeElement).toBe(other)
    expect(document.querySelector('[role="dialog"]')).toBeNull()
  } finally {
    wrapper.unmount()
    trigger.remove()
    other.remove()
  }
})
