import { createCipheriv, createHash } from 'node:crypto'
// WASM 协议边界测试：验证 CameraParams V1 编解码和展示字段换算，不包含真实照片或用户数据。
import { readFile } from 'node:fs/promises'
import * as loader from '@assemblyscript/loader'
import { beforeAll, describe, expect, it } from 'vitest'

let wasm: Record<string, any>

beforeAll(async () => {
  const module = await loader.instantiate(await readFile('src/assets/photo-params.wasm'), {})
  wasm = module.exports as Record<string, any>
})

function call(name: 'decodeCameraParams' | 'encodeCameraParams', value: string) {
  return JSON.parse(wasm.__getString(wasm[name](wasm.__newString(value))))
}

describe('photo parameter wasm', () => {
  it('encodes and decodes a 31-value camera parameter array', () => {
    const raw = [
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      2,
      3,
      0,
      0,
      0,
      55,
      2,
      0,
      'DirectionLight_B',
      0.81,
      0.28,
      1.6,
      0.12,
      0.81,
      -0.07,
      1.21,
      -0.3,
      0.1,
      0.09,
      0,
      'Fresh_003',
      0.4
    ]
    const encoded = call('encodeCameraParams', JSON.stringify({ rawArray: raw }))
    expect(encoded.ok).toBe(true)

    const decoded = call('decodeCameraParams', encoded.value)
    expect(decoded.ok).toBe(true)
    expect(decoded.value).toMatchObject({
      version: 'v1',
      arrayLength: 31,
      focalLength: 55,
      aperture: 2,
      apertureValue: 'f/1.4',
      lightId: 'DirectionLight_B',
      lightStrength: 0.81,
      filterId: 'Fresh_003',
      filterStrength: 0.4,
      bloomIntensity: 0.2,
      vibrance: 0.2
    })
    expect(decoded.value.rawArray).toEqual(raw)
  })

  it('rejects non-base64 camera parameters', () => {
    expect(call('decodeCameraParams', 'not camera params')).toEqual({
      ok: false,
      errorCode: 'camera_base64_invalid'
    })
  })

  it('supports the 40-value Momo layout and reverse conversions', () => {
    const raw = [
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      1,
      2,
      3,
      0,
      0,
      0,
      55,
      2,
      0,
      'None',
      0,
      0,
      0,
      0,
      0.3,
      0,
      0.55,
      0,
      0,
      0,
      0,
      'None',
      0,
      1,
      123,
      0.1,
      0.2,
      0.3,
      0.5,
      1,
      0,
      1
    ]
    const model = {
      rawArray: raw,
      brightness: 0.5,
      contrast: 0.25,
      vibrance: 0.4,
      momo: { poseId: 456, horizontal: 80, distance: 120, height: 40, rotation: 90 }
    }
    const encoded = call('encodeCameraParams', JSON.stringify(model))
    const decoded = call('decodeCameraParams', encoded.value)
    expect(decoded.value).toMatchObject({
      version: 'v2',
      arrayLength: 40,
      vibrance: 0.4,
      momo: { enabled: false, poseId: 456, horizontal: 80, distance: 120, height: 40, rotation: 90 }
    })
    expect(decoded.value.brightness).toBeCloseTo(0.5)
    expect(decoded.value.contrast).toBeCloseTo(0.25)
  })

  it('validates IdMap, AdaptiveArray and OptionMap shapes in AssemblyScript', () => {
    const valid = '{"idMap":[:1:{"value":2},"x":[1,2]],"adaptive":{"single":1},"option":{}}'
    expect(wasm.validateNuan5Json(wasm.__newString(valid))).toBe(1)
    expect(wasm.validateNuan5Json(wasm.__newString('{"broken":[:1]}'))).toBe(0)
  })
})

