import { describe, expect, it } from 'vitest'
// @ts-expect-error Node 构建脚本保持原生 ESM，不参与前端 TypeScript 编译。
import { buildGalleryPoseEntries, GALLERY_IMAGE_TEMPLATE, mergePoseCatalog } from '../../scripts/update-nikkigallery-poses.mjs'

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
