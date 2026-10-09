import { createCipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error Node 构建脚本保持原生 ESM，不参与前端 TypeScript 编译。
import { updateLightFilters } from '../../scripts/update-nuan5-light-filters.mjs'

const manifestUrl = 'https://updates.test/manifest.json'
const versions = { database: 'new-db', language: { zh: 'new-lang', en: 'new-lang' } }
const template = { baseUrl: 'https://images.test/{}.webp', replace: '{}' }
const entry = { key: '1', aliases: ['1'], zh: '旧名称', en: 'Old name' }
const original = {
  schemaVersion: 2,
  source: { database: 'old-db', language: { zh: 'old-lang', en: 'old-lang' }, pose: 'pose-v' },
  templates: { light: template, filter: template, pose: template, momo_pose: template },
  resources: { light: [entry], filter: [entry], pose: [entry], momo_pose: [entry] }
}
const manifest = [
  { id: 'nuan5_database', versionId: versions.database, files: [{ path: 'v1.db', downloadLink: 'https://updates.test/db' }] },
  { id: 'infinity_nikki', versionId: versions.language.zh, files: [
    { path: 'zh-CN.bin', downloadLink: 'https://updates.test/zh' },
    { path: 'en-US.bin', downloadLink: 'https://updates.test/en' }
  ] }
]

// 构造真实加密格式的小型 protobuf / MessagePack 数据，覆盖下载到解析的整条链路。
function varint(value: number): Buffer {
  const bytes = []
  do { bytes.push((value & 127) | (value > 127 ? 128 : 0)); value = Math.floor(value / 128) } while (value)
  return Buffer.from(bytes)
}
function field(id: number, value: string | Buffer): Buffer {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value)
  return Buffer.concat([varint(id * 8 + 2), varint(bytes.length), bytes])
}
function mapEntry(id: number, name: string): Buffer {
  return Buffer.concat([Buffer.from([8]), varint(id), field(2, Buffer.concat([field(1, name), field(2, name)]))])
}
function messagePack(value: string | Record<string, unknown>): Buffer {
  if (typeof value === 'string') {
    const bytes = Buffer.from(value)
    return Buffer.concat([Buffer.from([0xd9, bytes.length]), bytes])
  }
  const pairs = Object.entries(value)
  return Buffer.concat([Buffer.from([0x80 + pairs.length]), ...pairs.flatMap(([key, item]) => [messagePack(key), messagePack(item as string | Record<string, unknown>)])])
}
function encrypt(bytes: Buffer): Buffer {
  const salt = randomBytes(16)
  const nonce = randomBytes(12)
  const key = Buffer.from(hkdfSync('sha256', Buffer.from('9C46C6BF431F5AFFF97A2002AEDFA8B7'), salt, Buffer.from('aes-gcm-filebox'), 32))
  const cipher = createCipheriv('aes-256-gcm', key, nonce)
  return Buffer.concat([salt, nonce, cipher.update(bytes), cipher.final(), cipher.getAuthTag()])
}
const image = Buffer.concat([field(1, template.baseUrl), field(2, template.replace)])
const database = encrypt(Buffer.concat([field(1, mapEntry(2, 'light-name')), field(3, mapEntry(3, 'filter-name')), field(20001, Buffer.concat([field(1, image), field(2, image)]))]))
const language = (light: string, filter: string) => encrypt(messagePack({ infinity_nikki: { light: { 'light-name': light }, filter: { 'filter-name': filter } } }))
let directory: string | undefined
let catalogPath: string
let before: string

async function setup(catalog = original) {
  directory = await mkdtemp(join(tmpdir(), 'light-filter-test-'))
  catalogPath = join(directory, 'catalog.json')
  before = `${JSON.stringify(catalog, null, 2)}\n`
  await writeFile(catalogPath, before)
  const responses = new Map<string, string | Buffer>([
    [manifestUrl, JSON.stringify(manifest)], ['https://updates.test/db', database],
    ['https://updates.test/zh', language('新灯光', '新滤镜')], ['https://updates.test/en', language('New light', 'New filter')]
  ])
  const fetchMock = vi.fn(async (url: string) => {
    const value = responses.get(String(url))
    return new Response(value === undefined ? 'not found' : new Uint8Array(Buffer.from(value)), { status: value === undefined ? 404 : 200 })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { responses, fetchMock }
}

afterEach(async () => {
  vi.unstubAllGlobals()
  if (directory) await rm(directory, { recursive: true, force: true })
  directory = undefined
})

describe('light and filter synchronization', () => {
  it('only checks the manifest when all versions match', async () => {
    const { fetchMock } = await setup({ ...original, source: { ...original.source, ...versions } })
    expect(await updateLightFilters({ catalogPath, manifestUrl })).toEqual({ updated: false, light: 1, filter: 1 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(await readFile(catalogPath, 'utf8')).toBe(before)
  })

  it.each(['database', 'language'])('refreshes on a %s version change and preserves poses and momo', async (changed) => {
    await setup({ ...original, source: { ...original.source, ...(changed === 'database' ? { language: versions.language } : { database: versions.database }) } })
    expect(await updateLightFilters({ catalogPath, manifestUrl })).toEqual({ updated: true, light: 1, filter: 1 })
    const updated = JSON.parse(await readFile(catalogPath, 'utf8'))
    expect(updated.resources.light[0]).toEqual({ key: '2', aliases: ['2', 'light-name'], zh: '新灯光', en: 'New light' })
    expect(updated.resources.filter[0].en).toBe('New filter')
    expect(updated.source.lightFilter).toEqual(versions)
    for (const kind of ['pose', 'momo_pose'] as const) {
      expect(updated.resources[kind]).toEqual(original.resources[kind])
      expect(updated.templates[kind]).toEqual(original.templates[kind])
    }
    expect(updated.source.pose).toBe(original.source.pose)
    const content = await readFile(catalogPath, 'utf8')
    expect((await updateLightFilters({ catalogPath, manifestUrl })).updated).toBe(false)
    expect(await readFile(catalogPath, 'utf8')).toBe(content)
  })

  it('repairs an empty category even when versions match', async () => {
    await setup({ ...original, source: { ...original.source, ...versions }, resources: { ...original.resources, light: [] } })
    expect((await updateLightFilters({ catalogPath, manifestUrl })).updated).toBe(true)
  })

  it.each(['download', 'encrypted', 'translations', 'database', 'manifest', 'changed-version'])('keeps the snapshot on %s failure', async (failure) => {
    const { responses } = await setup()
    if (failure === 'download') responses.delete('https://updates.test/db')
    if (failure === 'encrypted') responses.set('https://updates.test/db', Buffer.from('broken'))
    if (failure === 'translations') responses.set('https://updates.test/en', encrypt(messagePack({ infinity_nikki: {} })))
    if (failure === 'database') responses.set('https://updates.test/db', encrypt(field(20001, Buffer.concat([field(1, image), field(2, image)]))))
    if (failure === 'manifest') responses.set(manifestUrl, JSON.stringify([]))
    if (failure === 'changed-version') {
      let checks = 0
      vi.stubGlobal('fetch', vi.fn(async (url: string) => {
        if (url === manifestUrl && ++checks === 2) return new Response(JSON.stringify([{ ...manifest[0], versionId: 'changed' }, manifest[1]]))
        return new Response(new Uint8Array(Buffer.from(responses.get(url)!)))
      }))
    }
    await expect(updateLightFilters({ catalogPath, manifestUrl })).rejects.toThrow()
    expect(await readFile(catalogPath, 'utf8')).toBe(before)
  })
})
