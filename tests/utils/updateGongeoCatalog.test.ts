import { mkdtemp, readFile, rm } from 'node:fs/promises'
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

afterEach(async () => {
  vi.unstubAllGlobals()
  if (outputDir) await rm(outputDir, { recursive: true, force: true })
  outputDir = undefined
})

describe('Gongeo catalog updater', () => {
  it('resolves published catalog paths under public and keeps locale paths unchanged', async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'gongeo-catalog-test-'))
    const index = {
      gameVersion: '2.10.1',
      generatedAt: '2026-09-23T22:44:13.188Z',
      files: Object.fromEntries(Object.entries(catalogPaths).map(([name, path]) => [name, { path }]))
    }
    const responses = new Map<string, string>([
      [`${baseUrl}/public/catalog/index.json`, JSON.stringify(index)],
      [`${baseUrl}/app/locales/zh/outfit.json`, JSON.stringify({ outfits: {} })],
      [`${baseUrl}/app/locales/en/outfit.json`, JSON.stringify({ outfits: {} })]
    ])
    for (const [name, path] of Object.entries(catalogPaths)) {
      responses.set(`${baseUrl}/public${path}`, JSON.stringify(catalogFiles[name as keyof typeof catalogFiles]))
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const body = responses.get(String(input))
      return new Response(body ?? 'not found', { status: body === undefined ? 404 : 200 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateGongeoCatalog({ baseUrl, outputDir })
    const requestUrls = fetchMock.mock.calls.map(([input]) => String(input))

    expect(result).toEqual({ updated: 8, total: 8, version: '2.10.1', generatedAt: index.generatedAt })
    expect(requestUrls).toContain(`${baseUrl}/public/catalog/items.testhash.json`)
    expect(requestUrls).not.toContain(`${baseUrl}/catalog/items.testhash.json`)
    expect(requestUrls).toContain(`${baseUrl}/app/locales/zh/outfit.json`)
    expect(JSON.parse(await readFile(join(outputDir, 'items.json'), 'utf8'))).toEqual(catalogFiles.items)
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

    await expect(updateGongeoCatalog({ baseUrl, outputDir })).rejects.toThrow(
      `HTTP 404: ${baseUrl}/public/catalog/items.testhash.json`
    )
  })
})
