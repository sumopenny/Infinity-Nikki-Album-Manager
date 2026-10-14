import { argon2idAsync } from '@noble/hashes/argon2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { MAX_CLOUD_BYTES, validateCloudRecords } from '../../src/utils/resonance/cloudSchema'

export interface Statement {
  bind(...values: unknown[]): Statement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}
export interface CloudDB { prepare(sql: string): Statement; batch<T = Record<string, unknown>>(statements: Statement[]): Promise<{ results: T[] }[]> }
export interface CloudEnv { RESONANCE_DB?: CloudDB }
interface User { id: string; username: string; password_hash: string; active_snapshot: string | null; revision: number; updated_at: number }
const COOKIE = 'resonance_session'
const enc = new TextEncoder()
const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'" }
const opts = { m: 19456, t: 2, p: 1, dkLen: 32, maxmem: 32 * 1024 * 1024 }
class ApiError extends Error { constructor(public status: number, message: string) { super(message) } }
function fail(status: number, code: string): never { throw new ApiError(status, code) }
const json = (value: unknown, cookie?: string) => Response.json(value, { headers: { ...headers, ...(cookie ? { 'Set-Cookie': cookie } : {}) } })
const publicUser = (user: User) => ({ id: user.id, username: user.username })
const random = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
/** 只对高熵会话令牌、请求摘要做 SHA-256；密码使用 Argon2id。 */
export async function digest(value: string) { return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(value)))) }
/** 固定版本和成本参数，随机盐随哈希保存，便于后续迁移。 */
export async function hashPassword(password: string, salt = random().slice(0, 32)) {
  const hash = await argon2idAsync(password, hexToBytes(salt), opts)
  return `argon2id-v1$${salt}$${bytesToHex(hash)}`
}
/** 等长逐字节比较；不存在的用户也执行同样成本的密码计算。 */
export async function verifyPassword(password: string, stored: string) {
  const [, salt, expected] = stored.split('$')
  const actual = (await hashPassword(password, salt || '0'.repeat(32))).split('$')[2]
  let diff = actual.length ^ (expected?.length ?? 0)
  for (let i = 0; i < actual.length; i++) diff |= actual.charCodeAt(i) ^ (expected?.charCodeAt(i) || 0)
  return diff === 0 && stored.startsWith('argon2id-v1$')
}
/** Cookie 续期不保存密码；服务端会话无固定到期日，退出时撤销。 */
function cookieFor(request: Request, token: string, clear = false) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 34560000}${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}`
}
function getToken(request: Request) { return request.headers.get('Cookie')?.match(/(?:^|;\s*)resonance_session=([a-f0-9]{64})(?:;|$)/)?.[1] }
/** 跨请求共享 D1 限流；先限流再执行昂贵的密码哈希。 */
async function limit(db: CloudDB, key: string, max: number) {
  const now = Date.now()
  const row = await db.prepare('INSERT INTO cloud_rate_limits(key,count,resets_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN resets_at<=? THEN 1 ELSE count+1 END,resets_at=CASE WHEN resets_at<=? THEN excluded.resets_at ELSE resets_at END RETURNING count').bind(key, now + 900000, now, now).first<{count:number}>()
  if (!row || row.count > max) fail(429, 'RATE_LIMIT')
}
/** 流式限制实际请求字节，不能仅信任 Content-Length。 */
async function readBody(request: Request, maximum: number): Promise<Record<string, unknown>> {
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) fail(415, 'INVALID_DATA')
  const reader = request.body?.getReader()
  if (!reader) fail(400, 'INVALID_DATA')
  const chunks: Uint8Array[] = []; let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maximum) { await reader.cancel(); fail(413, 'TOO_LARGE') }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes))
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'INVALID_DATA')
    return body
  } catch { return fail(400, 'INVALID_DATA') }
}
/** 只接受本站 JSON 写请求，同时校验浏览器 Origin 与 Fetch Metadata。 */
function checkOrigin(request: Request) {
  const origin = request.headers.get('Origin')
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') fail(403, 'FORBIDDEN')
  if (request.method !== 'GET' && request.headers.get('X-Resonance-Request') !== '1') fail(403, 'FORBIDDEN')
}
/** 只回收已提交且不再活跃的记录；保留小型请求回执与其他设备的暂存版本。 */
async function cleanupRecords(db: CloudDB, userId: string) {
  await db.prepare('DELETE FROM cloud_records WHERE user_id=? AND snapshot_id IN (SELECT id FROM cloud_snapshots WHERE user_id=? AND committed_revision IS NOT NULL AND id IS NOT (SELECT active_snapshot FROM cloud_users WHERE id=?))').bind(userId, userId, userId).run()
}
/** 版本化整批覆盖：暂存各行后 CAS 切换指针，失败或中断不影响当前存档。 */
async function replace(db: CloudDB, user: User, body: Record<string, unknown>, deleting: boolean) {
  const id = body.requestId
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || !Number.isSafeInteger(body.revision) || Number(body.revision) < 0) fail(400, 'INVALID_DATA')
  const records = deleting ? [] : body.records
  if (!deleting) validateCloudRecords(records)
  const rows = records as { id: string }[]
  const fingerprint = await digest(JSON.stringify({ revision: body.revision, records: rows, deleting }))
  const previous = await db.prepare('SELECT digest,committed_revision FROM cloud_snapshots WHERE user_id=? AND id=?').bind(user.id, id).first<{digest:string;committed_revision:number|null}>()
  if (previous && previous.digest !== fingerprint) fail(409, 'CONFLICT')
  if (previous?.committed_revision != null) {
    await cleanupRecords(db, user.id)
    return { revision: previous.committed_revision, replayed: true }
  }
  if (user.revision !== body.revision) fail(409, 'CONFLICT')
  const now = Date.now()
  // 清理一天前的中断上传与三十天前的重试回执；当前存档永不被清理。
  await db.prepare('DELETE FROM cloud_snapshots WHERE user_id=? AND id IS NOT (SELECT active_snapshot FROM cloud_users WHERE id=?) AND ((committed_revision IS NULL AND created_at<?) OR created_at<?)').bind(user.id, user.id, now - 86400000, now - 30 * 86400000).run()
  await db.prepare('INSERT INTO cloud_snapshots(user_id,id,digest,count,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM cloud_snapshots WHERE user_id=? AND committed_revision IS NULL)<2 ON CONFLICT(user_id,id) DO NOTHING').bind(user.id, id, fingerprint, rows.length, now, user.id).run()
  const claimed = await db.prepare('SELECT digest FROM cloud_snapshots WHERE user_id=? AND id=?').bind(user.id, id).first<{digest:string}>()
  if (!claimed) fail(429, 'UPLOAD_PENDING')
  if (claimed?.digest !== fingerprint) fail(409, 'CONFLICT')
  // 每段 JSON 小于 D1 参数上限，整次请求最多约 40 条 SQL，兼容免费 D1 查询次数。
  const chunks: string[] = []; let chunk: string[] = []; let bytes = 2
  for (const row of rows) {
    const serialized = JSON.stringify(row); const length = enc.encode(serialized).length + 1
    if (bytes + length > 300000 && chunk.length) { chunks.push(`[${chunk.join(',')}]`); chunk = []; bytes = 2 }
    chunk.push(serialized); bytes += length
  }
  if (chunk.length) chunks.push(`[${chunk.join(',')}]`)
  if (chunks.length) await db.batch(chunks.map(value => db.prepare("INSERT OR IGNORE INTO cloud_records(user_id,snapshot_id,record_id,payload_json) SELECT ?,?,json_extract(value,'$.id'),value FROM json_each(?)").bind(user.id, id, value)))
  const result = await db.batch([
    db.prepare('UPDATE cloud_users SET active_snapshot=?,last_request=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND (SELECT COUNT(*) FROM cloud_records WHERE user_id=? AND snapshot_id=?)=? AND EXISTS(SELECT 1 FROM cloud_sessions WHERE user_id=? AND token_hash=?) RETURNING revision').bind(deleting ? null : id, id, now, user.id, body.revision, user.id, id, rows.length, user.id, body.sessionHash),
    db.prepare('UPDATE cloud_snapshots SET committed_revision=? WHERE user_id=? AND id=? AND EXISTS(SELECT 1 FROM cloud_users WHERE id=? AND revision=? AND last_request=?)').bind(Number(body.revision) + 1, user.id, id, user.id, Number(body.revision) + 1, id)
  ])
  if (!result[0].results.length) {
    const replay = await db.prepare('SELECT committed_revision FROM cloud_snapshots WHERE user_id=? AND id=?').bind(user.id, id).first<{committed_revision:number|null}>()
    if (replay?.committed_revision != null) return { revision: replay.committed_revision, replayed: true }
    await db.prepare('DELETE FROM cloud_snapshots WHERE user_id=? AND id=? AND committed_revision IS NULL').bind(user.id, id).run()
    fail(409, 'CONFLICT')
  }
  await cleanupRecords(db, user.id)
  return { revision: Number(body.revision) + 1 }
}

/** 共鸣账户与单存档 API；所有记录归属来自已验证会话，不接受客户端指定用户。 */
export async function handleCloud(request: Request, env: CloudEnv): Promise<Response> {
  try {
    checkOrigin(request)
    const db = env.RESONANCE_DB
    if (!db) fail(503, 'NOT_CONFIGURED')
    const action = new URL(request.url).searchParams.get('action') || 'session'
    if (!['GET', 'POST'].includes(request.method)) fail(405, 'METHOD')
    if ((request.method === 'GET') !== ['session', 'snapshot'].includes(action)) fail(405, 'METHOD')
    const token = getToken(request)
    const sessionHash = token ? await digest(token) : ''
    const user = token ? await db.prepare('SELECT u.* FROM cloud_users u JOIN cloud_sessions s ON s.user_id=u.id WHERE s.token_hash=?').bind(sessionHash).first<User>() : null
    if (action === 'session') return json({ user: user ? publicUser(user) : null }, token && user ? cookieFor(request, token) : undefined)
    if (['register', 'login'].includes(action)) {
      const body = await readBody(request, 4096)
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
      const password = body.password
      if (!/^[a-z0-9_]{4,32}$/.test(username) || typeof password !== 'string' || [...password].length < 6 || [...password].length > 128) fail(400, 'CREDENTIAL_FORMAT')
      await limit(db, `ip:${await digest(request.headers.get('CF-Connecting-IP') || 'local')}`, 30)
      await limit(db, `account:${username}`, 10)
      let account = await db.prepare('SELECT * FROM cloud_users WHERE username=?').bind(username).first<User>()
      if (action === 'register') {
        if (account) fail(409, 'USERNAME_TAKEN')
        const passwordHash = await hashPassword(password)
        const id = crypto.randomUUID()
        account = await db.prepare('INSERT INTO cloud_users(id,username,password_hash) VALUES(?,?,?) ON CONFLICT(username) DO NOTHING RETURNING *').bind(id, username, passwordHash).first<User>()
        if (!account) fail(409, 'USERNAME_TAKEN')
      } else if (!(await verifyPassword(password, account?.password_hash || '')) || !account) {
        console.warn('resonance-auth', 'invalid-credentials')
        fail(401, 'CREDENTIALS')
      }
      const next = random()
      await db.batch([
        db.prepare('DELETE FROM cloud_sessions WHERE token_hash=?').bind(sessionHash),
        db.prepare('INSERT INTO cloud_sessions(token_hash,user_id,created_at) VALUES(?,?,?)').bind(await digest(next), account.id, Date.now()),
        db.prepare('DELETE FROM cloud_rate_limits WHERE resets_at<?').bind(Date.now())
      ])
      return json({ user: publicUser(account) }, cookieFor(request, next))
    }
    if (!user) fail(401, 'LOGIN_REQUIRED')
    if (request.headers.get('X-Resonance-Account') !== user.id) fail(409, 'ACCOUNT_CHANGED')
    if (action === 'logout') {
      await db.prepare('DELETE FROM cloud_sessions WHERE token_hash=?').bind(sessionHash).run()
      return json({ success: true }, cookieFor(request, '', true))
    }
    await limit(db, `sync:${user.id}`, 60)
    if (action === 'snapshot') {
      // 同一批事务读取指针与记录，避免覆盖清理时拿到不完整的下载。
      const result = await db.batch([
        db.prepare('SELECT revision,updated_at,active_snapshot FROM cloud_users WHERE id=?').bind(user.id),
        db.prepare('SELECT r.payload_json FROM cloud_records r JOIN cloud_users u ON u.id=r.user_id AND u.active_snapshot=r.snapshot_id WHERE u.id=? ORDER BY r.record_id').bind(user.id)
      ])
      return json({ ...result[0].results[0], records: result[1].results.map(row => JSON.parse(String(row.payload_json))) })
    }
    if (!['upload', 'delete'].includes(action)) fail(400, 'INVALID_DATA')
    const body = await readBody(request, action === 'delete' ? 4096 : MAX_CLOUD_BYTES + 4096)
    if (action === 'delete') {
      await limit(db, `delete:${user.id}`, 10)
    }
    return json(await replace(db, user, { ...body, sessionHash }, action === 'delete'))
  } catch (error) {
    const known = error instanceof ApiError || (error instanceof Error && ['INVALID_DATA', 'TOO_LARGE'].includes(error.message))
    if (!known) console.error('resonance-cloud', 'operation-failed')
    return Response.json({ error: known ? (error as Error).message : 'SERVER_ERROR' }, { status: error instanceof ApiError ? error.status : known ? 400 : 500, headers })
  }
}
