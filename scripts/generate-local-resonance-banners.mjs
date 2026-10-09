import { readFile, writeFile } from 'node:fs/promises'

const sourcePath = 'C:/Users/GYKJ_Robot_001/Desktop/gongeo.us-nikki-tracker/data/banners.ts'
const namesPath = 'C:/Users/GYKJ_Robot_001/Desktop/gongeo.us-nikki-tracker/app/locales/zh/banner.json'
const outputPath = new URL('../src/data/gongeo/banners.json', import.meta.url)
const source = await readFile(sourcePath, 'utf8')
const names = JSON.parse(await readFile(namesPath, 'utf8'))
const records = [...source.matchAll(/\b(\d+):\s*\{\s*bannerId:\s*(\d+),\s*bannerType:\s*(\d+),\s*outfit4StarId:\s*(\[[^\]]*\]),\s*outfit5StarId:\s*(\[[^\]]*\]),\s*runs:\s*\[([\s\S]*?)\][\s\S]*?\n\s*\},/gu)].map((match) => {
  const runs = [...match[6].matchAll(/\{\s*version:\s*'([^']+)',\s*start:\s*'([^']+)',\s*end:\s*([^,}]+),?\s*\}/gu)]
    .map((run) => ({ version: run[1], start: run[2], end: run[3].trim().replace(/^'|'$/gu, '') }))
  return {
    bannerId: Number(match[2]),
    bannerType: Number(match[3]),
    name: names[`banner.${match[2]}.name`] ?? String(match[2]),
    outfit4StarId: JSON.parse(match[4].replace(/'/gu, '"')),
    outfit5StarId: JSON.parse(match[5].replace(/'/gu, '"')),
    runs
  }
})
if (records.length < 70) throw new Error(`Only ${records.length} banner records parsed`)
await writeFile(outputPath, `${JSON.stringify(records, null, 2)}\n`, 'utf8')
console.log(`Generated ${records.length} resonance banners`)
