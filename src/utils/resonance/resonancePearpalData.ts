// 奇想手账响应解码：上游返回 snappy 压缩体，解压后是 JSON 文本。
import { uncompress } from 'snappyjs'

export function decodePearpal(buffer: ArrayBuffer): unknown {
  const decoded = uncompress(new Uint8Array(buffer))
  return JSON.parse(new TextDecoder().decode(decoded)) as unknown
}
