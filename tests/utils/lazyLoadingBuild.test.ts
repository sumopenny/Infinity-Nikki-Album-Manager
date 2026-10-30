import { build } from 'vite'
import type { OutputChunk } from 'rollup'
import { expect, it } from 'vitest'

it('keeps feature pages, catalog data and lookbook parsing out of the initial production dependency graph', async () => {
  const result = await build({ logLevel: 'silent', build: { write: false } })
  if (Array.isArray(result) || !('output' in result))
    throw new Error('Expected a single app bundle')
  const chunks = new Map(
    result.output
      .filter((item): item is OutputChunk => item.type === 'chunk')
      .map((chunk) => [chunk.fileName, chunk])
  )
  const entry = [...chunks.values()].find((chunk) => chunk.isEntry)!
  expect(entry).toBeDefined()
  const initial = new Set<OutputChunk>()
  function visit(chunk: OutputChunk) {
    if (initial.has(chunk)) return
    initial.add(chunk)
    chunk.imports.forEach((name) => {
      const imported = chunks.get(name)
      if (imported) visit(imported)
    })
  }
  visit(entry)
  const modules = [...initial]
    .flatMap((chunk) => Object.keys(chunk.modules))
    .map((id) => id.replaceAll('\\', '/'))
  for (const page of [
    'PersonalWardrobe',
    'ResonanceRecords',
    'CameraFavorites',
    'HomeSchemeWorkspace',
    'OutfitParseDialog',
    'ArchiveCloudDialog'
  ]) {
    expect(
      modules.some((id) => id.includes(`/components/${page}.vue`)),
      page
    ).toBe(false)
    expect(
      [...chunks.values()].some((chunk) =>
        Object.keys(chunk.modules).some((id) =>
          id.replaceAll('\\', '/').includes(`/components/${page}.vue`)
        )
      ),
      `${page} still ships as an optional feature`
    ).toBe(true)
  }
  expect(modules.filter((id) => id.includes('/data/gongeo/'))).toEqual([])
  expect(modules.filter((id) => /\/i18n\/messages\/(helpAbout|updateLog)\.ts/.test(id))).toEqual([])
  expect(
    modules.filter((id) => /\/(outfitCodeParser|lookbookWasmClient|outfitDetails)\.ts/.test(id))
  ).toEqual([])
}, 60000)
