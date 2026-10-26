import {
  ApiError,
  fail,
  json,
  headers,
  digest,
  cookieFor,
  limit,
  readBody,
  checkOrigin,
  readCloudSession,
  requireCloudAccount,
  type CloudDB,
  type CloudEnv
} from './cloudShared'
export type { Statement, CloudDB, CloudEnv } from './cloudShared'
export { digest } from './cloudShared'
import { argon2idAsync } from '@noble/hashes/argon2.js'
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js'
import { MAX_CLOUD_BYTES, validateCloudRecords } from '../../src/utils/resonance/cloudSchema'

type CloudStage =
  | 'origin'
  | 'session'
  | 'body-read'
  | 'rate-limit'
  | 'account-read'
  | 'password-hash'
  | 'account-write'
  | 'session-write'
  | 'snapshot-read'
  | 'snapshot-decode'
  | 'receipt-read'
  | 'staging'
  | 'commit'
  | 'cleanup'
interface User {
  id: string
  username: string
  password_hash: string
  active_snapshot: string | null
  revision: number
  updated_at: number
}
const enc = new TextEncoder()
const opts = { m: 19456, t: 2, p: 1, dkLen: 32, maxmem: 32 * 1024 * 1024 }
const publicUser = (user: User) => ({ id: user.id, username: user.username })
const random = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
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
  for (let i = 0; i < actual.length; i++)
    diff |= actual.charCodeAt(i) ^ (expected?.charCodeAt(i) || 0)
  return diff === 0 && stored.startsWith('argon2id-v1$')
}
/** 只回收已提交且不再活跃的记录；保留小型请求回执与其他设备的暂存版本。 */
async function cleanupRecords(db: CloudDB, userId: string, requestId: string) {
  try {
    await db
      .prepare(
        'DELETE FROM cloud_records WHERE user_id=? AND snapshot_id IN (SELECT id FROM cloud_snapshots WHERE user_id=? AND committed_revision IS NOT NULL AND id IS NOT (SELECT active_snapshot FROM cloud_users WHERE id=?))'
      )
      .bind(userId, userId, userId)
      .run()
  } catch {
    // 提交已完成，回收失败留待下次请求处理，不改变提交回执。
    console.warn('resonance-cloud', { stage: 'cleanup', requestId, category: 'deferred' })
  }
}
/** 版本化整批覆盖：暂存各行后 CAS 切换指针，失败或中断不影响当前存档。 */
async function replace(
  db: CloudDB,
  user: User,
  body: Record<string, unknown>,
  deleting: boolean,
  stage: (value: CloudStage) => void,
  requestId: string
) {
  const id = body.requestId
  if (
    typeof id !== 'string' ||
    !/^[a-f0-9-]{36}$/.test(id) ||
    !Number.isSafeInteger(body.revision) ||
    Number(body.revision) < 0
  )
    fail(400, 'INVALID_DATA')
  const records = deleting ? [] : body.records
  if (!deleting) validateCloudRecords(records)
  const rows = records as { id: string }[]
  const fingerprint = await digest(
    JSON.stringify({ revision: body.revision, records: rows, deleting })
  )
  stage('receipt-read')
  const previous = await db
    .prepare('SELECT digest,committed_revision FROM cloud_snapshots WHERE user_id=? AND id=?')
    .bind(user.id, id)
    .first<{ digest: string; committed_revision: number | null }>()
  if (previous && previous.digest !== fingerprint) fail(409, 'CONFLICT')
  if (previous?.committed_revision != null) {
    stage('cleanup')
    await cleanupRecords(db, user.id, requestId)
    return { revision: previous.committed_revision, replayed: true }
  }
  if (user.revision !== body.revision) fail(409, 'CONFLICT')
  stage('staging')
  const now = Date.now()
  // 清理一天前的中断上传与三十天前的重试回执；当前存档永不被清理。
  await db
    .prepare(
      'DELETE FROM cloud_snapshots WHERE user_id=? AND id IS NOT (SELECT active_snapshot FROM cloud_users WHERE id=?) AND ((committed_revision IS NULL AND created_at<?) OR created_at<?)'
    )
    .bind(user.id, user.id, now - 86400000, now - 30 * 86400000)
    .run()
  await db
    .prepare(
      'INSERT INTO cloud_snapshots(user_id,id,digest,count,created_at) SELECT ?,?,?,?,? WHERE (SELECT COUNT(*) FROM cloud_snapshots WHERE user_id=? AND committed_revision IS NULL)<2 ON CONFLICT(user_id,id) DO NOTHING'
    )
    .bind(user.id, id, fingerprint, rows.length, now, user.id)
    .run()
  const claimed = await db
    .prepare('SELECT digest FROM cloud_snapshots WHERE user_id=? AND id=?')
    .bind(user.id, id)
    .first<{ digest: string }>()
  if (!claimed) fail(429, 'UPLOAD_PENDING')
  if (claimed?.digest !== fingerprint) fail(409, 'CONFLICT')
  // 每段 JSON 小于 D1 参数上限，整次请求最多约 40 条 SQL，兼容免费 D1 查询次数。
  const chunks: string[] = []
  let chunk: string[] = []
  let bytes = 2
  for (const row of rows) {
    const serialized = JSON.stringify(row)
    const length = enc.encode(serialized).length + 1
    if (bytes + length > 300000 && chunk.length) {
      chunks.push(`[${chunk.join(',')}]`)
      chunk = []
      bytes = 2
    }
    chunk.push(serialized)
    bytes += length
  }
  if (chunk.length) chunks.push(`[${chunk.join(',')}]`)
  if (chunks.length)
    await db.batch(
      chunks.map((value) =>
        db
          .prepare(
            "INSERT OR IGNORE INTO cloud_records(user_id,snapshot_id,record_id,payload_json) SELECT ?,?,json_extract(value,'$.id'),value FROM json_each(?)"
          )
          .bind(user.id, id, value)
      )
    )
  stage('commit')
  const result = await db.batch([
    db
      .prepare(
        'UPDATE cloud_users SET active_snapshot=?,last_request=?,revision=revision+1,updated_at=? WHERE id=? AND revision=? AND (SELECT COUNT(*) FROM cloud_records WHERE user_id=? AND snapshot_id=?)=? AND EXISTS(SELECT 1 FROM cloud_sessions WHERE user_id=? AND token_hash=?) RETURNING revision'
      )
      .bind(
        deleting ? null : id,
        id,
        now,
        user.id,
        body.revision,
        user.id,
        id,
        rows.length,
        user.id,
        body.sessionHash
      ),
    db
      .prepare(
        'UPDATE cloud_snapshots SET committed_revision=? WHERE user_id=? AND id=? AND EXISTS(SELECT 1 FROM cloud_users WHERE id=? AND revision=? AND last_request=?)'
      )
      .bind(Number(body.revision) + 1, user.id, id, user.id, Number(body.revision) + 1, id)
  ])
  if (!result[0].results.length) {
    const replay = await db
      .prepare('SELECT committed_revision FROM cloud_snapshots WHERE user_id=? AND id=?')
      .bind(user.id, id)
      .first<{ committed_revision: number | null }>()
    if (replay?.committed_revision != null)
      return { revision: replay.committed_revision, replayed: true }
    await db
      .prepare(
        'DELETE FROM cloud_snapshots WHERE user_id=? AND id=? AND committed_revision IS NULL'
      )
      .bind(user.id, id)
      .run()
    fail(409, 'CONFLICT')
  }
  stage('cleanup')
  await cleanupRecords(db, user.id, requestId)
  return { revision: Number(body.revision) + 1 }
}

