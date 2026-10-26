import {
  ApiError,
  checkOrigin,
  fail,
  headers,
  json,
  limit,
  readBody,
  readCloudSession,
  requireCloudAccount,
  type CloudEnv
} from './cloudShared'
import { MAX_WARDROBE_BYTES } from '../../src/utils/wardrobe/wardrobeCloudSchema'
import { readWardrobeCloud, writeWardrobeCloud, type WardrobeStage } from './wardrobeCloudStore'

/** 衣橱只复用认证，不读写共鸣存档；日志不包含账号、凭据或存档内容。 */
export async function handleWardrobeCloud(
  request: Request,
  env: CloudEnv,
  onFailure?: (error: unknown, detail: { stage: string; operation: string }) => void
): Promise<Response> {
  const traceId = crypto.randomUUID()
  const started = Date.now()
  let stage: WardrobeStage = 'origin'
  const action = new URL(request.url).searchParams.get('action')
  const operation = ['summary', 'snapshot', 'upload', 'delete'].includes(action ?? '')
    ? action!
    : 'unknown'
  try {
    checkOrigin(request)
    const db = env.RESONANCE_DB
    if (!db) fail(503, 'NOT_CONFIGURED')
    if (operation === 'unknown') fail(400, 'INVALID_DATA')
    if (request.method !== (['summary', 'snapshot'].includes(operation) ? 'GET' : 'POST'))
      fail(405, 'METHOD')
    stage = 'session'
    const { user, sessionHash } = await readCloudSession<{ id: string }>(db, request)
    requireCloudAccount(request, user)
    stage = 'rate-limit'
    await limit(db, `wardrobe-sync:${user.id}`, 60)
    if (operation === 'summary' || operation === 'snapshot') {
      stage = operation === 'summary' ? 'summary-read' : 'snapshot-read'
      return json(await readWardrobeCloud(db, user.id, operation === 'snapshot'))
    }
    if (operation === 'delete') await limit(db, `wardrobe-delete:${user.id}`, 10)
    stage = 'body-read'
    const body = await readBody(request, operation === 'delete' ? 4096 : MAX_WARDROBE_BYTES + 16384)
    return json(
      await writeWardrobeCloud(
        db,
        user.id,
        sessionHash,
        body,
        operation === 'delete',
        (value) => {
          stage = value
        },
        traceId
      )
    )
  } catch (error) {
    const known =
      error instanceof ApiError ||
      (error instanceof Error &&
        ['INVALID_DATA', 'TOO_LARGE', 'EMPTY_LOCAL', 'UNSUPPORTED_SCHEMA'].includes(error.message))
    if (!known) onFailure?.(error, { stage, operation })
    if (!known)
      console.error('wardrobe-cloud', {
        operation,
        stage,
        traceId,
        durationMs: Date.now() - started,
        category: 'runtime'
      })
    return Response.json(
      { error: known ? (error as Error).message : 'SERVER_ERROR' },
      {
        status: error instanceof ApiError ? error.status : known ? 400 : 500,
        headers: { ...headers, 'X-Request-Id': traceId }
      }
    )
  }
}
