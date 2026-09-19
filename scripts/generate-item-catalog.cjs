// 从 gongeo.us-nikki-tracker 的中英文图鉴文案提取部件/妆容名称,刷新 src/data/itemCatalog.json
// 用法: node scripts/generate-item-catalog.cjs [gongeo仓库根目录]
const fs = require('fs')
const path = require('path')

const GONGEO_ROOT =
  process.argv[2] || 'D:/DESKTOPPPPPPP/gongeo.us-nikki-tracker'
const LOCALES = path.join(GONGEO_ROOT, 'app/locales')
const OUT = path.join(__dirname, '../src/data/itemCatalog.json')

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))

// 文案文件为扁平结构: "item.{id}.name" / "makeup.{id}.name" → 名称
const collect = (lang, kind) => {
  const file = path.join(LOCALES, lang, kind === 'item' ? 'item.json' : 'makeup.json')
  const raw = readJson(file)
  const map = new Map()
  for (const [key, value] of Object.entries(raw)) {
    const prefix = `${kind}.`
    if (!key.startsWith(prefix) || !key.endsWith('.name')) continue
    const id = key.slice(prefix.length, -'.name'.length)
    map.set(id, String(value))
  }
  return map
}

const build = (zhMap, enMap) => {
  const out = {}
  for (const [id, zh] of zhMap) {
    out[id] = [zh, enMap.get(id) ?? zh]
  }
  return out
}

const catalog = {
  items: build(collect('zh', 'item'), collect('en', 'item')),
  makeups: build(collect('zh', 'makeup'), collect('en', 'makeup')),
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(catalog), 'utf8')

const size = fs.statSync(OUT).size
console.log(
  `items: ${Object.keys(catalog.items).length}, makeups: ${Object.keys(catalog.makeups).length}, ${(size / 1024).toFixed(1)} KB → ${OUT}`
)
