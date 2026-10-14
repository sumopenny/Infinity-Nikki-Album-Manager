import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error Node 构建脚本保持原生 ESM，不参与前端 TypeScript 编译。
import { fetchJson, buildGalleryPoseEntries, GALLERY_IMAGE_TEMPLATE, mergePoseCatalog } from '../../scripts/update-nikkigallery-poses.mjs'

describe('NikkiGallery pose updater', () => {
  it('normalizes numeric and string IDs into runtime entries', () => {
    expect(buildGalleryPoseEntries([
      { gid: 1090012163, posename: '锋芒入定', filename: 'T_Icon_S0304_Suit_01.png' },
      { gid: '13400200020', posename: '来击掌吧_发起', filename: 'T_Icon_Performance_002_Host.png' }
    ])).toEqual([
      { key: '1090012163', aliases: ['1090012163'], zh: '锋芒入定', en: '锋芒入定', image: 'T_Icon_S0304_Suit_01.png' },
      { key: '13400200020', aliases: ['13400200020'], zh: '来击掌吧_发起', en: '来击掌吧_发起', image: 'T_Icon_Performance_002_Host.png' }
    ])
  })

  it('rejects duplicate IDs and unsafe image paths', () => {
    expect(() => buildGalleryPoseEntries([
      { gid: 1, posename: '动作一', filename: 'one.png' },
      { gid: '1', posename: '动作二', filename: 'two.png' }
    ])).toThrow('动作 ID 重复')
    expect(() => buildGalleryPoseEntries([
      { gid: 2, posename: '动作', filename: '../pose.png' }
    ])).toThrow('动作记录无效')
  })

  it('replaces only pose-owned catalog fields', () => {
    const catalog = {
      schemaVersion: 2,
      source: { database: 'db', language: { zh: 'zh', en: 'en' }, pose: 'old' },
      templates: { light: { baseUrl: 'light/{}', replace: '{}' }, pose: null },
      resources: { light: [{ key: 'light' }], pose: [{ key: 'old' }] }
    }
    const poses = [{ key: '1', aliases: ['1'], zh: '动作', en: '动作', image: 'pose.png' }]
    const result = mergePoseCatalog(catalog, { version: '3.0.0', poses })
    expect(result.source).toEqual({ database: 'db', language: { zh: 'zh', en: 'en' }, pose: '3.0.0' })
    expect(result.templates.light).toEqual(catalog.templates.light)
    expect(result.templates.pose).toEqual(GALLERY_IMAGE_TEMPLATE)
    expect(result.resources.light).toEqual(catalog.resources.light)
    expect(result.resources.pose).toEqual(poses)
  })
})

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
it('keeps timeout active while response headers arrive but the body stalls', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async (_url, init) => ({ ok: true, json: () => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('body aborted')), { once: true })
  }) })))
  const result = fetchJson('https://example.test/poses', 5)
  const rejected = expect(result).rejects.toThrow('body aborted')
  await vi.advanceTimersByTimeAsync(6)
  await rejected
  expect(vi.getTimerCount()).toBe(0)
})
it('clears the timeout after successful JSON and parse errors', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) }).mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('bad json') } }))
  expect(await fetchJson('https://example.test', 5)).toEqual({ ok: true })
  await expect(fetchJson('https://example.test', 5)).rejects.toThrow('bad json')
  expect(vi.getTimerCount()).toBe(0)
})
