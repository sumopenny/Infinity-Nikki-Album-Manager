import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, renameSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const DEFAULT_PROJECT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const STATE_FILE = '.nikkicube-dependencies.json'
const CHECK_VERSION = 1

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'))
const readOptionalJson = (file) => {
  try {
    return readJson(file)
  } catch (error) {
    if (error.code === 'ENOENT' || error instanceof SyntaxError) return null
    throw error
  }
}

/** The marker lives in node_modules, so replacing that directory invalidates it. */
export function inspectDependencies(projectDir = DEFAULT_PROJECT_DIR) {
  const manifest = readJson(join(projectDir, 'package.json'))
  const lock = readJson(join(projectDir, 'package-lock.json'))
  const fingerprint = createHash('sha256')
    .update(JSON.stringify({ checkVersion: CHECK_VERSION, manifest, lock }))
    .digest('hex')
  const state = readOptionalJson(join(projectDir, 'node_modules', STATE_FILE))
  const reasons = []
  const packageProblems = []
  if (state?.fingerprint !== fingerprint) {
    reasons.push('The dependency files changed or this installation has not been verified.')
  }
  for (const name of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
    const expected = lock.packages?.[`node_modules/${name}`]
    if (!expected?.version) throw new Error(`package-lock.json is missing the version for ${name}.`)
    const installed = readOptionalJson(join(projectDir, 'node_modules', name, 'package.json'))
    if (!installed) packageProblems.push(`Missing dependency: ${name}`)
    else if (installed.version !== expected.version) {
      packageProblems.push(
        `Dependency version mismatch: ${name} (${installed.version} instead of ${expected.version})`
      )
    }
  }
  reasons.push(...packageProblems)
  return { fingerprint, reasons, packageProblems }
}

function installDependencies(projectDir) {
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm'
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm ci --include=dev']
      : ['ci', '--include=dev']
  const result = spawnSync(command, args, { cwd: projectDir, stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(
      `npm ci failed (exit code ${result.status ?? 'unknown'}). Check your network and npm output.`
    )
  }
}

export function ensureDependencies({
  projectDir = DEFAULT_PROJECT_DIR,
  checkOnly = false,
  install = installDependencies,
  log = console.log
} = {}) {
  const before = inspectDependencies(projectDir)
  if (!before.reasons.length) {
    log('Dependencies are up to date.')
    return { ready: true, installed: false }
  }
  for (const reason of before.reasons) log(reason)
  if (checkOnly) return { ready: false, installed: false }
  log('Installing dependencies from package-lock.json. This may take a few minutes...')
  install(projectDir)
  const after = inspectDependencies(projectDir)
  if (after.fingerprint !== before.fingerprint) {
    throw new Error(
      'The dependency files changed during installation. Please run the launcher again.'
    )
  }
  if (after.packageProblems.length) {
    throw new Error(`Dependency installation is incomplete: ${after.packageProblems.join('; ')}`)
  }
  const statePath = join(projectDir, 'node_modules', STATE_FILE)
  const temporary = `${statePath}.${process.pid}.tmp`
  try {
    writeFileSync(temporary, `${JSON.stringify({ fingerprint: after.fingerprint })}\n`, 'utf8')
    renameSync(temporary, statePath)
  } finally {
    rmSync(temporary, { force: true })
  }
  log('Dependencies are ready.')
  return { ready: true, installed: true }
}

const entryUrl = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (import.meta.url === entryUrl) {
  try {
    const args = process.argv.slice(2)
    if (args.some((arg) => arg !== '--check'))
      throw new Error('Usage: node start/ensure-dependencies.mjs [--check]')
    const result = ensureDependencies({ checkOnly: args.includes('--check') })
    if (!result.ready) process.exitCode = 1
  } catch (error) {
    console.error(`[ERROR] ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
