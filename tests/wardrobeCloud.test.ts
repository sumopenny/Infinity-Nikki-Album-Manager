import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { build } from 'esbuild'
import { readFile } from 'node:fs/promises'
import { digest, type CloudDB } from '../functions/_lib/cloudShared'
import { handleWardrobeCloud } from '../functions/_lib/wardrobeCloud'
import { emptyWardrobe, type WardrobeSnapshot } from '../src/utils/wardrobe/wardrobeSchema'

let mf: Miniflare
let db: CloudDB
const token = 'a'.repeat(64)
const data = () => ({
  ...emptyWardrobe(),
  imported: true,
  regionScope: 'global' as const,
  entries: {
    '1020199999': { owned: true, source: 'pearpal' as const },
    '1020100001': { owned: false, source: 'manual' as const }
  },
  unknownSuitIds: ['999999']
})
const upload = (revision = 0, incoming: WardrobeSnapshot = data()) => ({
  requestId: crypto.randomUUID(),
  revision,
  schemaVersion: 1,
  data: incoming
})
async function request(
  action: string,
  body?: unknown,
  headers: Record<string, string> = {},
  database?: CloudDB
) {
  const req = new Request(`https://example.test/api/wardrobe/cloud?action=${action}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      Origin: 'https://example.test',
      'Content-Type': 'application/json',
      'X-Resonance-Request': '1',
      'X-Resonance-Account': 'user-a',
      Cookie: `resonance_session=${token}`,
      ...headers
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  if (database) return handleWardrobeCloud(req, { RESONANCE_DB: database })
  const response = await mf.dispatchFetch(req.url, {
    method: req.method,
    headers: Object.fromEntries(req.headers),
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  return new Response(await response.arrayBuffer(), {
    status: response.status,
    headers: Object.fromEntries(response.headers)
  })
}
beforeAll(async () => {
  const bundle = await build({
    stdin: {
      contents:
        "import {handleWardrobeCloud} from './functions/_lib/wardrobeCloud.ts'; export default {fetch:handleWardrobeCloud}",
      resolveDir: process.cwd(),
      loader: 'ts'
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    metafile: true
  })
  expect(Object.keys(bundle.metafile!.inputs).join(' ')).not.toMatch(
    /wardrobeCatalog|file-system|data\/gongeo|\.vue/
  )
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script: bundle.outputFiles[0].text,
      compatibilityDate: '2026-09-19',
      d1Databases: ['RESONANCE_DB']
    })
  )
  const engine = await mf.getD1Database('RESONANCE_DB')
  db = engine as unknown as CloudDB
  await engine.exec(
    (await readFile('migrations-resonance/0001_cloud.sql', 'utf8'))
      .replace(/--[^\n]*/g, '')
      .replace(/\s+/g, ' ')
  )
  await db
    .prepare(
      'INSERT INTO cloud_users(id,username,password_hash,revision,active_snapshot) VALUES(?,?,?,?,?)'
    )
    .bind('user-a', 'old_account', 'existing-hash', 7, 'old-resonance')
    .run()
  await db
    .prepare('INSERT INTO cloud_sessions(token_hash,user_id,created_at) VALUES(?,?,?)')
    .bind(await digest(token), 'user-a', 1)
    .run()
  await db
    .prepare(
      'INSERT INTO cloud_snapshots(user_id,id,digest,count,committed_revision,created_at) VALUES(?,?,?,?,?,?)'
    )
    .bind('user-a', 'old-resonance', 'original', 1, 7, 1)
    .run()
  await db
    .prepare(
      'INSERT INTO cloud_records(user_id,snapshot_id,record_id,payload_json) VALUES(?,?,?,?)'
    )
    .bind('user-a', 'old-resonance', 'original', '{"keep":true}')
    .run()
  await engine.exec(
    (await readFile('migrations-resonance/0002_wardrobe_cloud.sql', 'utf8'))
      .replace(/--[^\n]*/g, '')
      .replace(/\s+/g, ' ')
  )
}, 30000)
beforeEach(async () => {
  await db.batch(
    [
      'DELETE FROM cloud_wardrobe_snapshots',
      'DELETE FROM cloud_wardrobe_state',
      'DELETE FROM cloud_rate_limits'
    ].map((sql) => db.prepare(sql))
  )
})
afterAll(async () => {
  await mf?.dispose()
})

describe('wardrobe cloud isolation and atomic replacement', () => {
  it('migrates an existing account and preserves its session and resonance data', async () => {
    expect(await (await request('summary')).json()).toMatchObject({
      revision: 0,
      summary: null,
      active_snapshot: null
    })
    await request('upload', upload())
    await request('delete', { requestId: crypto.randomUUID(), revision: 1 })
    expect(
      await db
        .prepare('SELECT revision,active_snapshot,password_hash FROM cloud_users WHERE id=?')
        .bind('user-a')
        .first()
    ).toEqual({ revision: 7, active_snapshot: 'old-resonance', password_hash: 'existing-hash' })
    expect(
      await db
        .prepare('SELECT payload_json FROM cloud_records WHERE user_id=?')
        .bind('user-a')
        .first()
    ).toEqual({ payload_json: '{"keep":true}' })
  })
  it('rejects missing sessions, account changes, cross origin and wrong methods', async () => {
    expect((await request('summary', undefined, { Cookie: '' })).status).toBe(401)
    expect((await request('summary', undefined, { 'X-Resonance-Account': 'user-b' })).status).toBe(
      409
    )
    expect((await request('upload', upload(), { Origin: 'https://other.test' })).status).toBe(403)
    expect((await request('upload', upload(), { 'X-Resonance-Request': '' })).status).toBe(403)
    expect((await request('upload')).status).toBe(405)
  })
  it('isolates two accounts sharing the same request ID', async () => {
    const otherToken = 'b'.repeat(64)
    await db
      .prepare('INSERT OR IGNORE INTO cloud_users(id,username,password_hash) VALUES(?,?,?)')
      .bind('user-b', 'another_account', 'existing-hash')
      .run()
    await db
      .prepare('INSERT OR IGNORE INTO cloud_sessions(token_hash,user_id,created_at) VALUES(?,?,?)')
      .bind(await digest(otherToken), 'user-b', 1)
      .run()
    const body = upload()
    await request('upload', body)
    const headers = { Cookie: `resonance_session=${otherToken}`, 'X-Resonance-Account': 'user-b' }
    expect(await (await request('summary', undefined, headers)).json()).toMatchObject({
      revision: 0,
      summary: null
    })
    expect(
      (await request('upload', { ...body, data: { ...data(), regionScope: 'cn' } }, headers)).status
    ).toBe(200)
    expect(await (await request('snapshot')).json()).toMatchObject({
      data: { regionScope: 'global' }
    })
    expect(await (await request('snapshot', undefined, headers)).json()).toMatchObject({
      data: { regionScope: 'cn' }
    })
  })
  it('never treats a corrupt stored snapshot as an empty wardrobe', async () => {
    await request('upload', upload())
    await db.prepare('DELETE FROM cloud_wardrobe_records WHERE user_id=?').bind('user-a').run()
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect((await request('snapshot', undefined, {}, db)).status).toBe(500)
      expect(JSON.stringify(log.mock.calls)).not.toMatch(/user-a|old_account|existing-hash/)
    } finally {
      log.mockRestore()
    }
  })
  it('limits wardrobe operations separately from resonance and deletes', async () => {
    await db
      .prepare('INSERT INTO cloud_rate_limits(key,count,resets_at) VALUES(?,?,?)')
      .bind('sync:user-a', 100, Date.now() + 100000)
      .run()
    expect((await request('summary')).status).toBe(200)
    await db
      .prepare('UPDATE cloud_rate_limits SET count=60 WHERE key=?')
      .bind('wardrobe-sync:user-a')
      .run()
    expect((await request('summary')).status).toBe(429)
  })
  it('keeps false ownership, manual sources, unknown IDs and region, with a lightweight summary', async () => {
    expect((await request('upload', upload())).status).toBe(200)
    const head = await (await request('summary')).json()
    expect(head).toMatchObject({
      revision: 1,
      summary: { entryCount: 2, ownedCount: 1, unknownSuitCount: 1, regionScope: 'global' }
    })
    expect(head).not.toHaveProperty('data')
    expect(await (await request('snapshot')).json()).toMatchObject({ data: data() })
  })
  it('distinguishes a valid zero-item save from no save and a clear', async () => {
    expect((await request('upload', { ...upload(), data: emptyWardrobe() })).status).toBe(400)
    const empty = { ...emptyWardrobe(), imported: true, regionScope: 'cn' }
    expect((await request('upload', { ...upload(), data: empty })).status).toBe(200)
    expect(await (await request('snapshot')).json()).toMatchObject({
      revision: 1,
      data: empty,
      summary: { ownedCount: 0 }
    })
    const deletion = { requestId: crypto.randomUUID(), revision: 1 }
    expect((await request('delete', deletion)).status).toBe(200)
    expect(await (await request('delete', deletion)).json()).toMatchObject({
      revision: 2,
      replayed: true
    })
    expect(await (await request('snapshot')).json()).toMatchObject({ revision: 2, data: null })
    expect((await request('upload', upload(1))).status).toBe(409)
    expect((await request('upload', upload(2))).status).toBe(200)
  })
  it('replays old receipts without replacing a later version, rejects different content', async () => {
    const original = upload()
    await request('upload', original)
    await request('upload', upload(1, { ...data(), unknownSuitIds: [] }))
    expect(await (await request('upload', original)).json()).toMatchObject({
      revision: 1,
      replayed: true
    })
    expect(
      (await request('upload', { ...original, data: { ...data(), regionScope: 'cn' } })).status
    ).toBe(409)
    expect(await (await request('snapshot')).json()).toMatchObject({
      revision: 2,
      data: { unknownSuitIds: [] }
    })
  })
  it('allows only one of two competing revisions and safely replays concurrent identical requests', async () => {
    const body = upload()
    const same = await Promise.all([request('upload', body), request('upload', body)])
    expect(same.map((r) => r.status)).toEqual([200, 200])
    const competing = await Promise.all([
      request('upload', upload(1)),
      request('upload', upload(1))
    ])
    expect(competing.map((r) => r.status).sort()).toEqual([200, 409])
    expect(await (await request('snapshot')).json()).toMatchObject({ revision: 2, data: data() })
  })
  it('preserves the old save after staging failure and resumes the same request', async () => {
    await request('upload', upload())
    const body = upload(1)
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      const broken = {
        prepare: db.prepare.bind(db),
        batch: async () => {
          throw new Error('secret-content')
        }
      } as CloudDB
      expect((await request('upload', body, {}, broken)).status).toBe(500)
      expect(JSON.stringify(log.mock.calls)).not.toContain('secret-content')
      expect(await (await request('snapshot')).json()).toMatchObject({ revision: 1 })
      expect((await request('upload', body)).status).toBe(200)
    } finally {
      log.mockRestore()
    }
  })
  it('reports success after commit even when cleanup fails', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const broken = {
      batch: db.batch.bind(db),
      prepare(sql: string) {
        if (sql.startsWith('DELETE FROM cloud_wardrobe_records')) throw new Error('private cleanup')
        return db.prepare(sql)
      }
    } as CloudDB
    try {
      const body = upload()
      expect((await request('upload', body, {}, broken)).status).toBe(200)
      expect(await (await request('upload', body, {}, broken)).json()).toMatchObject({
        replayed: true
      })
      expect(warning).toHaveBeenCalled()
      expect(JSON.stringify(warning.mock.calls)).not.toContain('private cleanup')
      expect(await (await request('snapshot')).json()).toMatchObject({ revision: 1, data: data() })
    } finally {
      warning.mockRestore()
    }
  })
  it('checks the session again at commit and keeps the original save on revocation', async () => {
    await request('upload', upload())
    const body = upload(1)
    const interrupted = {
      prepare: db.prepare.bind(db),
      async batch(statements: Parameters<CloudDB['batch']>[0]) {
        await db
          .prepare('DELETE FROM cloud_sessions WHERE token_hash=?')
          .bind(await digest(token))
          .run()
        return db.batch(statements)
      }
    } as CloudDB
    try {
      expect((await request('upload', body, {}, interrupted)).status).toBe(409)
      expect(
        await db
          .prepare('SELECT revision FROM cloud_wardrobe_state WHERE user_id=?')
          .bind('user-a')
          .first()
      ).toEqual({ revision: 1 })
    } finally {
      await db
        .prepare(
          'INSERT OR IGNORE INTO cloud_sessions(token_hash,user_id,created_at) VALUES(?,?,?)'
        )
        .bind(await digest(token), 'user-a', 1)
        .run()
    }
    expect((await request('upload', body)).status).toBe(200)
  })
  it('cleans expired receipts and staging while preserving the current snapshot', async () => {
    const first = upload()
    await request('upload', first)
    await request('upload', upload(1))
    await db
      .prepare('UPDATE cloud_wardrobe_snapshots SET created_at=1 WHERE user_id=?')
      .bind('user-a')
      .run()
    await request('upload', upload(2))
    expect(
      await db
        .prepare('SELECT id FROM cloud_wardrobe_snapshots WHERE user_id=? AND id=?')
        .bind('user-a', first.requestId)
        .first()
    ).toBeNull()
    expect(await (await request('snapshot')).json()).toMatchObject({ revision: 3, data: data() })
  })
  it('rejects incompatible schemas and oversized entry counts', async () => {
    expect(await (await request('upload', { ...upload(), schemaVersion: 2 })).json()).toEqual({
      error: 'UNSUPPORTED_SCHEMA'
    })
    const entries = Object.fromEntries(
      Array.from({ length: 50001 }, (_, i) => [String(i + 1), { owned: true, source: 'pearpal' }])
    )
    expect(
      await (await request('upload', { ...upload(), data: { ...data(), entries } })).json()
    ).toEqual({ error: 'TOO_LARGE' })
    expect(await (await request('summary')).json()).toMatchObject({ revision: 0, summary: null })
  })
  it('round trips the capacity fixture using chunked writes', async () => {
    const entries = Object.fromEntries(
      Array.from({ length: 50000 }, (_, i) => [
        String(1020000000 + i),
        { owned: true, source: 'pearpal' as const }
      ])
    )
    const unknownSuitIds = Array.from({ length: 10000 }, (_, i) => String(900000 + i))
    const started = performance.now()
    expect(
      (await request('upload', upload(0, { ...data(), entries, unknownSuitIds }))).status
    ).toBe(200)
    const head = await (await request('summary')).json()
    expect(JSON.stringify(head).length).toBeLessThan(1000)
    expect(head).toMatchObject({ summary: { entryCount: 50000, unknownSuitCount: 10000 } })
    const restored = (await (await request('snapshot')).json()) as { data: ReturnType<typeof data> }
    expect(Object.keys(restored.data.entries)).toHaveLength(50000)
    expect(restored.data.unknownSuitIds).toHaveLength(10000)
    console.info('wardrobe capacity local round trip ms', Math.round(performance.now() - started))
  }, 30000)
})
