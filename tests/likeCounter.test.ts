// 点赞计数器组件测试：拉取展示、乐观更新与服务端对账、接口不可用时隐藏
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LikeCounter from '../src/components/LikeCounter.vue'

const messages = { like: '点赞', likeTooltip: '为网站点个赞' }

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body
  } as Response
}

describe('LikeCounter', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('挂载后拉取并展示当前点赞数', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ count: 42 }))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(LikeCounter, { props: { messages } })
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/like', expect.objectContaining({ headers: expect.any(Object) }))
    expect(wrapper.text()).toContain('42')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('点击后乐观 +1 并以服务端返回为准', async () => {
    let resolvePost: ((response: Response) => void) | undefined
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => jsonResponse({ count: 10 }))
      .mockImplementationOnce(async () => new Promise<Response>((resolve) => { resolvePost = resolve }))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(LikeCounter, { props: { messages } })
    await flushPromises()
    expect(wrapper.text()).toContain('10')

    await wrapper.find('button').trigger('click')
    // POST 尚未返回：先看到乐观更新的 +1
    expect(wrapper.text()).toContain('11')

    resolvePost?.(jsonResponse({ count: 13 }))
    await flushPromises()
    // 服务端对账后为准（多人同时点赞时服务端总数可能更高）
    expect(wrapper.text()).toContain('13')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenLastCalledWith('/api/like', expect.objectContaining({ method: 'POST' }))
  })

  it('POST 失败时回退乐观更新', async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce(async () => jsonResponse({ count: 5 }))
      .mockImplementationOnce(async () => jsonResponse({}, false))
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(LikeCounter, { props: { messages } })
    await flushPromises()

    await wrapper.find('button').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('5')
  })

  it('接口不可用时隐藏计数器而不是报错', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down')
    })
    vi.stubGlobal('fetch', fetchMock)

    const wrapper = mount(LikeCounter, { props: { messages } })
    await flushPromises()
    expect(wrapper.find('button').exists()).toBe(false)
  })
})
