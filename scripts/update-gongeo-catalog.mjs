import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const DEFAULT_BASE_URL = 'https://raw.githubusercontent.com/dastrokes/gongeo.us-nikki-tracker/master'
const FILES = ['items', 'outfits', 'outfitItems', 'makeupItems', 'makeupOutfits', 'palettes']
const LOCALES = ['zh', 'en']

const parseArgs = (argv) => {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i]
    if (!name.startsWith('--')) continue
    const value = argv[i + 1]
    args[name.slice(2)] = value && !value.startsWith('--') ? (i += 1, value) : true
  }
  return args
}

async function fetchText(url, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`)
    return await response.text()
  } finally {
    clearTimeout(timeout)
  }
}

const parseJson = (text, source) => {
  try { return JSON.parse(text) } catch (error) { throw new Error(`Gongeo JSON 无效: ${source}`, { cause: error }) }
}

const validate = (name, value) => {
  if (name === 'palettes') {
    if (!value || !Array.isArray(value.items) || !value.palettes) throw new Error('Gongeo palettes 结构无效')
  } else if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Gongeo ${name} 目录为空或结构无效`)
  }
}

const writeIfChanged = async (file, content) => {
  let current = null
  try { current = await readFile(file, 'utf8') } catch (error) { if (error.code !== 'ENOENT') throw error }
  if (current === content) return false
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${process.pid}.tmp`
  try { await writeFile(temporary, content, 'utf8'); await rename(temporary, file) } finally { await rm(temporary, { force: true }) }
  return true
}

export async function updateGongeoCatalog({ baseUrl = DEFAULT_BASE_URL, outputDir = resolve('src/data/gongeo'), timeoutMs = 15000 } = {}) {
  const root = String(baseUrl).replace(/\/+$/u, '')
  const index = parseJson(await fetchText(`${root}/public/catalog/index.json`, timeoutMs), 'catalog/index.json')
  const files = index?.files ?? {}
  const entries = new Map()
  for (const name of FILES) {
    const path = files[name]?.path
    if (typeof path !== 'string' || !path.startsWith('/catalog/')) throw new Error(`Gongeo catalog 缺少 ${name} 文件路径`)
    const value = parseJson(await fetchText(`${root}${path}`, timeoutMs), path)
    validate(name, value)
    entries.set(`${name}.json`, value)
  }
  for (const language of LOCALES) {
    const path = `app/locales/${language}/outfit.json`
    const value = parseJson(await fetchText(`${root}/${path}`, timeoutMs), path)
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Gongeo ${language} outfit locale 结构无效`)
    entries.set(`locales/${language}/outfit.json`, value)
  }
  let updated = 0
  for (const [relative, value] of entries) {
    if (await writeIfChanged(resolve(outputDir, relative), `${JSON.stringify(value, null, 2)}\n`)) updated += 1
  }
  return { updated, total: entries.size, version: String(index.gameVersion ?? 'unknown'), generatedAt: index.generatedAt }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  try {
    const result = await updateGongeoCatalog({
      baseUrl: args['base-url'] ?? process.env.GONGEO_CATALOG_BASE_URL ?? DEFAULT_BASE_URL,
      outputDir: resolve(args.output ?? 'src/data/gongeo'),
      timeoutMs: Number(args.timeout ?? process.env.GONGEO_CATALOG_TIMEOUT_MS ?? 15000)
    })
    console.log(`Gongeo 目录检查完成: ${result.updated}/${result.total} 个文件更新，游戏版本 ${result.version}`)
  } catch (error) {
    if (args.strict === true) throw error
    console.warn(`Gongeo 目录同步失败，继续使用本地目录: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entryUrl) main().catch((error) => { console.error(error); process.exitCode = 1 })
