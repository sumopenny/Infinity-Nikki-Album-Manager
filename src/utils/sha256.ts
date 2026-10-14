import { sha256 } from '@noble/hashes/sha2.js'

/** 统一计算 SHA-256；局域网 HTTP 缺少 subtle 时使用兼容实现，保持备份校验格式不变。 */
export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  const hash = subtle
    ? new Uint8Array(await subtle.digest('SHA-256', bytes))
    : sha256(new Uint8Array(bytes))
  return Array.from(hash, (value) => value.toString(16).padStart(2, '0')).join('')
}
