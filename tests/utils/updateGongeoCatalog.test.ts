import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
// @ts-expect-error Node 构建脚本保持原生 ESM，不参与前端 TypeScript 编译。
import { updateGongeoCatalog } from '../../scripts/update-gongeo-catalog.mjs'

const baseUrl = 'https://raw.example.test/gongeo/master'
const catalogFiles = {
  items: [{ id: 1 }],
  outfits: [{ id: 2 }],
  outfitItems: [[1, [2]]],
  makeupItems: [[3, 4]],
  makeupOutfits: [[4, 5]],
  palettes: { items: [{ id: 6 }], palettes: { primary: [6] } }
}
const catalogPaths = Object.fromEntries(
  Object.keys(catalogFiles).map((name) => [name, `/catalog/${name}.testhash.json`])
)

let outputDir: string | undefined

const bannerSource = `
export const BANNER_DATA: BannerData = {
${Array.from({ length: 70 }, (_, index) => `  ${index + 1}: {
    bannerId: ${index + 1},
    bannerType: 2,
    outfit4StarId: ['100${index + 1}'],
    outfit5StarId: ['101${index + 1}'],
    runs: [
      {
        version: '2.10.1',
        start: '2026-01-01',
        end: '2026-01-20',
      },
    ],
  },`).join('\n')}
}
`

afterEach(async () => {
  vi.unstubAllGlobals()
  if (outputDir) await rm(outputDir, { recursive: true, force: true })
  outputDir = undefined
})

describe('Gongeo catalog updater', () => {
  it.each(['remote', 'local-fallback', 'published'])('resolves catalogs and locales with %s banners', async (bannerMode) => {
    outputDir = await mkdtemp(join(tmpdir(), 'gongeo-catalog-test-'))
    const index = {
      gameVersion: '2.10.1',
      generatedAt: '2026-09-23T22:44:13.188Z',
      files: Object.fromEntries(Object.entries(catalogPaths).map(([name, path]) => [name, { path }]))
    }
    const responses = new Map<string, string>([
      [`${baseUrl}/public/catalog/index.json`, JSON.stringify(index)],
      [`${baseUrl}/app/locales/zh/outfit.json`, JSON.stringify({ outfits: {} })],
      [`${baseUrl}/app/locales/en/outfit.json`, JSON.stringify({ outfits: {} })],
      [`${baseUrl}/app/locales/zh/item.json`, JSON.stringify({ items: {} })],
      [`${baseUrl}/app/locales/en/item.json`, JSON.stringify({ items: {} })],
      [`${baseUrl}/app/locales/zh/banner.json`, JSON.stringify({ 'banner.1.name': '遥远之海' })],
      [`${baseUrl}/app/locales/en/banner.json`, JSON.stringify({ 'banner.1.name': 'Distant Sea' })]
    ])
    for (const [name, path] of Object.entries(catalogPaths)) {
      responses.set(`${baseUrl}/public${path}`, JSON.stringify(catalogFiles[name as keyof typeof catalogFiles]))
    }
    if (bannerMode === 'remote') {
      responses.set(`${baseUrl}/data/banners.ts`, bannerSource.replaceAll("version: '2.10.1'", "version: '2.11.0'"))
    } else if (bannerMode === 'published') {
      Object.assign(index.files, { banners: { path: '/catalog/banners.testhash.json' } })
      responses.set(`${baseUrl}/public/catalog/index.json`, JSON.stringify(index))
      responses.set(`${baseUrl}/public/catalog/banners.testhash.json`, JSON.stringify([{ bannerId: 1, name: '遥远之海', runs: [{ version: '2.11.0' }] }]))
    }

    const bannerSourcePath = join(outputDir, 'banners.ts')
    const bannerLocalePath = join(outputDir, 'banner.json')
    await writeFile(bannerSourcePath, bannerSource, 'utf8')
    await writeFile(bannerLocalePath, JSON.stringify({ 'banner.1.name': '遥远之海' }), 'utf8')
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const body = responses.get(String(input))
      return new Response(body ?? 'not found', { status: body === undefined ? 404 : 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateGongeoCatalog({ baseUrl, outputDir, bannerSourcePath, bannerLocalePath, catalogSourceDir: join(outputDir, 'no-upstream') })
    const requestUrls = fetchMock.mock.calls.map(([input]) => String(input))

    // 目录快照包含卡池、套装及部件的中英文名称。
    expect(result).toEqual({ updated: 13, total: 13, version: '2.10.1', generatedAt: index.generatedAt })
    expect(requestUrls).toContain(`${baseUrl}/public/catalog/items.testhash.json`)
    expect(requestUrls).not.toContain(`${baseUrl}/catalog/items.testhash.json`)
    expect(requestUrls).toContain(`${baseUrl}/app/locales/zh/outfit.json`)
    expect(requestUrls).toContain(`${baseUrl}/app/locales/en/item.json`)
    expect(requestUrls).toContain(`${baseUrl}/app/locales/en/banner.json`)
    expect(JSON.parse(await readFile(join(outputDir, 'banners.json'), 'utf8'))[0].name).toBe('遥远之海')
    // 远程新版本必须覆盖可读的旧本地源码；远程不可用时仍能回退。
    expect(JSON.parse(await readFile(join(outputDir, 'banners.json'), 'utf8'))[0].runs[0].version).toBe(bannerMode === 'local-fallback' ? '2.10.1' : '2.11.0')
    if (bannerMode === 'published') {
      expect(requestUrls).not.toContain(`${baseUrl}/data/banners.ts`)
    } else {
      expect(requestUrls).toContain(`${baseUrl}/data/banners.ts`)
    }
    expect(JSON.parse(await readFile(join(outputDir, 'locales', 'zh', 'banner.json'), 'utf8'))).toEqual({ 'banner.1.name': '遥远之海' })
    expect(JSON.parse(await readFile(join(outputDir, 'locales', 'en', 'banner.json'), 'utf8'))).toEqual({ 'banner.1.name': 'Distant Sea' })
    expect(JSON.parse(await readFile(join(outputDir, 'locales', 'en', 'item.json'), 'utf8'))).toEqual({ items: {} })
    expect(JSON.parse(await readFile(join(outputDir, 'items.json'), 'utf8'))).toEqual(catalogFiles.items)
    const repeated = await updateGongeoCatalog({ baseUrl, outputDir, bannerSourcePath, bannerLocalePath, catalogSourceDir: join(outputDir, 'no-upstream') })
    expect(repeated.updated).toBe(0)
  })

  it('reports a missing catalog asset using its mapped repository URL', async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'gongeo-catalog-test-'))
    const index = { files: { items: { path: '/catalog/items.testhash.json' } } }
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input) === `${baseUrl}/public/catalog/index.json`) {
        return new Response(JSON.stringify(index), { status: 200 })
      }
      return new Response('not found', { status: 404 })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(updateGongeoCatalog({ baseUrl, outputDir, catalogSourceDir: join(outputDir, 'no-upstream') })).rejects.toThrow(
      `HTTP 404: ${baseUrl}/public/catalog/items.testhash.json`
    )
  })
})
