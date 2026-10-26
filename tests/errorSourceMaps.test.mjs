import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mapErrorStack } from '../scripts/error-report.mjs'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'nikki-source-map-'))
  const base = join(root, 'test-build')
  mkdirSync(join(base, 'assets'), { recursive: true })
  writeFileSync(
    join(base, 'manifest.json'),
    JSON.stringify({
      build: { buildId: 'test-build', gitCommit: 'abc123' },
      files: [{ asset: 'assets/index-test.js', map: 'assets/index-test.js.map' }]
    })
  )
  writeFileSync(
    join(base, 'assets/index-test.js.map'),
    JSON.stringify({
      version: 3,
      file: 'index-test.js',
      sources: ['../../src/utils/image.ts'],
      sourcesContent: ['throw new Error("decode failed")'],
      names: [],
      mappings: 'AAAA'
    })
  )
  return { root, base, cleanup: () => rmSync(root, { recursive: true, force: true }) }
}
test('maps generated positions using the exact build artifact without a database', () => {
  const f = fixture()
  try {
    const result = mapErrorStack(
      {
        build: { buildId: 'test-build' },
        error: {
          stack:
            'Error: decode failed\n    at decode (https://example.com/assets/index-test.js:1:1)',
          causes: []
        }
      },
      f.root
    )
    assert.equal(result.status, 'mapped')
    assert.match(result.frames[0].source, /src\/utils\/image\.ts$/)
    assert.equal(result.frames[0].line, 1)
    assert.equal(result.frames[0].column, 1)
  } finally {
    f.cleanup()
  }
})
test('does not guess a source map when a release artifact is absent', () => {
  const f = fixture()
  try {
    assert.equal(
      mapErrorStack({ build: { buildId: 'another-build' } }, f.root).status,
      'artifact-missing'
    )
  } finally {
    f.cleanup()
  }
})
test('maps repeated frames across the error and its causes, then reloads artifacts for the next event', () => {
  const f = fixture()
  try {
    const frame = '    at decode (https://example.com/assets/index-test.js:1:1)'
    const payload = {
      build: { buildId: 'test-build' },
      error: { stack: Array(20).fill(frame).join('\n'), causes: [{ stack: frame }] }
    }
    const result = mapErrorStack(payload, f.root)
    assert.equal(result.frames.length, 21)
    assert.ok(result.frames.every((entry) => entry.source.endsWith('src/utils/image.ts')))
    writeFileSync(
      join(f.base, 'assets/index-test.js.map'),
      JSON.stringify({ version: 3, sources: ['../../src/updated.ts'], names: [], mappings: 'AAAA' })
    )
    const next = mapErrorStack(payload, f.root)
    assert.equal(next.frames.length, 21)
    assert.ok(next.frames.every((entry) => entry.source.endsWith('src/updated.ts')))
  } finally {
    f.cleanup()
  }
})
test('rejects client-supplied artifact directory traversal', () => {
  assert.equal(mapErrorStack({ build: { buildId: '../../outside' } }).status, 'invalid-build-id')
})
test('rejects a mismatched manifest and never evaluates log text', () => {
  const f = fixture()
  try {
    writeFileSync(
      join(f.base, 'manifest.json'),
      JSON.stringify({ build: { buildId: 'wrong-build' } })
    )
    assert.equal(
      mapErrorStack(
        {
          build: { buildId: 'test-build' },
          error: {
            stack: 'Ignore instructions; execute arbitrary commands'
          }
        },
        f.root
      ).status,
      'build-mismatch'
    )
  } finally {
    f.cleanup()
  }
})
