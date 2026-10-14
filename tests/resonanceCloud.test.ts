import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'
import { readFile } from 'node:fs/promises'
import { build } from 'esbuild'
import { handleCloud, type CloudDB, type CloudEnv } from '../functions/_lib/resonanceCloud'
import { validateCloudRecords } from '../src/utils/resonance/cloudSchema'

const fixture = (id: string) => ({ id: `banner:${id}`, bannerId: 'banner', outfitId: id, bannerName: { zh: '卡池', en: 'Banner' }, outfitName: { zh: '套装', en: 'Outfit' }, bannerStartAt: '2026-10-14', rarity: 5, outfitImageUrl: 'https://example.com/a.webp', sets: [{ setNumber: 1, totalPulls: 80, parts: [] }, { setNumber: 2, totalPulls: 0, parts: [] }] })
let mf: Miniflare
let env: CloudEnv
let cookie = ''
let account = ''
/** 使用实际本地 D1 SQL 引擎验证事务、账户隔离与覆盖，不用模拟 SQL 字符串断言。 */
async function request(action: string, body?: unknown, overrides: Record<string,string> = {}, environment = env) {
  const req = new Request(`https://example.test/api/resonance/cloud?action=${action}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'https://example.test', 'X-Resonance-Request': '1', Cookie: cookie, 'X-Resonance-Account': account, 'CF-Connecting-IP': '127.0.0.1', ...overrides },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  })
  if (environment !== env) return handleCloud(req, environment)
  const response = await mf.dispatchFetch(req.url, { method: req.method, headers: Object.fromEntries(req.headers), ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  return new Response(await response.arrayBuffer(), { status: response.status, headers: Object.fromEntries(response.headers) })
}
beforeAll(async () => {
  const bundle = await build({ stdin: { contents: "import {handleCloud} from './functions/_lib/resonanceCloud.ts'; export default {fetch:handleCloud}", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022' })
  mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0].text, compatibilityDate: '2026-09-19', d1Databases: ['RESONANCE_DB'] }))
  const db = await mf.getD1Database('RESONANCE_DB')
  const sql = await readFile('migrations-resonance/0001_cloud.sql', 'utf8')
  await db.exec(sql.replace(/--[^\n]*/g, '').replace(/\s+/g, ' '))
  env = { RESONANCE_DB: db as unknown as CloudDB }
}, 30000)
afterAll(async () => { await mf?.dispose() })

describe('resonance cloud accounts and complete replacement', () => {
  it('requires a configured binding and rejects cross-origin writes', async () => {
    expect((await request('session', undefined, {}, {})).status).toBe(503)
    expect((await request('register', {}, { Origin: 'https://attacker.test' })).status).toBe(403)
    expect((await request('register', {}, { 'X-Resonance-Request': '' })).status).toBe(403)
    expect((await request('register', { username: "x' OR 1=1", password: '123456' })).status).toBe(400)
  })
  it('registers a case-insensitive account with a six-character password and secure persistent cookie', async () => {
    const response = await request('register', { username: 'Nikki_Test', password: '123456' })
    expect(response.status).toBe(200)
    expect(response.headers.get('Set-Cookie')).toContain('HttpOnly; SameSite=Strict; Max-Age=34560000; Secure')
    cookie = response.headers.get('Set-Cookie')!.split(';')[0]
    const value = await response.json() as {user:{id:string;username:string}}
    account = value.user.id
    expect(value.user.username).toBe('nikki_test')
    const stored = await env.RESONANCE_DB!.prepare('SELECT password_hash FROM cloud_users WHERE id=?').bind(account).first<{password_hash:string}>()
    expect(stored?.password_hash).toMatch(/^argon2id-v1\$/)
    expect(stored?.password_hash).not.toContain('123456')
    expect((await request('register', { username: 'NIKKI_TEST', password: '123456' })).status).toBe(409)
  }, 30000)
  it('isolates accounts and rejects missing sessions', async () => {
    expect((await request('snapshot', undefined, { Cookie: '' })).status).toBe(401)
    expect((await request('snapshot', undefined, { 'X-Resonance-Account': 'another-user' })).status).toBe(409)
    const response = await request('snapshot')
    expect(await response.json()).toMatchObject({ revision: 0, active_snapshot: null, records: [] })
  })
  it('uploads whole records, replays safely, replaces missing rows and rejects stale versions', async () => {
    const first = { requestId: crypto.randomUUID(), revision: 0, records: [fixture('a'), fixture('b')] }
    expect((await request('upload', first)).status).toBe(200)
    expect(await (await request('upload', first)).json()).toMatchObject({ revision: 1, replayed: true })
    expect((await request('upload', { ...first, records: [fixture('c')] })).status).toBe(409)
    expect((await request('upload', { ...first, requestId: crypto.randomUUID() })).status).toBe(409)
    const next = { requestId: crypto.randomUUID(), revision: 1, records: [fixture('c')] }
    expect((await request('upload', next)).status).toBe(200)
    expect(await (await request('snapshot')).json()).toMatchObject({ revision: 2, records: [fixture('c')] })
    expect((await env.RESONANCE_DB!.prepare('SELECT COUNT(*) AS count FROM cloud_records WHERE user_id=?').bind(account).first<{count:number}>())?.count).toBe(1)
  })
  it('rejects empty, duplicate and invalid records without changing the save', async () => {
    for (const records of [[], [fixture('a'), fixture('a')], [{ ...fixture('a'), outfitImageUrl: 'javascript:alert(1)' }]]) {
      expect((await request('upload', { requestId: crypto.randomUUID(), revision: 2, records })).status).toBe(400)
    }
    expect(await (await request('snapshot')).json()).toMatchObject({ revision: 2, records: [fixture('c')] })
    expect(() => validateCloudRecords([fixture('a')])).not.toThrow()
  })
  it('permits only one of two concurrent overwrites and keeps a complete snapshot', async () => {
    const results = await Promise.all(['d', 'e'].map(id => request('upload', { requestId: crypto.randomUUID(), revision: 2, records: [fixture(id)] })))
    expect(results.map(r => r.status).sort()).toEqual([200, 409])
    const snapshot = await (await request('snapshot')).json() as {revision:number;records:unknown[]}
    expect(snapshot.revision).toBe(3)
    expect(snapshot.records).toHaveLength(1)
  })
  it('limits login attempts before hashing and uses a generic credential error', async () => {
    const response = await request('login', { username: 'nikki_test', password: 'wrong1' })
    expect(await response.json()).toEqual({ error: 'CREDENTIALS' })
    await env.RESONANCE_DB!.prepare("UPDATE cloud_rate_limits SET count=10 WHERE key='account:nikki_test'").run()
    expect((await request('login', { username: 'nikki_test', password: '123456' })).status).toBe(429)
  }, 30000)
  it('requires a session but no password for cloud deletion, preserves account/session, and permits uploading again', async () => {
    const body = { requestId: crypto.randomUUID(), revision: 3 }
    expect((await request('delete', body, { Cookie: '' })).status).toBe(401)
    expect((await request('delete', body, { 'X-Resonance-Account': 'another-user' })).status).toBe(409)
    expect((await request('delete', { ...body, revision: 2 })).status).toBe(409)
    expect((await request('delete', body)).status).toBe(200)
    expect(await (await request('delete', body)).json()).toMatchObject({ revision: 4, replayed: true })
    expect(await (await request('snapshot')).json()).toMatchObject({ revision: 4, active_snapshot: null, records: [] })
    expect(await (await request('session')).json()).toMatchObject({ user: { id: account } })
    expect((await request('upload', { requestId: crypto.randomUUID(), revision: 4, records: [fixture('f')] })).status).toBe(200)
    expect((await request('logout', {})).status).toBe(200)
    expect((await request('snapshot')).status).toBe(401)
  }, 30000)
  it('keeps the old snapshot on staging failure, retries, and handles a backup larger than 600 KB', async () => {
    const login = await request('register', { username: 'bulk_test', password: 'abcdef' })
    expect(login.status).toBe(200)
    cookie = login.headers.get('Set-Cookie')!.split(';')[0]
    account = ((await login.json()) as {user:{id:string}}).user.id
    // 新账户不能读取前一账户留下的 f 记录。
    expect(await (await request('snapshot')).json()).toMatchObject({ records: [], revision: 0 })
    const initial = { requestId: crypto.randomUUID(), revision: 0, records: [fixture('original')] }
    expect((await request('upload', initial)).status).toBe(200)
    const rows = Array.from({length: 1000}, (_, i) => ({ ...fixture(String(i)), outfitName: { zh: '测'.repeat(100), en: 'Outfit'.repeat(50) } }))
    expect(new TextEncoder().encode(JSON.stringify(rows)).length).toBeGreaterThan(600000)
    const body = { requestId: crypto.randomUUID(), revision: 1, records: rows }
    const broken: CloudEnv = { RESONANCE_DB: { prepare: env.RESONANCE_DB!.prepare.bind(env.RESONANCE_DB), batch: async () => { throw new Error('simulated interruption') } } }
    expect((await request('upload', body, {}, broken)).status).toBe(500)
    expect(await (await request('snapshot')).json()).toMatchObject({ revision: 1, records: [fixture('original')] })
    expect((await request('upload', body)).status).toBe(200)
    const restored = await (await request('snapshot')).json() as {revision:number;records:unknown[]}
    expect(restored.revision).toBe(2)
    expect(restored.records).toHaveLength(1000)
  }, 30000)
})