// 构造游戏尾部加密格式，直接验证实际 WASM，而不是模拟解码返回值。
function decodeSyntheticPhoto(info: Record<string, unknown>, uid = '123456', decodeUid = uid) {
  const raw = [
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    2,
    3,
    0,
    0,
    0,
    55,
    2,
    0,
    'None',
    0,
    0,
    0,
    0,
    0.3,
    0,
    0.55,
    0,
    0,
    0,
    0,
    'None',
    0
  ]
  const camera = call('encodeCameraParams', JSON.stringify({ rawArray: raw })).value
  const text = JSON.stringify({
    decoy: { nikkiClothes: [999], nikkiDIY: [] },
    SocialPhoto: { CameraParams: camera, PhotoInfo: info }
  })
  const bytes = Buffer.from(text)
  const padded = Buffer.alloc(Math.ceil((bytes.length + 1) / 16) * 16)
  bytes.copy(padded)
  const key = Buffer.concat([
    createHash('sha1').update(Buffer.from(uid, 'utf16le')).digest(),
    Buffer.from('_PAPER_GAMES')
  ])
  const cipher = createCipheriv('aes-256-ecb', key, null)
  cipher.setAutoPadding(false)
  const encoded = Buffer.concat([cipher.update(padded), cipher.final()]).toString('base64')
  const photo = Buffer.concat([
    Buffer.from([255, 216, 255, 217]),
    Buffer.from(encoded),
    Buffer.from([255, 217])
  ])
  const pointer = wasm.__newArray(Number(wasm.Uint8Array_ID.value), photo)
  return JSON.parse(wasm.__getString(wasm.decodePhoto(pointer, wasm.__newString(decodeUid))))
}

describe('photo dressing in encrypted originals', () => {
  it('associates colors with worn IDs and preserves complete DIY data', () => {
    const diy = [
      {
        TargetClothID: 1020100001,
        TargetGroupID: 2,
        FeatureTag: 6,
        CoreData: {
          TargetColor0: { R: 1, G: 0, B: 0, A: 1 },
          ColorGridID0: 8,
          TargetColor1: { R: 0, G: 0.5, B: 1, A: 1 },
          ColorGridID1: 9,
          RoughnessOffset: 0.4,
          HairColorMode: 2
        }
      },
      {
        TargetClothID: 1020100001,
        TargetGroupID: 3,
        FeatureTag: 10,
        CoreData: { ReplaceTextureID: 42, TilingData: 0.5 }
      }
    ]
    const result = decodeSyntheticPhoto({ nikkiClothes: [1020100001], nikkiDIY: diy, poseId: 55 })
    expect(result.ok).toBe(true)
    expect(result.value.photo.poseId).toBe(55)
    expect(result.value.camera.focalLength).toBe(55)
    expect(result.value.outfit.wearingClothes.map((item: any) => item.itemId)).toEqual([1020100001])
    expect(result.value.outfit.dyeItems[0].dyes).toMatchObject([
      { targetGroupId: 2, color: '#ff0000', paletteId: 1, slot: 8 },
      { targetGroupId: 2, color: '#00bcff', paletteId: 2, slot: 1 }
    ])
    expect(result.value.rawOutfit.nikkiDIY).toEqual(diy)
  })

  it('supports singleton DIY and leaves undyed worn parts available', () => {
    const dye = {
      TargetClothID: 1020200001,
      TargetGroupID: 1,
      FeatureTag: 1,
      CoreData: { R: 0.5, G: 0.5, B: 0.5, A: 1, ColorGridID: -1 }
    }
    const result = decodeSyntheticPhoto({ nikkiClothes: [1020200001, 1020300001], nikkiDIY: dye })
    expect(result.value.outfit.wearingClothes).toHaveLength(2)
    expect(result.value.outfit.dyeItems[0].dyes[0].color).toBe('#bcbcbc')
    expect(result.value.rawOutfit.nikkiDIY).toEqual(dye)
  })

  it('keeps camera parsing valid without dressing and rejects a wrong UID', () => {
    const result = decodeSyntheticPhoto({ poseId: 1 })
    expect(result.ok).toBe(true)
    expect(result.value.outfit).toBeNull()
    expect(result.value.rawOutfit).toBeNull()
    expect(decodeSyntheticPhoto({}, '123456', '654321')).toMatchObject({
      ok: false,
      errorCode: 'photo_structure_invalid'
    })
    expect(
      decodeSyntheticPhoto({ nikkiClothes: [], nikkiDIY: {} }).value.outfit.wearingClothes
    ).toEqual([])
  })
})
