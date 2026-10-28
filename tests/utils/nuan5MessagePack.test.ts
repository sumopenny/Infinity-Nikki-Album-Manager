import { describe, expect, it } from 'vitest'
// @ts-expect-error Node 构建脚本保持原生 ESM，不参与前端 TypeScript 编译。
import { decodeMessagePack } from '../../scripts/generate-nuan5-resource-catalog.mjs'

function extension(marker: number, payload: Buffer): Buffer {
  const width = marker === 0xc7 ? 1 : marker === 0xc8 ? 2 : 4
  const length = Buffer.alloc(width)
  length.writeUIntBE(payload.length, 0, width)
  return Buffer.concat([Buffer.from([marker]), length, Buffer.from([1]), payload])
}

describe('MessagePack variable-length extensions', () => {
  for (const marker of [0xc7, 0xc8, 0xc9]) {
    it.each([0, 1, 2, 256].filter((length) => marker !== 0xc7 || length < 256))(
      `reads the full 0x${marker.toString(16)} payload of length %i and the next value`,
      (length) => {
        const payload = Buffer.alloc(length, 0xbb)
        const input = Buffer.concat([
          Buffer.from([0x92]),
          extension(marker, payload),
          Buffer.from([5])
        ])
        expect(decodeMessagePack(input)).toEqual([payload, 5])
      }
    )

    it(`rejects truncated 0x${marker.toString(16)} payloads`, () => {
      const complete = extension(marker, Buffer.from([0xaa, 0xbb]))
      expect(() => decodeMessagePack(complete.subarray(0, -1))).toThrow('字段截断')
    })
  }
})
