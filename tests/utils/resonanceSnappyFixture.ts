export function encodeSnappyLiteral(value: string): Uint8Array {
  const data = new TextEncoder().encode(value)
  const bytes: number[] = []
  let size = data.length
  while (size >= 0x80) {
    bytes.push((size & 0x7f) | 0x80)
    size >>>= 7
  }
  bytes.push(size)

  const encodedLength = data.length - 1
  if (data.length <= 60) {
    bytes.push(encodedLength << 2)
  } else {
    let lengthBytes = 1
    while (encodedLength >= 2 ** (lengthBytes * 8)) lengthBytes += 1
    bytes.push((59 + lengthBytes) << 2)
    for (let index = 0; index < lengthBytes; index += 1) bytes.push((encodedLength >>> (index * 8)) & 0xff)
  }
  bytes.push(...data)
  return Uint8Array.from(bytes)
}
