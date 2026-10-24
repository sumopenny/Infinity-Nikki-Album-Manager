import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { join, relative, resolve } from 'node:path'
import type { Plugin } from 'vite'
import type { BuildInfo } from '../src/utils/errorReporting/schema'

function git(...args: string[]): string {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }).trim()
  } catch {
    return ''
  }
}
export function errorBuildInfo(): BuildInfo {
  const builtAt = new Date().toISOString()
  const gitCommit = process.env.CF_PAGES_COMMIT_SHA || git('rev-parse', 'HEAD')
  const version =
    readFileSync('src/i18n/messages/updateLog.ts', 'utf8').match(
      /currentVersion:\s*['"]([^'"]+)['"]/
    )?.[1] ?? 'unknown'
  const environment =
    process.env.ERROR_DEPLOYMENT_ENV ||
    (process.env.CF_PAGES === '1'
      ? process.env.CF_PAGES_BRANCH === 'main'
        ? 'production'
        : 'preview'
      : 'local-build')
  return {
    buildId: `${builtAt.replace(/[^0-9]/g, '')}-${gitCommit.slice(0, 12) || 'unknown'}-${randomUUID().slice(0, 8)}`,
    appVersion: version,
    gitCommit,
    builtAt,
    environment,
    dirty: !!git('status', '--porcelain', '--untracked-files=normal')
  }
}
/** hidden 不等于私有：保存映射后移出 dist；发布目录残留 .map 会使构建失败。 */
export function privateErrorMaps(build: BuildInfo): Plugin {
  let output = '',
    artifact = ''
  return {
    name: 'private-error-source-maps',
    apply: 'build',
    configResolved(config) {
      output = resolve(config.root, config.build.outDir)
      artifact = resolve(config.root, '.error-artifacts', build.buildId)
    },
    closeBundle() {
      if (!existsSync(output)) return
      function walk(directory: string): string[] {
        return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
          const path = join(directory, entry.name)
          return entry.isDirectory() ? walk(path) : path.endsWith('.map') ? [path] : []
        })
      }
      mkdirSync(artifact, { recursive: true })
      const files = walk(output).map((path) => {
        const map = relative(output, path).replace(/\\/g, '/')
        const destination = join(artifact, map)
        mkdirSync(resolve(destination, '..'), { recursive: true })
        copyFileSync(path, destination)
        const source = path.slice(0, -4)
        const sha256 = existsSync(source)
          ? createHash('sha256').update(readFileSync(source)).digest('hex')
          : null
        // 先完成私有副本，再移除公开文件；失败直接使构建失败。
        rmSync(path)
        return { asset: map.slice(0, -4), map, sha256 }
      })
      writeFileSync(
        join(artifact, 'manifest.json'),
        JSON.stringify({ schemaVersion: 1, build, files }, null, 2) + '\n'
      )
      writeFileSync(
        resolve('.error-artifacts', 'latest.json'),
        JSON.stringify({ buildId: build.buildId }) + '\n'
      )
      if (walk(output).length) throw new Error('Public source maps remain in dist')
    }
  }
}
