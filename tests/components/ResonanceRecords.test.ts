import * as resonanceImport from '../../src/utils/resonance/resonanceImport'
import * as resonanceStorage from '../../src/utils/resonance/resonanceStorage'
import 'fake-indexeddb/auto'
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ResonanceRecords from '../../src/components/ResonanceRecords.vue'
import { loadResonanceRecords, saveResonanceRecords } from '../../src/utils/resonance/resonanceStorage'
import type { ResonanceRecord } from '../../src/utils/resonance/resonanceTypes'
import { encodeSnappyLiteral } from '../utils/resonanceSnappyFixture'

const dbName = 'infinity-nikki-album-manager'
const HAIR = '1020100347'
const wrappers: Array<ReturnType<typeof mount>> = []
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo')
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn(function (this: HTMLElement, options: ScrollToOptions) {
    this.scrollTop = options.top ?? 0
  }) })
})
const savedRecord: ResonanceRecord = {
  id: '77:10347', bannerId: '77', bannerName: { zh: '示例阁', en: 'Sample Banner' }, bannerStartAt: '2026-01-01T00:00:00.000Z',
  outfitId: '10347', outfitName: { zh: '示例套装', en: 'Sample Outfit' }, rarity: 5, outfitImageUrl: '/outfit.png',
  sets: [
    { setNumber: 1, totalPulls: 19, parts: [{ id: HAIR, name: { zh: '部件名', en: 'Piece' }, imageUrl: '/hair.png', pullNumber: 19 }] },
    { setNumber: 2, totalPulls: 0, parts: [{ id: HAIR, name: { zh: '部件名', en: 'Piece' }, imageUrl: '/hair.png', pullNumber: 0 }] }
  ]
}

afterEach(async () => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo)
  else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(dbName)
    request.onsuccess = request.onerror = request.onblocked = () => resolve()
  })
})

async function openDialog(language: 'zh' | 'en' = 'zh') {
  const wrapper = mount(ResonanceRecords, { props: { language } })
  wrappers.push(wrapper)
  await flushPromises()
  await wrapper.find('.resonance-actions .primary-button').trigger('click')
  await flushPromises()
  return { wrapper, panel: document.body.querySelector('.resonance-import-panel') as HTMLElement }
}

function latestNotice(wrapper: ReturnType<typeof mount>) {
  const events = wrapper.emitted('notice') ?? []
  return events[events.length - 1]?.[0] as { message: string; tone: string; source: string } | undefined
}

