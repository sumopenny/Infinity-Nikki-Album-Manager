import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import {
  decodeHomeBuildShareCode,
  parseHomeBuildDecodedJson,
  parseHomeBuildResponse
} from '../../src/utils/homeBuild/homeBuildWasmClient'

const wasmBytes = readFileSync(resolve(process.cwd(), 'src/assets/home-build-parser.wasm'))

beforeAll(async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(wasmBytes)))
  await decodeHomeBuildShareCode('1UDB66QH')
  vi.unstubAllGlobals()
})

describe('HomeBuild WASM', () => {
  it.each([
    ['1UDB66QH', 49, 'UDB66QH'],
    ['17TLJ1EW', 49, '7TLJ1EW']
  ])('routes %s to server %i and object key %s', async (code, serverId, resourceKey) => {
    const result = await decodeHomeBuildShareCode(code)
    expect(result).toEqual({
      ok: true,
      value: {
        code,
        serverMarker: '1',
        serverId,
        resourceKey,
        requestPath: `/default/${resourceKey}`
      }
    })
  })

  it('normalizes the decoded combination plan and counts placements', async () => {
    const payload = JSON.stringify({
      Name: '一帘幽梦',
      CoverImage: 'https://example.test/cover.jpg',
      MapID: 8000001,
      LastModifyTime: 0,
      Uid: 103001591,
      GameArea: '1',
      TemplateType: 1,
      PlaceInfo: [{ ItemID: 1170000431 }, { ItemID: 1170000432 }],
      ExtraInfo: { Content: { version: '2.9.1', extras: [] } }
    })
    const result = await parseHomeBuildDecodedJson('1UDB66QH', payload)
    expect(result).toMatchObject({
      ok: true,
      value: {
        name: '一帘幽梦',
        templateType: 1,
        templateName: 'group',
        furnitureCount: 2,
        version: '2.9.1'
      }
    })
  })

  it('rejects malformed codes and payloads', async () => {
    await expect(decodeHomeBuildShareCode('UDB66QH')).resolves.toEqual({
      ok: false,
      errorCode: 'share_code_invalid'
    })
    await expect(parseHomeBuildDecodedJson('1UDB66QH', '{bad json')).resolves.toEqual({
      ok: false,
      errorCode: 'decoded_payload_invalid'
    })
  })

  it('rejects a response without the recovered binary envelope header', async () => {
    await expect(parseHomeBuildResponse(new Uint8Array([1, 2, 3]))).resolves.toEqual({
      ok: false,
      errorCode: 'wire_header_invalid'
    })
  })
})
