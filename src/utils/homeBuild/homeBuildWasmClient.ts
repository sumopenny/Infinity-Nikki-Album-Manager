import * as loader from '@assemblyscript/loader'
import wasmUrl from '../../assets/home-build-parser.wasm?url'

interface HomeBuildWasmExports extends WebAssembly.Exports {
  __newString(value: string): number
  __getString(pointer: number): string
  __newArray(id: number, values: ArrayLike<number>): number
  Uint8Array_ID: WebAssembly.Global
  decodeHomeBuildShareCode(codePointer: number): number
  parseHomeBuildDecodedJson(codePointer: number, payloadPointer: number): number
  parseHomeBuildResponse(payloadPointer: number): number
}

export type HomeBuildWasmResult<T> =
  | { ok: true; value: T }
  | { ok: false; errorCode: string }

export interface HomeBuildRoute {
  code: string
  serverMarker: string
  serverId: number
  resourceKey: string
  requestPath: string
}

export interface HomeBuildSummary extends HomeBuildRoute {
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

export interface HomeBuildWireData {
  Name: string
  CoverImage: string
  MapID: number
  LastModifyTime: number
  Uid: number
  GameArea: string
  TemplateType: 0 | 1
  PlaceInfo: Array<Record<string, unknown>>
  ExtraInfoRaw: string
  Rid: null
  version: string | null
}

let exportsPromise: Promise<HomeBuildWasmExports> | null = null

async function getExports(): Promise<HomeBuildWasmExports> {
  if (!exportsPromise) {
    exportsPromise = fetch(wasmUrl)
      .then((response) => {
        if (!response.ok) throw new Error(`WASM HTTP ${response.status}`)
        return response.arrayBuffer()
      })
      .then((bytes) => loader.instantiate(bytes, {}))
      .then((module) => module.exports as unknown as HomeBuildWasmExports)
      .catch((error: unknown) => {
        exportsPromise = null
        throw error
      })
  }
  return exportsPromise
}

function parseResult<T>(text: string): HomeBuildWasmResult<T> {
  return JSON.parse(text) as HomeBuildWasmResult<T>
}

/** Resolve the server marker and object key without fetching or decoding the object. */
export async function decodeHomeBuildShareCode(
  code: string
): Promise<HomeBuildWasmResult<HomeBuildRoute>> {
  const wasm = await getExports()
  const result = wasm.__getString(wasm.decodeHomeBuildShareCode(wasm.__newString(code)))
  return parseResult<HomeBuildRoute>(result)
}

/** Parse the Nuan5 JSON produced by the native HomeBuild decoder. */
export async function parseHomeBuildDecodedJson(
  code: string,
  payload: string
): Promise<HomeBuildWasmResult<HomeBuildSummary>> {
  const wasm = await getExports()
  const result = wasm.__getString(wasm.parseHomeBuildDecodedJson(
    wasm.__newString(code),
    wasm.__newString(payload)
  ))
  return parseResult<HomeBuildSummary>(result)
}

/** Decode a captured HomeBuild CDN response without the native DLL. */
export async function parseHomeBuildResponse(
  payload: Uint8Array
): Promise<HomeBuildWasmResult<HomeBuildWireData>> {
  const wasm = await getExports()
  const bytesPointer = wasm.__newArray(Number(wasm.Uint8Array_ID.value), payload)
  const result = wasm.__getString(wasm.parseHomeBuildResponse(bytesPointer))
  return parseResult<HomeBuildWireData>(result)
}