function mockPearpal(snapshot: unknown, uid = '123456') {
  const compressed = encodeSnappyLiteral(JSON.stringify(snapshot))
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const action = new URL(String(input), 'https://local.test').searchParams.get('action')
    if (action === 'verify') {
      return Response.json({ code: 0, data: { role: { uid, zone_id: 1 } } }, { headers: { 'cache-control': 'no-store' } })
    }
    return new Response(compressed.buffer as ArrayBuffer, { headers: { 'cache-control': 'no-store', 'content-type': 'application/octet-stream' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function pasteCredentials(panel: HTMLElement) {
  const textarea = panel.querySelector('textarea') as HTMLTextAreaElement
  textarea.value = '{"roleid":"123456","token":"tok","id":"openid"}'
  textarea.dispatchEvent(new Event('input', { bubbles: true }))
  await flushPromises()
}

describe('ResonanceRecords', () => {
  it('shares loaded records with the sidebar and gives each card a jump target', async () => {
    await saveResonanceRecords([savedRecord])
    const wrapper = mount(ResonanceRecords, { props: { language: 'zh' } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.findAll('.resonance-record')).toHaveLength(1))

    expect(wrapper.emitted('recordsChange')?.[0]?.[0]).toEqual([savedRecord])
    expect(wrapper.find('.resonance-record').attributes('id')).toBe('resonance-record-77:10347')
    expect(wrapper.find('.resonance-part img').attributes('src')).toBe(`https://cdn.gongeo.us/images/items/icons/${HAIR}.png`)
  })

  it('uses silver for missing parts and banner parity for obtained parts', async () => {
    const obtained = savedRecord.sets[0].parts[0]!
    const manual = { ...obtained, id: 'manual', name: { zh: '手动部件', en: 'Manual piece' }, pullNumber: 0, manual: true }
    const missing = { ...obtained, id: 'missing', name: { zh: '未获得部件', en: 'Missing piece' }, pullNumber: 0 }
    const odd: ResonanceRecord = { ...savedRecord, sets: [{ ...savedRecord.sets[0], parts: [obtained, manual, missing] }, savedRecord.sets[1]] }
    const even: ResonanceRecord = { ...odd, id: '76:10347', bannerId: '76' }
    await saveResonanceRecords([odd, even])
    const wrapper = mount(ResonanceRecords, { props: { language: 'zh' } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.findAll('.resonance-record')).toHaveLength(2))

    const partClasses = (recordId: string, name: string) => wrapper.findAll('.resonance-record')
      .find((card) => card.attributes('id') === `resonance-record-${recordId}`)!
      .findAll('.resonance-part')
      .find((part) => part.find('img').attributes('alt') === name)!
      .classes()

    expect(partClasses('77:10347', '部件名')).not.toContain('is-even-banner')
    expect(partClasses('77:10347', '手动部件')).not.toContain('is-missing')
    expect(partClasses('77:10347', '未获得部件')).toContain('is-missing')
    expect(partClasses('76:10347', '部件名')).toContain('is-even-banner')
    expect(partClasses('76:10347', '未获得部件')).toContain('is-missing')
  })

  it('displays latest owned pieces first for each set', async () => {
    const part = (id: string, pullNumber: number, acquisitionOrder?: number) => ({
      id, name: { zh: id, en: id }, imageUrl: `/${id}.png`, pullNumber, acquisitionOrder
    })
    const record: ResonanceRecord = { ...savedRecord, sets: [
      { setNumber: 1, totalPulls: 12, parts: [part('missing', 0), part('later', 5, 3), part('earlier', 7, 1)] },
      { setNumber: 2, totalPulls: 8, parts: [part('missing', 0), part('second-later', 3, 4), part('second-earlier', 5, 2)] }
    ] }
    await saveResonanceRecords([record])
    const wrapper = mount(ResonanceRecords, { props: { language: 'zh' } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.findAll('.resonance-part')).toHaveLength(3))
    const displayedIds = () => wrapper.findAll('.resonance-part img').map((image) => image.attributes('alt'))
    expect(displayedIds()).toEqual(['later', 'earlier', 'missing'])
    await wrapper.find('.resonance-second-set').trigger('click')
    expect(displayedIds()).toEqual(['second-later', 'second-earlier', 'missing'])
  })

  it('reverses banner order in the cards while keeping the same-banner outfit order', async () => {
    const older = { ...savedRecord, id: '76:10347', bannerId: '76' }
    const sameBanner = { ...savedRecord, id: '77:10348', outfitId: '10348' }
    await saveResonanceRecords([older, sameBanner, savedRecord])
    const wrapper = mount(ResonanceRecords, { props: { language: 'zh', bannerOrder: 'newest' } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.findAll('.resonance-record')).toHaveLength(3))

    const cardIds = () => wrapper.findAll('.resonance-record').map((card) => card.attributes('id'))
    const newestOrder = cardIds()
    expect(newestOrder.slice(0, 2).sort()).toEqual(['resonance-record-77:10347', 'resonance-record-77:10348'])
    expect(newestOrder[2]).toBe('resonance-record-76:10347')

    await wrapper.setProps({ bannerOrder: 'oldest' })
    expect(cardIds()).toEqual(['resonance-record-76:10347', ...newestOrder.slice(0, 2)])
  })

  it('filters cards by rarity without changing the saved records', async () => {
    const fourStar: ResonanceRecord = { ...savedRecord, id: '76:10343', bannerId: '76', outfitId: '10343', rarity: 4 }
    await saveResonanceRecords([fourStar, savedRecord])
    const wrapper = mount(ResonanceRecords, { props: { language: 'zh', rarityFilter: 5 } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.findAll('.resonance-record')).toHaveLength(1))
    expect(wrapper.find('.resonance-record').attributes('id')).toBe('resonance-record-77:10347')
    await wrapper.setProps({ rarityFilter: 4 })
    expect(wrapper.find('.resonance-record').attributes('id')).toBe('resonance-record-76:10343')
    await wrapper.setProps({ rarityFilter: 'all' })
    expect(wrapper.findAll('.resonance-record')).toHaveLength(2)
    expect(await loadResonanceRecords()).toEqual([fourStar, savedRecord])
  })

  it('disables export when no resonance records exist', async () => {
    const wrapper = mount(ResonanceRecords, { props: { language: 'zh' } })
    wrappers.push(wrapper)
    await flushPromises()

    const exportButton = wrapper.findAll('.resonance-actions button')
      .find(button => button.text().includes('导出数据'))!
    expect(exportButton.attributes('disabled')).toBeDefined()
  })

  it('opens Pearpal flow and offers file import in the same dialog', async () => {
    const { panel } = await openDialog()
    const links = [...panel.querySelectorAll('a')].map((link) => link.getAttribute('href'))

    expect(panel.textContent).toContain('添加共鸣数据')
    expect(links).toContain('https://myl.nuanpaper.com/home')
    expect(panel.textContent).toContain('获取登录凭据的方法来自暖暖共鸣录')
    expect(panel.querySelector('.resonance-source-attribution strong')?.textContent).toBe('方法来源')
    expect(panel.querySelector('.resonance-region-chip')).toBeNull()
    expect(panel.textContent).not.toContain('国服')
    expect(panel.querySelectorAll('.resonance-choice')).toHaveLength(4)
    expect(panel.querySelector('input[type="file"]')).toBeNull()
    expect(panel.textContent).toContain('从文件导入')
    expect(panel.textContent).not.toContain('从游戏导入')
    expect(panel.textContent).not.toContain('手动输入')
  })

  it('previews a JSON file and saves it only after confirmation', async () => {
    const oldRecord = { ...savedRecord, id: '76:10347', bannerId: '76' }
    await saveResonanceRecords([oldRecord, savedRecord])
    const { wrapper, panel } = await openDialog()
    const methods = panel.querySelectorAll<HTMLButtonElement>('.resonance-choice-row:first-child button')
    const body = panel.querySelector<HTMLElement>('.resonance-import-body')!
    Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 900 })
    methods[1]!.click()
    await flushPromises()
    const input = panel.querySelector<HTMLInputElement>('input[type="file"]')!
    Object.defineProperty(input, 'files', { configurable: true, value: [{
      name: 'resonance.json', text: async () => JSON.stringify({ 77: [['2026-01-01', HAIR]] })
    }] })
    input.dispatchEvent(new Event('change', { bubbles: true }))
    await flushPromises()
    panel.querySelector<HTMLButtonElement>('.resonance-import-footer .primary-button')!.click()
    await flushPromises()
    expect(panel.textContent).toContain('导入预览 (1)')
    expect(body.scrollTop).toBe(900)
    expect(body.scrollTo).toHaveBeenCalledWith({ top: 900, behavior: 'smooth' })
    expect(panel.querySelectorAll('.resonance-import-footer button')).toHaveLength(1)
    expect(panel.textContent).toContain('替换全部本地共鸣记录')
    expect(await loadResonanceRecords()).toEqual([oldRecord, savedRecord])
    panel.querySelector<HTMLButtonElement>('.resonance-import-footer .primary-button')!.click()
    await flushPromises()
    expect((await loadResonanceRecords()).map((record) => record.id)).toEqual(['77:10347'])
    expect(latestNotice(wrapper)?.tone).toBe('success')
  })

  it('fills the credential fields from pasted bookmark or console output', async () => {
    const { wrapper, panel } = await openDialog()
    await pasteCredentials(panel)
    const values = [...panel.querySelectorAll('.resonance-form input')].map((input) => (input as HTMLInputElement).value)
    expect(values).toEqual(['123456', 'tok', 'openid'])
    expect(latestNotice(wrapper)).toMatchObject({ message: '数据粘贴成功！', tone: 'success', source: 'resonance' })
  })

  it('renders stored bilingual names and keeps the summary while viewing set two', async () => {
    await saveResonanceRecords([savedRecord])
    const wrapper = mount(ResonanceRecords, { props: { language: 'en' } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.findAll('.resonance-record')).toHaveLength(1))

    const loaded = (await loadResonanceRecords())[0]!
    expect(wrapper.find('.resonance-record h3').text()).toContain(loaded.outfitName.en)
    const summary = wrapper.find('.resonance-record-heading p').text()
    expect(summary).toContain('Total pulls: 19')
    expect(summary).toContain('Average pulls: 19.0')
    expect(wrapper.find('.resonance-second-set').text()).toBe('View second set pulls')

    await wrapper.find('.resonance-second-set').trigger('click')
    expect(wrapper.find('.resonance-record-heading p').text()).toBe(summary)
    expect(wrapper.find('.resonance-second-set').text()).toBe('View first set pulls')
  })

  it('sums both sets and shows their obtained-piece average with one decimal place', async () => {
    const record = {
      ...savedRecord,
      sets: [
        {
          ...savedRecord.sets[0],
          parts: [
            ...savedRecord.sets[0].parts,
            { id: '1020500347', name: { zh: '部件二', en: 'Second piece' }, imageUrl: '/second.png', pullNumber: 18 }
          ]
        },
        { ...savedRecord.sets[1], parts: [{ ...savedRecord.sets[1].parts[0]!, pullNumber: 21 }] }
      ] as ResonanceRecord['sets']
    }
    await saveResonanceRecords([record])
    const wrapper = mount(ResonanceRecords, { props: { language: 'zh' } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.findAll('.resonance-record')).toHaveLength(1))
    expect(wrapper.find('.resonance-record-heading p').text()).toContain('总抽数：58')
    expect(wrapper.find('.resonance-record-heading p').text()).toContain('平均抽数：19.3')
  })

  it('checks the UID before reading the notebook and keeps local records on mismatch', async () => {
    await saveResonanceRecords([savedRecord])
    const wrapper = mount(ResonanceRecords, { props: { language: 'zh' } })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.find('.resonance-actions .primary-button').trigger('click')
    await flushPromises()
    const panel = document.body.querySelector('.resonance-import-panel') as HTMLElement
    await pasteCredentials(panel)
    const fetchMock = mockPearpal({ info_from_self: { gacha_list: [] } }, '999999')

    ;(panel.querySelector('.resonance-import-footer button') as HTMLButtonElement).click()
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(latestNotice(wrapper)?.message).toContain('UID 与输入的 UID 不一致')
    expect(await loadResonanceRecords()).toHaveLength(1)
    expect(panel.querySelector('.resonance-preview')).toBeNull()
  })

  it('previews a Pearpal snapshot and replaces all local pools after confirmation', async () => {
    const localOnly: ResonanceRecord = {
      ...savedRecord,
      id: 'local-only:outfit', bannerId: 'local-only', outfitId: 'outfit-local',
      bannerName: { zh: '本地阁', en: 'Local Banner' }, outfitName: { zh: '本地套装', en: 'Local Outfit' }
    }
    await saveResonanceRecords([localOnly])
    const wrapper = mount(ResonanceRecords, { props: { language: 'zh' } })
    wrappers.push(wrapper)
    await flushPromises()
    await wrapper.find('.resonance-actions .primary-button').trigger('click')
    await flushPromises()
    const panel = document.body.querySelector('.resonance-import-panel') as HTMLElement
    await pasteCredentials(panel)
    const fetchMock = mockPearpal({
      info_from_self: { gacha_list: [
        { card_pool_id: 77, pool_cnt: 1, result: HAIR, rarity: 5, times_from_last_five_stars: 16 },
        { card_pool_id: 77, pool_cnt: 99, result: '9999999999', rarity: 4, times_from_last_four_stars: 0 }
      ] }
    })

    ;(panel.querySelector('.resonance-import-footer button') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(panel.querySelector('.resonance-preview')).not.toBeNull())
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(panel.textContent).toContain('套装总抽数')
    expect(panel.querySelector('.resonance-preview tbody')?.textContent).toContain('17')
    expect(panel.textContent).not.toContain('第二套')

    // 整批替换以本次预览为准，其他窗口在预览期间新增的阁也不保留。
    const latestOnly = { ...localOnly, id: 'latest-only:outfit', bannerId: 'latest-only' }
    await saveResonanceRecords([latestOnly])
    ;(panel.querySelector('.resonance-import-footer button:last-child') as HTMLButtonElement).click()
    await vi.waitFor(async () => expect(await loadResonanceRecords()).toHaveLength(1))
    const stored = await loadResonanceRecords()
    expect(stored.map((record) => record.id)).toEqual(['77:10347'])
    expect(stored.some(record => record.id === localOnly.id)).toBe(false)
    expect(stored.find((record) => record.id === '77:10347')?.sets[0].totalPulls).toBe(17)
    expect(wrapper.find('.resonance-record-heading p').text()).toContain('总抽数：17')
    expect(document.body.querySelector('.resonance-import-panel')).toBeNull()
    expect(latestNotice(wrapper)?.tone).toBe('success')
  })

  it('closes a preview without writing to IndexedDB', async () => {
    await saveResonanceRecords([savedRecord])
    const { panel } = await openDialog()
    await pasteCredentials(panel)
    mockPearpal({ info_from_self: { gacha_list: [{ card_pool_id: 77, pool_cnt: 1, result: HAIR, rarity: 5, times_from_last_five_stars: 16 }] } })
    ;(panel.querySelector('.resonance-import-footer button') as HTMLButtonElement).click()
    await vi.waitFor(() => expect(panel.querySelector('.resonance-preview')).not.toBeNull())
    expect(panel.querySelectorAll('.resonance-import-footer button')).toHaveLength(1)
    ;(panel.querySelector('.resonance-import-header button') as HTMLButtonElement).click()
    await flushPromises()
    expect(document.body.querySelector('.resonance-import-panel')).toBeNull()
    expect((await loadResonanceRecords())[0]?.sets[0].totalPulls).toBe(19)
  })

  it('clears the current records only after confirmation', async () => {
    await saveResonanceRecords([savedRecord])
    const wrapper = mount(ResonanceRecords, { props: { language: 'zh' } })
    wrappers.push(wrapper)
    await vi.waitFor(() => expect(wrapper.findAll('.resonance-record')).toHaveLength(1))

    await wrapper.findAll('.resonance-actions button').find(button => button.text().includes('清空'))!.trigger('click')
    await flushPromises()
    expect(document.body.querySelector('.confirm-dialog')?.textContent).toContain('无法撤销')
    ;(document.body.querySelector('.confirm-dialog-button.primary') as HTMLButtonElement).click()
    await vi.waitFor(async () => expect(await loadResonanceRecords()).toEqual([]))
    expect(wrapper.emitted('recordsChange')?.at(-1)?.[0]).toEqual([])
    expect(latestNotice(wrapper)).toMatchObject({ message: '本地共鸣记录已清空，云端存档保留。', tone: 'success', source: 'resonance' })
  })
})

it.each([[false, false], [true, false], [false, true], [true, true]])('scrolls a successful Cookie preview on compact=%s reducedMotion=%s', async (compact, reducedMotion) => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('prefers-reduced-motion') ? reducedMotion : compact, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
  vi.spyOn(resonanceImport, 'importFromPearpal').mockResolvedValueOnce({ records: [savedRecord], skippedPools: 0 })
  const { panel } = await openDialog()
  const body = panel.querySelector<HTMLElement>('.resonance-import-body')!
  Object.defineProperty(body, 'scrollHeight', { configurable: true, value: 1200 })
  await pasteCredentials(panel)
  panel.querySelector<HTMLButtonElement>('.resonance-import-footer .primary-button')!.click()
  await vi.waitFor(() => expect(body.scrollTop).toBe(1200))
  expect(body.scrollTo).toHaveBeenCalledWith({ top: 1200, behavior: reducedMotion ? 'instant' : 'smooth' })
  expect(panel.querySelector('.resonance-preview')).not.toBeNull()
  expect(panel.querySelector('.resonance-import-footer')?.textContent).toContain('确认导入')
  expect(await loadResonanceRecords()).toEqual([])
})

it.each([false, true])('handles partial replacement with save failure=%s', async failSaving => {
  const oldRecord = { ...savedRecord, id: '76:10347', bannerId: '76' }
  await saveResonanceRecords([oldRecord])
  vi.spyOn(resonanceImport, 'importFromPearpal').mockResolvedValueOnce({ records: [savedRecord], skippedPools: 1 })
  const { wrapper, panel } = await openDialog()
  await pasteCredentials(panel)
  panel.querySelector<HTMLButtonElement>('.resonance-import-footer .primary-button')!.click()
  await vi.waitFor(() => expect(panel.querySelector('.resonance-preview')).not.toBeNull())
  expect(panel.textContent).toContain('旧记录也将被删除')
  if (failSaving) vi.spyOn(resonanceStorage, 'saveResonanceRecords').mockRejectedValueOnce(new Error('save failed'))
  panel.querySelector<HTMLButtonElement>('.resonance-import-footer .primary-button')!.click()
  await flushPromises()
  expect(await loadResonanceRecords()).toEqual(failSaving ? [oldRecord] : [savedRecord])
  if (failSaving) {
    expect(document.body.querySelector('.resonance-preview')).not.toBeNull()
    expect(wrapper.emitted('recordsChange')?.at(-1)?.[0]).toEqual([oldRecord])
    expect(latestNotice(wrapper)?.tone).toBe('error')
  } else {
    expect(document.body.querySelector('.resonance-import-panel')).toBeNull()
    expect(latestNotice(wrapper)?.tone).toBe('warning')
  }
})

it('blocks import after a storage read failure without overwriting existing records', async () => {
  await saveResonanceRecords([savedRecord])
  vi.spyOn(resonanceStorage, 'loadResonanceRecords').mockRejectedValueOnce(new Error('read failed'))
  const save = vi.spyOn(resonanceStorage, 'saveResonanceRecords')
  const { wrapper, panel } = await openDialog()
  panel.querySelectorAll<HTMLButtonElement>('.resonance-choice-row:first-child button')[1]!.click()
  await flushPromises()
  const input = panel.querySelector<HTMLInputElement>('input[type="file"]')!
  Object.defineProperty(input, 'files', { configurable: true, value: [{
    name: 'resonance.json', text: async () => JSON.stringify({ 77: [['2026-01-01', HAIR]] })
  }] })
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await flushPromises()
  panel.querySelector<HTMLButtonElement>('.resonance-import-footer .primary-button')!.click()
  await flushPromises()
  panel.querySelector<HTMLButtonElement>('.resonance-import-footer .primary-button')!.click()
  await flushPromises()
  expect(save).not.toHaveBeenCalled()
  expect(latestNotice(wrapper)).toMatchObject({ tone: 'error', message: expect.stringContaining('读取失败') })
  expect(await loadResonanceRecords()).toEqual([savedRecord])
})

it.each(['zh', 'en'] as const)('shows actionable credential guidance instead of OK in %s', async language => {
  await saveResonanceRecords([savedRecord])
  const { wrapper, panel } = await openDialog(language)
  const body = panel.querySelector<HTMLElement>('.resonance-import-body')!
  body.scrollTop = 37
  await pasteCredentials(panel)
  vi.stubGlobal('fetch', vi.fn<typeof fetch>(async () => Response.json(
    { code: 0, info: 'OK' }, { headers: { 'cache-control': 'no-store' } }
  )))
  panel.querySelector<HTMLButtonElement>('.resonance-import-footer .primary-button')!.click()
  await vi.waitFor(() => expect(latestNotice(wrapper)?.tone).toBe('error'))
  expect(latestNotice(wrapper)?.message).toContain(language === 'zh' ? '请重新登录美鸭梨并获取新凭据' : 'Sign in to Pear-Pal again and get fresh credentials')
  expect(latestNotice(wrapper)?.message).toContain(language === 'zh' ? '无痕窗口' : 'private browser window')
  expect(panel.querySelector('.resonance-preview')).toBeNull()
  expect(body.scrollTop).toBe(37)
  expect(await loadResonanceRecords()).toEqual([savedRecord])
})

it.each(['close', 'method', 'credentials', 'unmount'])('discards a late Pearpal preview after %s', async action => {
  let finish!: (value: { records: ResonanceRecord[]; skippedPools: number }) => void
  const pending = vi.spyOn(resonanceImport, 'importFromPearpal').mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  const { wrapper, panel } = await openDialog()
  await pasteCredentials(panel)
  panel.querySelector<HTMLButtonElement>('.resonance-import-footer button')!.click()
  await vi.waitFor(() => expect(pending).toHaveBeenCalled())
  const signal = pending.mock.calls[0]![2]!
  if (action === 'close') panel.querySelector<HTMLButtonElement>('.resonance-import-header button')!.click()
  if (action === 'method') panel.querySelectorAll<HTMLButtonElement>('.resonance-choice-row:first-child button')[1]!.click()
  if (action === 'credentials') {
    const input = panel.querySelector<HTMLInputElement>('.resonance-form input')!
    input.value = 'different'; input.dispatchEvent(new Event('input', { bubbles: true }))
  }
  if (action === 'unmount') wrapper.unmount()
  await flushPromises()
  expect(signal.aborted).toBe(true)
  const notices = wrapper.emitted('notice')?.length ?? 0
  finish({ records: [savedRecord], skippedPools: 0 }); await flushPromises()
  expect(document.body.querySelector('.resonance-preview')).toBeNull()
  expect(wrapper.emitted('notice')?.length ?? 0).toBe(notices)
})

it('does not let an old file preview overwrite a newer selection', async () => {
  const { panel } = await openDialog()
  panel.querySelectorAll<HTMLButtonElement>('.resonance-choice-row:first-child button')[1]!.click()
  await flushPromises()
  const input = panel.querySelector<HTMLInputElement>('input[type="file"]')!
  let finish!: (value: string) => void
  Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'old.json', text: () => new Promise<string>(resolve => { finish = resolve }) }] })
  input.dispatchEvent(new Event('change', { bubbles: true })); await flushPromises()
  panel.querySelector<HTMLButtonElement>('.resonance-import-footer .primary-button')!.click(); await flushPromises()
  Object.defineProperty(input, 'files', { configurable: true, value: [{ name: 'new.json', text: async () => '{}' }] })
  input.dispatchEvent(new Event('change', { bubbles: true })); await flushPromises()
  finish(JSON.stringify({ 77: [['2026-01-01', HAIR]] })); await flushPromises()
  expect(panel.querySelector('.resonance-preview')).toBeNull()
  expect(panel.textContent).toContain('new.json')
})
