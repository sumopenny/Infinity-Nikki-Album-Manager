import { afterEach, describe, expect, it, vi } from 'vitest'
import { createErrorReporter } from '../../../src/utils/errorReporting/errorReporter'
import {
  fetchPearpalSnapshot,
  PEARPAL_AUTH_FAILED
} from '../../../src/utils/resonance/resonanceImport'
import type { ErrorEventPayload } from '../../../src/utils/errorReporting/schema'
import { sampleEvent } from './fixture'

const credentials = { token: 'private-test-token', id: 'private-test-id', roleid: '123456' }
const headers = { 'cache-control': 'no-store', 'X-Request-Id': 'verification-fixture' }
afterEach(() => vi.unstubAllGlobals())
function reporter() {
  const events: ErrorEventPayload[] = []
  const instance = createErrorReporter({
    enabled: true,
    build: sampleEvent().build,
    environment: () => ({ device: {}, runtime: {}, network: {}, storage: {} }),
    transport: async (_input, init) => {
      const event = JSON.parse(String(init?.body)) as ErrorEventPayload
      events.push(event)
      return Response.json({ accepted: true, eventId: event.eventId }, { status: 201 })
    }
  })
  return { instance, events }
}
async function captureFailure(responses: Response[], region: 'cn' | 'asia' = 'cn') {
  const fetchMock = vi.fn<typeof fetch>(async () => responses.shift()!)
  vi.stubGlobal('fetch', fetchMock)
  let failure: unknown
  try {
    await fetchPearpalSnapshot(credentials, undefined, region)
  } catch (error) {
    failure = error
  }
  expect(failure).toBeInstanceOf(Error)
  const { instance, events } = reporter()
  instance.report(failure, { module: 'data-import', action: 'preview', stage: 'source' })
  await instance.flush()
  expect(events).toHaveLength(1)
  expect(instance.snapshot().lastDelivery?.outcome).toBe('accepted')
  const serialized = JSON.stringify(events[0])
  for (const secret of [
    credentials.token,
    credentials.id,
    credentials.roleid,
    '654321',
    'response-private-secret'
  ])
    expect(serialized).not.toContain(secret)
  return { event: events[0], failure, fetchMock }
}
describe('Pearpal failures reach the reporter with precise, safe context', () => {
  it.each([
    [{ code: 1801 }, 'PEARPAL_SESSION_EXPIRED'],
    [{ code: 999 }, 'PEARPAL_RESPONSE_CODE_INVALID'],
    [{ code: 0 }, 'PEARPAL_ROLE_MISSING'],
    [{ code: 0, data: { role: {} } }, 'PEARPAL_UID_MISSING'],
    [null, 'PEARPAL_RESPONSE_INVALID'],
    [[], 'PEARPAL_RESPONSE_INVALID'],
    [{ data: {} }, 'PEARPAL_RESPONSE_INVALID']
  ])('classifies response %j as %s', async (payload, code) => {
    const { event, failure, fetchMock } = await captureFailure([
      Response.json(payload, { headers })
    ])
    expect((failure as Error).message).toBe(PEARPAL_AUTH_FAILED)
    expect(event.code).toBe(code)
    expect(event.stage).toBe('verify')
    expect(event.context).toMatchObject({
      httpStatus: 200,
      requestId: 'verification-fixture',
      region: 'cn'
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it('records UID and server mismatches as warnings without retaining either UID', async () => {
    for (const [uid, zone, code] of [
      ['654321', 4, 'PEARPAL_UID_MISMATCH'],
      ['123456', 6, 'PEARPAL_REGION_MISMATCH']
    ] as const) {
      const { event } = await captureFailure(
        [Response.json({ code: 0, data: { role: { uid, zone_id: zone } } }, { headers })],
        'asia'
      )
      expect(event.code).toBe(code)
      expect(event.severity).toBe('warning')
      expect(event.context.expectedZoneId).toBe(4)
    }
  })
  it('identifies expiry between verification and notebook retrieval', async () => {
    const { event, fetchMock } = await captureFailure([
      Response.json({ code: 0, data: { role: { uid: '123456', zone_id: 1 } } }, { headers }),
      Response.json({ code: 1801 }, { headers })
    ])
    expect(event.code).toBe('PEARPAL_SESSION_EXPIRED')
    expect(event.stage).toBe('snapshot')
    expect(event.severity).toBe('warning')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
  it('retains HTTP status and request correlation for upstream proxy failures', async () => {
    const { event } = await captureFailure([
      Response.json({ error: 'upstream_unavailable' }, { status: 502, headers })
    ])
    expect(event.code).toBe('PEARPAL_HTTP_ERROR')
    expect(event.severity).toBe('error')
    expect(event.context.httpStatus).toBe(502)
  })
  it('does not retain a malformed JSON response snippet', async () => {
    const { event } = await captureFailure([
      new Response('response-private-secret not json', { headers })
    ])
    expect(event.code).toBe('PEARPAL_RESPONSE_INVALID')
    expect(event.context.parseErrorName).toBe('SyntaxError')
  })
  it('annotates notebook decompression rather than blaming credentials', async () => {
    const { event } = await captureFailure([
      Response.json({ code: 0, data: { role: { uid: '123456', zone_id: 1 } } }, { headers }),
      new Response(new Uint8Array([1, 2, 3]), { headers })
    ])
    expect(event.code).toBe('PEARPAL_NOTEBOOK_DECODE_FAILED')
    expect(event.stage).toBe('snapshot-decode')
    expect(event.severity).toBe('error')
  })
  it('keeps user cancellation silent', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const { instance, events } = reporter()
    try {
      await fetchPearpalSnapshot(credentials, controller.signal)
    } catch (error) {
      expect(instance.report(error, { module: 'data-import', action: 'preview' })).toBeNull()
    }
    await instance.flush()
    expect(events).toHaveLength(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
