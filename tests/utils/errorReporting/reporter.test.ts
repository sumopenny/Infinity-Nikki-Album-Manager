import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  annotateDiagnosticError,
  createErrorReporter
} from '../../../src/utils/errorReporting/errorReporter'
import type { ErrorEventPayload } from '../../../src/utils/errorReporting/schema'

function setup(statuses = [201], enabled = true) {
  const payloads: ErrorEventPayload[] = []
  const transport = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    payloads.push(JSON.parse(String(init?.body)))
    return new Response('{}', { status: statuses.shift() ?? 201 })
  })
  let time = 1000
  const reporter = createErrorReporter({
    enabled,
    transport: transport as typeof fetch,
    now: () => time,
    pagePath: () => '/app?token=secret',
    build: {
      buildId: 'test-build',
      appVersion: 'v2.1.2',
      gitCommit: 'abc',
      builtAt: '',
      environment: 'test',
      dirty: false
    },
    environment: () => ({
      device: { userAgent: 'QQBrowser/19.3' },
      runtime: {},
      network: {},
      storage: {}
    })
  })
  return {
    reporter,
    transport,
    payloads,
    advance: (ms: number) => {
      time += ms
    }
  }
}
afterEach(() => vi.useRealTimers())
describe('in-memory error reporter', () => {
  it('does nothing when disabled', async () => {
    const { reporter, transport } = setup([], false)
    expect(reporter.report(new Error('x'), { module: 'test', action: 'save' })).toBeNull()
    await reporter.flush()
    expect(transport).not.toHaveBeenCalled()
  })
  it('retains details and sends no credentials or URL query', async () => {
    const { reporter, transport, payloads } = setup()
    const error = annotateDiagnosticError(new Error('decode failed'), {
      stage: 'decode',
      context: { mimeType: 'image/webp', sizeBytes: 222 }
    })
    const id = reporter.report(error, { module: 'camera', action: 'save' })
    await reporter.flush()
    expect(payloads[0].eventId).toBe(id)
    expect(payloads[0].stage).toBe('decode')
    expect(payloads[0].error.stack).toContain('decode failed')
    expect(payloads[0].context.mimeType).toBe('image/webp')
    expect(payloads[0].pagePath).toBe('/app')
    expect(transport.mock.calls[0][1]?.credentials).toBe('omit')
  })
  it('suppresses the same Error object across capture boundaries', async () => {
    const { reporter, transport } = setup(),
      error = new Error('one failure')
    reporter.report(error, { module: 'test', action: 'save' })
    expect(reporter.report(error, { type: 'promise', action: 'unhandled' })).toBeNull()
    await reporter.flush()
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('suppresses a wrapper around an already reported cause', async () => {
    const { reporter, transport } = setup(),
      error = new Error('root')
    reporter.report(error, { module: 'test', action: 'save' })
    expect(
      reporter.report(new Error('wrapper', { cause: error }), {
        type: 'promise',
        action: 'unhandled'
      })
    ).toBeNull()
    await reporter.flush()
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('keeps only 30 bounded breadcrumbs', async () => {
    const { reporter, payloads } = setup()
    for (let i = 0; i < 50; i++)
      reporter.breadcrumb('operation', 'step', { index: i, token: 'secret' })
    reporter.report(new Error('failure'), { module: 'test', action: 'save' })
    await reporter.flush()
    expect(payloads[0].breadcrumbs).toHaveLength(30)
    expect(payloads[0].breadcrumbs[0].data).toEqual({ index: 20 })
  })
  it('retries at most once using the identical event ID', async () => {
    const { reporter, payloads, transport } = setup([500, 201])
    reporter.report(new Error('failure'), { module: 'test', action: 'save' })
    await reporter.flush()
    expect(transport).toHaveBeenCalledTimes(2)
    expect(payloads[0]).toEqual(payloads[1])
  })
  it('does not retry permanent validation errors', async () => {
    const { reporter, transport } = setup([400])
    reporter.report(new Error('failure'), { module: 'test', action: 'save' })
    await reporter.flush()
    expect(transport).toHaveBeenCalledTimes(1)
  })
  it('pauses on missing backend or rate limiting', async () => {
    const { reporter, transport, advance } = setup([503, 201])
    reporter.report(new Error('first'), { module: 'test', action: 'save' })
    await reporter.flush()
    expect(reporter.report(new Error('second'), { module: 'test', action: 'save' })).toBeNull()
    advance(61000)
    expect(reporter.report(new Error('third'), { module: 'test', action: 'save' })).not.toBeNull()
    await reporter.flush()
    expect(transport).toHaveBeenCalledTimes(2)
  })
  it('does not report user cancellations', async () => {
    const { reporter, transport } = setup()
    reporter.report(new DOMException('cancelled', 'AbortError'), { module: 'test', action: 'save' })
    reporter.report(new Error('MISSING_CREDENTIALS'), { module: 'test', action: 'save' })
    await reporter.flush()
    expect(transport).not.toHaveBeenCalled()
  })
  it('limits a page to 20 reports per minute', async () => {
    const { reporter, transport } = setup()
    for (let i = 0; i < 25; i++) {
      reporter.report(new Error('failure ' + i), { module: 'test', action: 'save-' + i })
      await reporter.flush()
    }
    expect(transport).toHaveBeenCalledTimes(20)
  })
  it('cannot throw back into the business operation', async () => {
    const { reporter } = setup()
    const error = {
      get name() {
        throw new Error('bad getter')
      }
    }
    expect(() => reporter.report(error, { module: 'test', action: 'save' })).not.toThrow()
    await expect(reporter.flush()).resolves.toBeUndefined()
  })
  it('opt-out immediately stops future reports', async () => {
    const { reporter, transport } = setup()
    reporter.setEnabled(false)
    reporter.report(new Error('failure'), { module: 'test', action: 'save' })
    await reporter.flush()
    expect(transport).not.toHaveBeenCalled()
  })
})
