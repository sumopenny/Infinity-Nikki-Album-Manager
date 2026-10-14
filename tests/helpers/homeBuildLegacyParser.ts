import { readFile } from 'node:fs/promises'
import * as loader from '@assemblyscript/loader'
import type {
  HomeBuildRoute,
  HomeBuildWasmResult
} from '../../src/utils/homeBuild/homeBuildWasmClient'

interface HomeBuildSummary extends HomeBuildRoute {
  name: string
  coverImage: string | null
  mapId: number
  lastModifyTime: number
  uid: number
  gameArea: string
  templateType: 0 | 1
  templateName: 'island' | 'group'
  furnitureCount: number
  version: string | null
}

interface LegacyExports extends loader.ASUtil {
  parseHomeBuildDecodedJson(codePointer: number, payloadPointer: number): number
}

let modulePromise: ReturnType<typeof loader.instantiate> | undefined

/** 仅在测试中验证旧 JSON 协议，生产入口只保留实际使用的二进制解码。 */
export async function parseHomeBuildDecodedJson(
  code: string,
  payload: string
): Promise<HomeBuildWasmResult<HomeBuildSummary>> {
  modulePromise ??= readFile('src/assets/home-build-parser.wasm').then((bytes) =>
    loader.instantiate(bytes, {})
  )
  const wasm = (await modulePromise).exports as unknown as LegacyExports
  const codePointer = wasm.__pin(wasm.__newString(code))
  try {
    const result = wasm.parseHomeBuildDecodedJson(codePointer, wasm.__newString(payload))
    return JSON.parse(wasm.__getString(result)) as HomeBuildWasmResult<HomeBuildSummary>
  } finally {
    wasm.__unpin(codePointer)
  }
}
