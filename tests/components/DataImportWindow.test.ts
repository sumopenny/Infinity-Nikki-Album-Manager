import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import DataImportWindow from '../../src/components/DataImportWindow.vue'
import { clearAllBrowserData } from '../../src/utils/file-system/database'
import { loadWardrobe } from '../../src/utils/wardrobe/wardrobeStorage'
import { loadResonanceRecords } from '../../src/utils/resonance/resonanceStorage'

let wrapper: VueWrapper
beforeEach(async () => {
  await clearAllBrowserData()
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener() {},
    removeEventListener() {}
  }))
  wrapper = mount(DataImportWindow, { props: { visible: true }, attachTo: document.body })
})
afterEach(() => {
  wrapper.unmount()
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})
const submit = () =>
  document.querySelector<HTMLButtonElement>('.resonance-import-footer .primary-button')!
async function preview(raw: unknown) {
  document
    .querySelectorAll<HTMLButtonElement>('.resonance-choice-row:first-child button')[1]!
    .click()
  await flushPromises()
  const input = document.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', {
    value: [{ name: 'sample.json', size: 100, text: async () => JSON.stringify(raw) }]
  })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises()
  submit().click()
  await vi.waitFor(() => expect(document.querySelector('.data-import-targets')).not.toBeNull())
  return [...document.querySelectorAll<HTMLInputElement>('.data-import-targets input')]
}
const raw = {
  info_from_self: {
    suit_list: ['10347'],
    gacha_list: [
      {
        card_pool_id: 77,
        pool_cnt: 1,
        result: '1020100347',
        rarity: 5,
        times_from_last_five_stars: 16
      }
    ]
  }
}

it('defaults both options on, blocks empty selection and imports only the chosen module', async () => {
  const choices = await preview(raw)
  expect(choices.map((input) => [input.checked, input.disabled])).toEqual([
    [true, false],
    [true, false]
  ])
  choices.forEach((input) => input.click())
  await flushPromises()
  expect(submit().disabled).toBe(true)
  choices[1]!.click()
  await flushPromises()
  expect(submit().disabled).toBe(false)
  submit().click()
  await vi.waitFor(() => expect(wrapper.emitted('imported')).toHaveLength(1))
  expect(await loadResonanceRecords()).toEqual([])
  expect(Object.keys((await loadWardrobe()).entries)).toHaveLength(10)
})
it('disables unavailable wardrobe data in resonance-only files', async () => {
  const choices = await preview({ 77: [['2026-01-01', '1020100347']] })
  expect(choices.map((input) => [input.checked, input.disabled])).toEqual([
    [true, false],
    [false, true]
  ])
  expect(document.body.textContent).toContain('数据不包含衣橱清单')
})
it('resets selection to both enabled after reopening and previewing again', async () => {
  const choices = await preview(raw)
  choices[0]!.click()
  await wrapper.setProps({ visible: false })
  await wrapper.setProps({ visible: true })
  expect((await preview(raw)).every((input) => input.checked)).toBe(true)
})
