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
    const raw = [1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 0, 0, 0, 55, 2, 0, 'DirectionLight_B', 0.81, 0.28, 1.6, 0.12, 0.81, -0.07, 1.21, -0.3, 0.1, 0.09, 0, 'Fresh_003', 0.4]
    const encoded = call('encodeCameraParams', JSON.stringify({ rawArray: raw }))
    expect(encoded.ok).toBe(true)

    const decoded = call('decodeCameraParams', encoded.value)
    expect(decoded.ok).toBe(true)
    expect(decoded.value).toMatchObject({ version: 'v1', arrayLength: 31, focalLength: 55, aperture: 2, apertureValue: 'f/1.4', lightId: 'DirectionLight_B', lightStrength: 0.81, filterId: 'Fresh_003', filterStrength: 0.4, bloomIntensity: 0.2, vibrance: 0.2 })
    expect(decoded.value.rawArray).toEqual(raw)
  })

  it('rejects non-base64 camera parameters', () => {
    expect(call('decodeCameraParams', 'not camera params')).toEqual({ ok: false, errorCode: 'camera_base64_invalid' })
  })

  it('supports the 40-value Momo layout and reverse conversions', () => {
    const raw = [1, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 0, 0, 0, 55, 2, 0, 'None', 0, 0, 0, 0, 0.3, 0, 0.55, 0, 0, 0, 0, 'None', 0, 1, 123, 0.1, 0.2, 0.3, 0.5, 1, 0, 1]
    const model = { rawArray: raw, brightness: 0.5, contrast: 0.25, vibrance: 0.4, momo: { poseId: 456, horizontal: 80, distance: 120, height: 40, rotation: 90 } }
    const encoded = call('encodeCameraParams', JSON.stringify(model))
    const decoded = call('decodeCameraParams', encoded.value)
    expect(decoded.value).toMatchObject({ version: 'v2', arrayLength: 40, vibrance: 0.4, momo: { enabled: false, poseId: 456, horizontal: 80, distance: 120, height: 40, rotation: 90 } })
    expect(decoded.value.brightness).toBeCloseTo(0.5)
    expect(decoded.value.contrast).toBeCloseTo(0.25)
  })

  it('validates IdMap, AdaptiveArray and OptionMap shapes in AssemblyScript', () => {
    const valid = '{"idMap":[:1:{"value":2},"x":[1,2]],"adaptive":{"single":1},"option":{}}'
    expect(wasm.validateNuan5Json(wasm.__newString(valid))).toBe(1)
    expect(wasm.validateNuan5Json(wasm.__newString('{"broken":[:1]}'))).toBe(0)
  })
})