/** 共鸣账户与单存档 API；所有记录归属来自已验证会话，不接受客户端指定用户。 */
export async function handleCloud(
  request: Request,
  env: CloudEnv,
  onFailure?: (error: unknown, detail: { stage: string; operation: string }) => void
): Promise<Response> {
  // 诊断字段只取服务端生成值和固定枚举，不记录账号、令牌、SQL 或异常原文。
  const requestId = crypto.randomUUID()
  let stage: CloudStage = 'origin'
  const setStage = (value: CloudStage) => {
    stage = value
  }
  const action = new URL(request.url).searchParams.get('action') || 'session'
  const operation = [
    'session',
    'register',
    'login',
    'logout',
    'snapshot',
    'upload',
    'delete'
  ].includes(action)
    ? action
    : 'unknown'
  try {
    checkOrigin(request)
    const db = env.RESONANCE_DB
    if (!db) fail(503, 'NOT_CONFIGURED')
    if (!['GET', 'POST'].includes(request.method)) fail(405, 'METHOD')
    if ((request.method === 'GET') !== ['session', 'snapshot'].includes(action)) fail(405, 'METHOD')
    setStage('session')
    const { token, sessionHash, user } = await readCloudSession<User>(db, request)
    if (action === 'session')
      return json(
        { user: user ? publicUser(user) : null },
        token && user ? cookieFor(request, token) : undefined
      )
    if (['register', 'login'].includes(action)) {
      setStage('body-read')
      const body = await readBody(request, 4096)
      const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : ''
      const password = body.password
      if (
        !/^[a-z0-9_]{4,32}$/.test(username) ||
        typeof password !== 'string' ||
        [...password].length < 6 ||
        [...password].length > 128
      )
        fail(400, 'CREDENTIAL_FORMAT')
      setStage('rate-limit')
      await limit(db, `ip:${await digest(request.headers.get('CF-Connecting-IP') || 'local')}`, 30)
      await limit(db, `account:${username}`, 10)
      setStage('account-read')
      let account = await db
        .prepare('SELECT * FROM cloud_users WHERE username=?')
        .bind(username)
        .first<User>()
      if (action === 'register') {
        if (account) fail(409, 'USERNAME_TAKEN')
        setStage('password-hash')
        const passwordHash = await hashPassword(password)
        setStage('account-write')
        const id = crypto.randomUUID()
        account = await db
          .prepare(
            'INSERT INTO cloud_users(id,username,password_hash) VALUES(?,?,?) ON CONFLICT(username) DO NOTHING RETURNING *'
          )
          .bind(id, username, passwordHash)
          .first<User>()
        if (!account) fail(409, 'USERNAME_TAKEN')
      } else {
        setStage('password-hash')
        if (!(await verifyPassword(password, account?.password_hash || '')) || !account) {
          console.warn('resonance-auth', 'invalid-credentials')
          fail(401, 'CREDENTIALS')
        }
      }
      setStage('session-write')
      const next = random()
      await db.batch([
        db.prepare('DELETE FROM cloud_sessions WHERE token_hash=?').bind(sessionHash),
        db
          .prepare('INSERT INTO cloud_sessions(token_hash,user_id,created_at) VALUES(?,?,?)')
          .bind(await digest(next), account.id, Date.now()),
        db.prepare('DELETE FROM cloud_rate_limits WHERE resets_at<?').bind(Date.now())
      ])
      return json({ user: publicUser(account) }, cookieFor(request, next))
    }
    requireCloudAccount(request, user)
    if (action === 'logout') {
      setStage('session-write')
      await db.prepare('DELETE FROM cloud_sessions WHERE token_hash=?').bind(sessionHash).run()
      return json({ success: true }, cookieFor(request, '', true))
    }
    setStage('rate-limit')
    await limit(db, `sync:${user.id}`, 60)
    if (action === 'snapshot') {
      setStage('snapshot-read')
      // 同一批事务读取指针与记录，避免覆盖清理时拿到不完整的下载。
      const result = await db.batch([
        db
          .prepare('SELECT revision,updated_at,active_snapshot FROM cloud_users WHERE id=?')
          .bind(user.id),
        db
          .prepare(
            'SELECT r.payload_json FROM cloud_records r JOIN cloud_users u ON u.id=r.user_id AND u.active_snapshot=r.snapshot_id WHERE u.id=? ORDER BY r.record_id'
          )
          .bind(user.id)
      ])
      setStage('snapshot-decode')
      return json({
        ...result[0].results[0],
        records: result[1].results.map((row) => JSON.parse(String(row.payload_json)))
      })
    }
    if (!['upload', 'delete'].includes(action)) fail(400, 'INVALID_DATA')
    setStage('body-read')
    const body = await readBody(request, action === 'delete' ? 4096 : MAX_CLOUD_BYTES + 4096)
    if (action === 'delete') {
      setStage('rate-limit')
      await limit(db, `delete:${user.id}`, 10)
    }
    return json(
      await replace(db, user, { ...body, sessionHash }, action === 'delete', setStage, requestId)
    )
  } catch (error) {
    const known =
      error instanceof ApiError ||
      (error instanceof Error && ['INVALID_DATA', 'TOO_LARGE'].includes(error.message))
    if (!known) onFailure?.(error, { stage, operation })
    if (!known)
      console.error('resonance-cloud', {
        operation,
        stage,
        requestId,
        category:
          error instanceof SyntaxError
            ? 'syntax'
            : error instanceof TypeError
              ? 'type'
              : error instanceof Error
                ? 'runtime'
                : 'unknown'
      })
    return Response.json(
      { error: known ? (error as Error).message : 'SERVER_ERROR' },
      {
        status: error instanceof ApiError ? error.status : known ? 400 : 500,
        headers: { ...headers, 'X-Request-Id': requestId }
      }
    )
  }
}
