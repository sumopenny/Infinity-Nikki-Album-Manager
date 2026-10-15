// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import OutfitEditor from '../../src/components/OutfitEditor.vue'
import { outfitMessages } from '../../src/i18n/messages/outfit'
import { snapshotImageFile } from '../../src/utils/image'

vi.mock('../../src/utils/image', () => ({
  snapshotImageFile: vi.fn(),
  imageDiagnosticError: vi.fn()
}))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('blocks saving until copying completes and discards results after close', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  )
  const create = vi.fn(() => 'blob:snapshot')
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() })
  let finish!: (file: File) => void
  vi.mocked(snapshotImageFile).mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      })
  )
  const wrapper = mount(OutfitEditor, {
    props: { visible: false, outfit: null, tags: [], busy: false, messages: outfitMessages.zh },
    global: { stubs: { teleport: true } }
  })
  await wrapper.setProps({ visible: true })
  const input = wrapper.get('input[type="file"]')
  const original = new File(['original'], 'photo.jpg', { type: 'image/jpeg' })
  Object.defineProperty(input.element, 'files', { value: [original], configurable: true })
  await input.trigger('change')
  expect(wrapper.get('button.primary').attributes('disabled')).toBeDefined()
  expect(create).not.toHaveBeenCalled()
  const copied = new File(['original'], 'photo.jpg', { type: 'image/jpeg' })
  finish(copied)
  await flushPromises()
  expect(create).toHaveBeenCalledWith(copied)
  await wrapper.get('button.primary').trigger('click')
  expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ imageFile: copied })
  await input.trigger('change')
  await wrapper.setProps({ visible: false })
  finish(copied)
  await flushPromises()
  expect(create).toHaveBeenCalledTimes(1)
  wrapper.unmount()
})

it('uses the original file directly on desktop without snapshot reading', async () => {
  vi.mocked(snapshotImageFile).mockClear()
  const create = vi.fn(() => 'blob:desktop')
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  )
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() })
  const wrapper = mount(OutfitEditor, {
    props: { visible: false, outfit: null, tags: [], busy: false, messages: outfitMessages.zh },
    global: { stubs: { teleport: true } }
  })
  await wrapper.setProps({ visible: true })
  const original = new File(['image'], 'photo.jpg', { type: 'image/jpeg' })
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [original] })
  await input.trigger('change')
  expect(snapshotImageFile).not.toHaveBeenCalled()
  expect(create).toHaveBeenCalledWith(original)
  expect(wrapper.get('button.primary').attributes('disabled')).toBeUndefined()
  await wrapper.get('button.primary').trigger('click')
  expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ imageFile: original })
  wrapper.unmount()
})

it('allows retry after failure and retains the last good image on failed replacement', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  )
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:good'), revokeObjectURL: vi.fn() })
  const wrapper = mount(OutfitEditor, {
    props: { visible: false, outfit: null, tags: [], busy: false, messages: outfitMessages.zh },
    global: { stubs: { teleport: true } }
  })
  await wrapper.setProps({ visible: true })
  const file = new File(['image'], 'same.jpg', { type: 'image/jpeg' })
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [file] })
  vi.mocked(snapshotImageFile).mockRejectedValueOnce(new Error('read failed'))
  await input.trigger('change')
  await flushPromises()
  expect(wrapper.get('button.primary').attributes('disabled')).toBeDefined()
  expect(wrapper.get('[role="status"]').text()).toContain('读取失败')
  vi.mocked(snapshotImageFile).mockResolvedValueOnce(file)
  await input.trigger('change')
  await flushPromises()
  expect(wrapper.get('img').attributes('src')).toBe('blob:good')
  vi.mocked(snapshotImageFile).mockRejectedValueOnce(new Error('replacement failed'))
  await input.trigger('change')
  await flushPromises()
  expect(wrapper.get('img').attributes('src')).toBe('blob:good')
  expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  expect(wrapper.get('button.primary').attributes('disabled')).toBeUndefined()
  await wrapper.get('button.primary').trigger('click')
  expect(wrapper.emitted('save')?.[0]?.[0]).toMatchObject({ imageFile: file })
  wrapper.unmount()
})

it('ignores an older read that fails after a newer selection succeeds', async () => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  )
  const create = vi.fn(() => 'blob:new')
  vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: vi.fn() })
  let failOld!: (reason: Error) => void
  vi.mocked(snapshotImageFile).mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        failOld = reject
      })
  )
  const newer = new File(['new'], 'new.jpg', { type: 'image/jpeg' })
  vi.mocked(snapshotImageFile).mockResolvedValueOnce(newer)
  const wrapper = mount(OutfitEditor, {
    props: { visible: false, outfit: null, tags: [], busy: false, messages: outfitMessages.zh },
    global: { stubs: { teleport: true } }
  })
  await wrapper.setProps({ visible: true })
  const input = wrapper.get('input[type="file"]')
  Object.defineProperty(input.element, 'files', { value: [newer], configurable: true })
  await input.trigger('change')
  await input.trigger('change')
  await flushPromises()
  failOld(new Error('old failure'))
  await flushPromises()
  expect(create).toHaveBeenCalledTimes(1)
  expect(wrapper.find('[role="status"]').exists()).toBe(false)
  expect(wrapper.get('button.primary').attributes('disabled')).toBeUndefined()
  wrapper.unmount()
})
