import { mkdir } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

await mkdir('src/assets', { recursive: true })
const result = spawnSync(process.execPath, ['node_modules/assemblyscript/bin/asc.js', 'assembly/index.ts', '--target', 'release', '--exportRuntime', '--outFile', 'src/assets/photo-params.wasm'], { stdio: 'inherit' })
if (result.error) throw result.error
if (result.status !== 0) process.exit(result.status ?? 1)
