import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { ensureDependencies, inspectDependencies } from '../start/ensure-dependencies.mjs'

const repoDir = dirname(dirname(fileURLToPath(import.meta.url)))
const stateFile = (dir) => join(dir, 'node_modules', '.nikkicube-dependencies.json')
const writeJson = (file, value) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value))
}
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'nikki startup test '))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  writeJson(join(dir, 'package.json'), {
    private: true,
    dependencies: { snappyjs: '^0.7.0' },
    devDependencies: { vite: '^5.4.11', '@types/node': '22.18.6' }
  })
  writeJson(join(dir, 'package-lock.json'), { lockfileVersion: 3, packages: {
    'node_modules/snappyjs': { version: '0.7.0' },
    'node_modules/vite': { version: '5.4.21' },
    'node_modules/@types/node': { version: '22.18.6' },
    'node_modules/transitive': { version: '1.0.0' }
  } })
  return dir
}
function installFixture(dir) {
  const lock = JSON.parse(readFileSync(join(dir, 'package-lock.json'), 'utf8'))
  for (const [location, entry] of Object.entries(lock.packages)) {
    writeJson(join(dir, location, 'package.json'), { version: entry.version })
  }
}
const options = (dir, install = installFixture) => ({ projectDir: dir, install, log: () => {} })

test('check-only identifies the missing dependency without installing or recording success', (t) => {
  const dir = fixture(t)
  writeJson(join(dir, 'node_modules/vite/package.json'), { version: '5.4.21' })
  let calls = 0
  const result = ensureDependencies({ ...options(dir, () => calls++), checkOnly: true })
  assert.equal(result.ready, false)
  assert.equal(calls, 0)
  assert.ok(inspectDependencies(dir).packageProblems.includes('Missing dependency: snappyjs'))
  assert.equal(existsSync(stateFile(dir)), false)
})

test('a verified installation skips the next install, including in a path with spaces', (t) => {
  const dir = fixture(t)
  let calls = 0
  const install = () => { calls++; installFixture(dir) }
  assert.equal(ensureDependencies(options(dir, install)).installed, true)
  assert.deepEqual(ensureDependencies(options(dir, install)), { ready: true, installed: false })
  assert.equal(calls, 1)
})

test('a missing dependency invalidates an otherwise current marker', (t) => {
  const dir = fixture(t)
  ensureDependencies(options(dir))
  rmSync(join(dir, 'node_modules/snappyjs'), { recursive: true })
  assert.equal(ensureDependencies(options(dir)).installed, true)
  assert.equal(inspectDependencies(dir).reasons.length, 0)
})

test('a transitive lockfile change triggers synchronization even when direct versions match', (t) => {
  const dir = fixture(t)
  ensureDependencies(options(dir))
  const lockPath = join(dir, 'package-lock.json')
  const lock = JSON.parse(readFileSync(lockPath, 'utf8'))
  lock.packages['node_modules/transitive'].version = '2.0.0'
  writeJson(lockPath, lock)
  assert.equal(ensureDependencies(options(dir)).installed, true)
})

test('package.json changes also trigger synchronization', (t) => {
  const dir = fixture(t)
  ensureDependencies(options(dir))
  const manifestPath = join(dir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  manifest.dependencies.snappyjs = '0.7.0'
  writeJson(manifestPath, manifest)
  assert.equal(ensureDependencies(options(dir)).installed, true)
})

test('a wrong installed version is repaired despite a current marker', (t) => {
  const dir = fixture(t)
  ensureDependencies(options(dir))
  writeJson(join(dir, 'node_modules/snappyjs/package.json'), { version: '0.6.0' })
  assert.equal(ensureDependencies(options(dir)).installed, true)
  assert.equal(inspectDependencies(dir).reasons.length, 0)
})

test('installation failure never records success', (t) => {
  const dir = fixture(t)
  assert.throws(() => ensureDependencies(options(dir, () => { throw new Error('network unavailable') })), /network unavailable/)
  assert.equal(existsSync(stateFile(dir)), false)
})

test('an installer reporting success with a dependency still missing is rejected', (t) => {
  const dir = fixture(t)
  ensureDependencies(options(dir))
  rmSync(join(dir, 'node_modules/snappyjs'), { recursive: true })
  assert.throws(() => ensureDependencies(options(dir, () => {})), /installation is incomplete.*snappyjs/)
  assert.equal(ensureDependencies({ ...options(dir), checkOnly: true }).ready, false)
})

test('dependency files changing during installation are not recorded as verified', (t) => {
  const dir = fixture(t)
  assert.throws(() => ensureDependencies(options(dir, () => {
    installFixture(dir)
    const manifestPath = join(dir, 'package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    manifest.description = 'changed during installation'
    writeJson(manifestPath, manifest)
  })), /changed during installation/)
  assert.equal(existsSync(stateFile(dir)), false)
})

test('Windows install dispatch uses npm ci with dev dependencies and propagates failure', { skip: process.platform !== 'win32' }, (t) => {
  const dir = fixture(t)
  mkdirSync(join(dir, 'start'))
  copyFileSync(join(repoDir, 'start/ensure-dependencies.mjs'), join(dir, 'start/ensure-dependencies.mjs'))
  const fakeBin = join(dir, 'fake-bin')
  mkdirSync(fakeBin)
  writeFileSync(join(fakeBin, 'npm.cmd'), '@echo off\r\necho %*>"%~dp0npm-args.txt"\r\nexit /b 1\r\n')
  const env = { ...process.env }
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') || 'Path'
  env[pathKey] = fakeBin + ';' + env[pathKey]
  const result = spawnSync(process.execPath, [join(dir, 'start/ensure-dependencies.mjs')], { env, encoding: 'utf8' })
  assert.equal(result.status, 1)
  assert.match(result.stderr, /npm ci failed/)
  assert.equal(readFileSync(join(fakeBin, 'npm-args.txt'), 'utf8').trim(), 'ci --include=dev')
  assert.equal(existsSync(stateFile(dir)), false)
})

test('both Windows launchers stop before opening the website when the dependency check fails', { skip: process.platform !== 'win32' }, (t) => {
  for (const name of ['Start-Project.bat', 'Start-Remote-D1-Website.bat']) {
    const dir = fixture(t)
    const startDir = join(dir, 'start')
    mkdirSync(startDir)
    copyFileSync(join(repoDir, 'start', name), join(startDir, name))
    writeFileSync(join(startDir, 'ensure-dependencies.mjs'), 'process.exit(1)\n')
    const result = spawnSync(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', name], {
      cwd: startDir, input: '\r\n', encoding: 'utf8', timeout: 10000
    })
    assert.equal(result.status, 1, result.stdout + result.stderr)
    assert.match(result.stdout, /Website startup stopped/)
    assert.doesNotMatch(result.stdout, /Starting local website/)
  }
})
