import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import LazyPhotoImage from '../../src/components/LazyPhotoImage.vue'
import type { PhotoDisplayItem } from '../../src/utils/photoGrouping'

it('reloads a refreshed database image with the same ID and ignores the previous asynchronous result', async () => {
  const first = { id: 'same', name: 'same.webp', url: null } as PhotoDisplayItem
  const second = { ...first }
  const completions: Array<(url: string) => void> = []
  const loadPhoto = vi.fn(() => new Promise<string>(resolve => completions.push(resolve)))
  const wrapper = mount(LazyPhotoImage, { props: { photo: first, loadPhoto, failureText: 'failed' } })
  try {
    await wrapper.setProps({ photo: second })
    completions[0]('blob:stale')
    await flushPromises()
    expect(wrapper.find('img').exists()).toBe(false)
    completions[1]('blob:current')
    await flushPromises()
    expect(wrapper.get('img').attributes('src')).toBe('blob:current')
  } finally { wrapper.unmount() }
})
