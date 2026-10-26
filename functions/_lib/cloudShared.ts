import { bytesToHex } from '@noble/hashes/utils.js'
export interface Statement {
  bind(...values: unknown[]): Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}
export interface CloudDB {
  prepare(sql: string): Statement
  batch<T = Record<string, unknown>>(statements: Statement[]): Promise<{ results: T[] }[]>
}
export interface CloudEnv {
  RESONANCE_DB?: CloudDB
}
const COOKIE = 'resonance_session'
const enc = new TextEncoder()
export const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
}
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message)
  }
}
export function fail(status: number, code: string): never {
  throw new ApiError(status, code)
}
export const json = (value: unknown, cookie?: string) =>
  Response.json(value, { headers: { ...headers, ...(cookie ? { 'Set-Cookie': cookie } : {}) } })
/** 只对高熵会话令牌、请求摘要做 SHA-256；密码使用 Argon2id。 */
export async function digest(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value))))
}
/** Cookie 续期不保存密码；服务端会话无固定到期日，退出时撤销。 */
export function cookieFor(request: Request, token: string, clear = false) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 34560000}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`
}
export function getToken(request: Request) {
  return request.headers
    .get('Cookie')
    ?.match(/(?:^|;\s*)resonance_session=([a-f0-9]{64})(?:;|$)/)?.[1]
}
/** 跨请求共享 D1 限流；先限流再执行昂贵的密码哈希。 */
export async function limit(db: CloudDB, key: string, max: number) {
  const now = Date.now()
  const row = await db
    .prepare(
      'INSERT INTO cloud_rate_limits(key,count,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN resets_at<=? THEN 1 ELSE count+1 END,resets_at=CASE WHEN resets_at<=? THEN excluded.resets_at ELSE resets_at END RETURNING count'
    )
    .bind(key, now + 900000, now, now)
    .first<{ count: number }>()
  if (!row || row.count > max) fail(429, 'RATE_LIMIT')
}
/** 流式限制实际请求字节，不能仅信任 Content-Length。 */
export async function readBody(
  request: Request,
  maximum: number
): Promise<Record<string, unknown>> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json'))
    fail(415, 'INVALID_DATA')
  const reader = request.body?.getReader()
  if (!reader) fail(400, 'INVALID_DATA')
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maximum) {
      await reader.cancel()
      fail(413, 'TOO_LARGE')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes))
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'INVALID_DATA')
    return body
  } catch {
    return fail(400, 'INVALID_DATA')
  }
}
/** 只接受本站 JSON 写请求，同时校验浏览器 Origin 与 Fetch Metadata。 */
export function checkOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  if (
    (origin && origin !== new URL(request.url).origin) ||
    request.headers.get('Sec-Fetch-Site') === 'cross-site'
  )
    fail(403, 'FORBIDDEN')
  if (request.method !== 'GET' && request.headers.get('X-Resonance-Request') !== '1')
    fail(403, 'FORBIDDEN')
}

/** 会话归属始终来自服务端，账号头仅用于阻止旧页面误操作。 */
export async function readCloudSession<T extends { id: string }>(db: CloudDB, request: Request) {
  const token = getToken(request)
  const sessionHash = token ? await digest(token) : ''
  const user = token
    ? await db
        .prepare(
          'SELECT u.* FROM cloud_users u JOIN cloud_sessions s ON s.user_id=u.id WHERE s.token_hash=?'
        )
        .bind(sessionHash)
        .first<T>()
    : null
  return { token, sessionHash, user }
}
export function requireCloudAccount(
  request: Request,
  user: { id: string } | null
): asserts user is { id: string } {
  if (!user) fail(401, 'LOGIN_REQUIRED')
  if (request.headers.get('X-Resonance-Account') !== user.id) fail(409, 'ACCOUNT_CHANGED')
}
