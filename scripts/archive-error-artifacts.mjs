/** 生成私有 Source Map ZIP；仅显式 --upload 时访问已存在的 R2，不创建云资源。 */
import { zipSync } from 'fflate'
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
try {
  const latest = JSON.parse(readFileSync(join(root, '.error-artifacts', 'latest.json'), 'utf8'))
  if (!/^[a-zA-Z0-9_.-]{1,128}$/.test(latest.buildId)) throw new Error('Invalid build ID')
  const folder = join(root, '.error-artifacts', latest.buildId),
    files = {}
  function collect(path) {
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      const full = join(path, entry.name)
      if (entry.isDirectory()) collect(full)
      else
        files[relative(join(root, '.error-artifacts'), full).replaceAll('\\', '/')] =
          new Uint8Array(readFileSync(full))
    }
  }
  collect(folder)
  const archive = folder + '.zip'
  writeFileSync(archive, zipSync(files, { level: 6 }))
  console.log(archive)
  if (
    process.argv.includes('--upload') ||
    (process.argv.includes('--upload-if-configured') && process.env.ERROR_ARTIFACT_BUCKET)
  ) {
    const bucket = process.env.ERROR_ARTIFACT_BUCKET
    if (!bucket || !/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket))
      throw new Error('Set ERROR_ARTIFACT_BUCKET to an existing private R2 bucket.')
    const cli = join(root, 'node_modules', 'wrangler', 'bin', 'wrangler.js')
    if (!existsSync(cli)) throw new Error('Wrangler is not installed.')
    const result = spawnSync(
      process.execPath,
      [
        cli,
        'r2',
        'object',
        'put',
        `${bucket}/${latest.buildId}.zip`,
        '--remote',
        '--file',
        archive
      ],
      { cwd: root, stdio: 'inherit', shell: false }
    )
    if (result.error) throw result.error
    if (result.status !== 0)
      throw new Error(
        'Private source map upload failed; do not deploy without preserving the matching artifact.'
      )
  } else if (process.argv.includes('--upload-if-configured')) {
    console.warn(
      'Source maps remain in .error-artifacts only. Preserve this build artifact privately; ephemeral CI storage is not an archive.'
    )
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
