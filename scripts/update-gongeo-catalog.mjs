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

export async function updateGongeoCatalog(options = {}) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL
  const outputDir = options.outputDir ?? resolve('src/data/gongeo')
  const timeoutMs = options.timeoutMs ?? 15000
  const catalogSourceDir = options.catalogSourceDir ?? resolve('..', 'gongeo.us-nikki-tracker')
  const bannerSourcePath = options.bannerSourcePath ?? resolve(catalogSourceDir, 'data', 'banners.ts')
  const localeSourceDir = options.localeSourceDir ?? resolve(catalogSourceDir, 'app', 'locales')
  const bannerLocalePath = options.bannerLocalePath ?? resolve(localeSourceDir, 'zh', 'banner.json')
  const root = String(baseUrl).replace(/\/+$/u, '')
  const indexPath = 'public/catalog/index.json'
  let index
  try { index = parseJson(await fetchText(`${root}/${indexPath}`, timeoutMs), 'catalog/index.json') }
  catch (remoteError) {
    try { index = parseJson(await readFile(resolve(catalogSourceDir, indexPath), 'utf8'), resolve(catalogSourceDir, indexPath)) }
    catch { throw remoteError }
  }
  const files = index?.files ?? {}
  const entries = new Map()
  for (const name of FILES) {
    const path = files[name]?.path
    if (typeof path !== 'string' || !path.startsWith('/catalog/')) throw new Error(`Gongeo catalog 缺少 ${name} 文件路径`)
    // 索引使用站点发布路径；仓库源码中的文件位于 public/catalog。
    const sourcePath = `/public${path}`
    let value
    try { value = parseJson(await fetchText(`${root}${sourcePath}`, timeoutMs), path) }
    catch (remoteError) {
      try { value = parseJson(await readFile(resolve(catalogSourceDir, sourcePath.slice(1)), 'utf8'), resolve(catalogSourceDir, sourcePath.slice(1))) }
      catch { throw remoteError }
    }
    validate(name, value)
    entries.set(`${name}.json`, value)
  }
  const bannerPath = files.banners?.path
  if (typeof bannerPath === 'string' && bannerPath.startsWith('/catalog/')) {
    let value
    try { value = parseJson(await fetchText(`${root}/public${bannerPath}`, timeoutMs), bannerPath) }
    catch (remoteError) {
      try { value = parseJson(await readFile(resolve(catalogSourceDir, 'public', bannerPath.slice(1)), 'utf8'), resolve(catalogSourceDir, 'public', bannerPath.slice(1))) }
      catch { throw remoteError }
    }
    validate('banners', value)
    entries.set('banners.json', value)
  }
  if (!entries.has('banners.json')) {
    let source
    let bannerNames
    // 优先获取远程卡池源码，避免可读取但未更新的本地仓库遮蔽新卡池。
    try {
      source = await fetchText(`${root}/data/banners.ts`, timeoutMs)
      bannerNames = parseJson(await fetchText(`${root}/app/locales/zh/banner.json`, timeoutMs), 'app/locales/zh/banner.json')
    } catch (remoteError) {
      try {
        source = await readFile(bannerSourcePath, 'utf8')
        bannerNames = parseJson(await readFile(bannerLocalePath, 'utf8'), bannerLocalePath)
      } catch { throw remoteError }
    }
    const matches = [...source.matchAll(/\b(\d+):\s*\{\s*bannerId:\s*(\d+),\s*bannerType:\s*(\d+),\s*outfit4StarId:\s*(\[[^\]]*\]),\s*outfit5StarId:\s*(\[[^\]]*\]),\s*runs:\s*\[([\s\S]*?)\][\s\S]*?\n\s*\},/gu)]
    if (matches.length < 70) throw new Error(`Gongeo banner 源文件格式无效 (${matches.length})`)
    const value = matches.map((match) => {
      const runs = [...match[6].matchAll(/\{\s*version:\s*'([^']+)',\s*start:\s*'([^']+)',\s*end:\s*([^,}]+),?\s*\}/gu)]
        .map((run) => ({ version: run[1], start: run[2], end: run[3].trim().replace(/^'|'$/gu, '') }))
      return { bannerId: Number(match[2]), bannerType: Number(match[3]), name: bannerNames[`banner.${match[2]}.name`] ?? String(match[2]), outfit4StarId: JSON.parse(match[4].replace(/'/gu, '"')), outfit5StarId: JSON.parse(match[5].replace(/'/gu, '"')), runs }
    })
    entries.set('banners.json', value)
  }
  for (const language of LOCALES) {
    for (const name of ['item', 'outfit', 'banner']) {
      const path = `app/locales/${language}/${name}.json`
      let value
      try {
        value = parseJson(await fetchText(`${root}/${path}`, timeoutMs), path)
      } catch (remoteError) {
        const localPath = language === 'zh' && name === 'banner'
          ? bannerLocalePath
          : resolve(localeSourceDir, language, `${name}.json`)
        try { value = parseJson(await readFile(localPath, 'utf8'), localPath) }
        catch { throw remoteError }
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`Gongeo ${language} ${name} locale 结构无效`)
      entries.set(`locales/${language}/${name}.json`, value)
    }
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
