import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  OutfitCodeParseError,
  normalizeLookbookCode,
  parseOutfitCode
} from '../../src/utils/outfit/outfitCodeParser'

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('normalizeLookbookCode', () => {
  it('为 11 位编码补 # 结尾', () => {
    expect(normalizeLookbookCode('a1B2c3D4e5F')).toBe('a1B2c3D4e5F#')
  })

  it('保留已带 # 的合法编码', () => {
    expect(normalizeLookbookCode('a1B2c3D4e5F#')).toBe('a1B2c3D4e5F#')
  })

  it('支持从分享链接中提取 code 参数', () => {
    expect(normalizeLookbookCode('https://example.com/lookbook?code=a1B2c3D4e5F#')).toBe('a1B2c3D4e5F#')
    expect(normalizeLookbookCode('https://example.com/lookbook?code=a1B2c3D4e5F')).toBe('a1B2c3D4e5F#')
  })

  it('拒绝非法输入', () => {
    expect(normalizeLookbookCode('')).toBe('')
    expect(normalizeLookbookCode('abc')).toBe('')
    expect(normalizeLookbookCode('a1B2c3D4e5F!')).toBe('')
    expect(normalizeLookbookCode(null)).toBe('')
  })
})

describe('parseOutfitCode', () => {
  it('清洗部件列表并解析染色数据', async () => {
    const payload = {
      clothes: [
        { cloth: { id: 1020100001, outfit: 1001, cloth_type: 1 } },
        { cloth: { id: 1020100002, cloth_type: 86 } },
        { cloth: { id: 1021860042, cloth_type: 2 } },
        {
          cloth: { id: 1020100003, cloth_type: 3 },
          diy: {
            outfit_dye: [
              { General: { target_group_id: 1, feature_tag: 1, color: { rgba: [1, 0, 0, 1], color_grid: 9 } } },
              { Hair: { target_group_id: 2, feature_tag: 3, color_0: { rgba: [0.5, 0.5, 0.5, 1], color_grid: -1 } } }
            ]
          }
        }
      ]
    }
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)

    const result = await parseOutfitCode('a1B2c3D4e5F')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(String(fetchMock.mock.calls[0][0])).toContain(encodeURIComponent('a1B2c3D4e5F#'))
    expect(result.code).toBe('a1B2c3D4e5F#')
    expect(result.wearingClothes).toEqual([1020100001, 1020100003])
    expect(result.dyeItems).toHaveLength(1)
    const [dyeItem] = result.dyeItems
    expect(dyeItem.itemId).toBe(1020100003)
    expect(dyeItem.dyes).toEqual([
      { targetGroupId: 1, featureTag: 1, paletteId: 2, slot: 1, color: '#ff0000' },
      { targetGroupId: 2, featureTag: 3, paletteId: -1, slot: null, color: '#bcbcbc' }
    ])
  })

  it('格式非法时不请求接口并标记 invalid', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(parseOutfitCode('bad')).rejects.toMatchObject({ kind: 'invalid' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['404', new Response('not found', { status: 404 })],
    ['400', new Response('bad request', { status: 400 })],
    ['502 上游未找到', new Response('Upstream API error: 404', { status: 502 })]
  ])('上游 %s 响应视为搭配码无效', async (_label, response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
    await expect(parseOutfitCode('a1B2c3D4e5F')).rejects.toMatchObject({ kind: 'invalid' })
  })

  it('上游其他错误标记 unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })))
    await expect(parseOutfitCode('a1B2c3D4e5F')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('网络异常标记 unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(parseOutfitCode('a1B2c3D4e5F')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('响应缺少 clothes 字段标记 unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({})))
    await expect(parseOutfitCode('a1B2c3D4e5F')).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('抛出的错误类型为 OutfitCodeParseError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 500 })))
    await expect(parseOutfitCode('a1B2c3D4e5F')).rejects.toBeInstanceOf(OutfitCodeParseError)
  })
})
