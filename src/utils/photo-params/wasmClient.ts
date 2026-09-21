import * as loader from '@assemblyscript/loader'
import wasmUrl from '../../assets/photo-params.wasm?url'

interface PhotoParamsExports extends WebAssembly.Exports {
  __newString(value: string): number
  __getString(pointer: number): string
  __newArray(id: number, values: ArrayLike<number>): number
  Uint8Array_ID: WebAssembly.Global
  decodePhoto(bytesPointer: number, uidPointer: number): number
  decodeCameraParams(rawPointer: number): number
  encodeCameraParams(modelPointer: number): number
}

export interface WasmResult<T> {
  ok: boolean
  errorCode?: string
  value?: T
}

let exportsPromise: Promise<PhotoParamsExports> | null = null

/** 延迟加载照片参数 WASM，并在当前页面生命周期内复用实例。 */
async function getExports(): Promise<PhotoParamsExports> {
  if (!exportsPromise) {
    exportsPromise = fetch(wasmUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`WASM HTTP ${response.status}`)
        return response.arrayBuffer()
      })
      .then((bytes) => loader.instantiate(bytes, {}))
      .then((module) => module.exports as unknown as PhotoParamsExports)
  }
  return exportsPromise
}

function parseResult<T>(text: string): WasmResult<T> {
  return JSON.parse(text) as WasmResult<T>
}

/** 调用 WASM 解码完整照片；TypeScript 只负责编组字节和解析结果 JSON。 */
export async function decodePhoto<T>(bytes: Uint8Array, uid: string): Promise<WasmResult<T>> {
  const wasm = await getExports()
  const bytesPointer = wasm.__newArray(Number(wasm.Uint8Array_ID.value), bytes)
  return parseResult<T>(wasm.__getString(wasm.decodePhoto(bytesPointer, wasm.__newString(uid))))
}

/** 调用 WASM 解码独立 CameraParams 密文。 */
export async function decodeCameraParams<T>(raw: string): Promise<WasmResult<T>> {
  const wasm = await getExports()
  return parseResult<T>(wasm.__getString(wasm.decodeCameraParams(wasm.__newString(raw))))
}

/** 调用 WASM 反向生成 CameraParams 密文。 */
export async function encodeCameraParams<T>(model: unknown): Promise<WasmResult<T>> {
  const wasm = await getExports()
  return parseResult<T>(wasm.__getString(wasm.encodeCameraParams(wasm.__newString(JSON.stringify(model)))))
}
