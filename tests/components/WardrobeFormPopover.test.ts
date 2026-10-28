import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import WardrobeFormPopover from '../../src/components/WardrobeFormPopover.vue'
import { emptyWardrobe } from '../../src/utils/wardrobe/wardrobeSchema'
import type { WardrobeEntry } from '../../src/utils/wardrobe/wardrobeCatalog'

enableAutoUnmount(afterEach)
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  }))
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
const entry: WardrobeEntry = {
  id: '1',
  kind: 'outfit',
  name: { zh: '形态', en: 'Form' },
  quality: 5,
  variant: 0,
  category: 0,
  familyRootId: null,
  style: null,
  labels: [],
  obtainType: null,
  version: null,
  sourceDetails: [],
  image: '',
  parts: []
}
const create = () =>
  mount(WardrobeFormPopover, {
    props: { entry, catalog: null, snapshot: emptyWardrobe(), language: 'zh' },
    global: { stubs: { WardrobeFormNav: true } }
  })

it('does not register global handlers for closed cards and releases them on close', async () => {
  const windowAdd = vi.spyOn(window, 'addEventListener')
  const windowRemove = vi.spyOn(window, 'removeEventListener')
  const documentAdd = vi.spyOn(document, 'addEventListener')
  const documentRemove = vi.spyOn(document, 'removeEventListener')
  const cards = Array.from({ length: 48 }, create)
  const viewportCalls = () =>
    windowAdd.mock.calls.filter(([type]) => type === 'scroll' || type === 'resize')
  const documentCalls = () =>
    documentAdd.mock.calls.filter(([type]) => type === 'pointerdown' || type === 'keydown')
  expect(viewportCalls()).toHaveLength(0)
  expect(documentCalls()).toHaveLength(0)
  await cards[0].get('button').trigger('click')
  await flushPromises()
  expect(viewportCalls()).toHaveLength(2)
  expect(documentCalls()).toHaveLength(2)
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
  await flushPromises()
  expect(cards[0].get('button').attributes('aria-expanded')).toBe('false')
  for (const args of viewportCalls()) expect(windowRemove).toHaveBeenCalledWith(...args)
  for (const args of documentCalls()) expect(documentRemove).toHaveBeenCalledWith(...args)
})

it('releases active handlers when a card unmounts', async () => {
  const removeWindow = vi.spyOn(window, 'removeEventListener')
  const removeDocument = vi.spyOn(document, 'removeEventListener')
  const wrapper = create()
  await wrapper.get('button').trigger('click')
  wrapper.unmount()
  expect(removeWindow).toHaveBeenCalledWith('scroll', expect.any(Function), true)
  expect(removeWindow).toHaveBeenCalledWith('resize', expect.any(Function))
  expect(removeDocument).toHaveBeenCalledWith('pointerdown', expect.any(Function))
  expect(removeDocument).toHaveBeenCalledWith('keydown', expect.any(Function), true)
})
