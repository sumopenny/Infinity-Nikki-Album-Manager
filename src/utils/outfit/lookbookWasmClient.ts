import * as loader from '@assemblyscript/loader'
import wasmUrl from '../../assets/lookbook-parser.wasm?url'

interface LookbookWasmExports extends WebAssembly.Exports {
  __newString(value: string): number
  __getString(pointer: number): string
  decodeOutfitPayload(codePointer: number, payloadPointer: number): number
  decodeShareCodePathId(codePointer: number): number
}

export type LookbookWasmResult<T> =
  | { ok: true; value: T }
  | { ok: false; errorCode: string }

let exportsPromise: Promise<LookbookWasmExports> | null = null

async function getExports(): Promise<LookbookWasmExports> {
  if (!exportsPromise) {
    exportsPromise = fetch(wasmUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`WASM HTTP ${response.status}`)
        return response.arrayBuffer()
      })
      .then((bytes) => loader.instantiate(bytes, {}))
      .then((module) => module.exports as unknown as LookbookWasmExports)
      .catch((error: unknown) => {
        exportsPromise = null
        throw error
      })
  }
  return exportsPromise
}

/** 在浏览器 WASM 中归一化 API JSON 或原生解码器输出。 */
export async function decodeLookbookPayload<T>(
  code: string,
  payload: string
): Promise<LookbookWasmResult<T>> {
  const wasm = await getExports()
  const result = wasm.__getString(wasm.decodeOutfitPayload(
    wasm.__newString(code),
    wasm.__newString(payload)
  ))
  return JSON.parse(result) as LookbookWasmResult<T>
}

/** 使用 WASM 还原分享码对应的固定对象路径编号；不支持的格式返回 null。 */
export async function decodeLookbookShareCodePathId(code: string): Promise<string | null> {
  const wasm = await getExports()
  const pathId = wasm.__getString(wasm.decodeShareCodePathId(wasm.__newString(code)))
  return /^\d{18}$/.test(pathId) ? pathId : null
}
