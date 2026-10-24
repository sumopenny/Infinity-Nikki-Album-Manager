import type { ErrorEventPayload } from '../../../src/utils/errorReporting/schema'
export function sampleEvent(): ErrorEventPayload {
  return {
    schemaVersion: 1,
    eventId: '12345678-1234-4234-9234-123456789012',
    occurredAt: 1000,
    module: 'camera-favorites',
    action: 'save',
    stage: 'decode',
    code: 'IMAGE_DECODE_FAILED',
    type: 'business',
    handled: true,
    severity: 'error',
    build: {
      buildId: 'build-abc',
      appVersion: 'v2.1.2',
      gitCommit: 'abcdef',
      builtAt: '2026-10-24T00:00:00Z',
      environment: 'production',
      dirty: false
    },
    error: {
      name: 'InvalidStateError',
      message: 'The source image could not be decoded.',
      stack: 'Error: decode\n at decode (https://example.com/assets/index-abc.js:1:200)',
      causes: []
    },
    pagePath: '/',
    device: { userAgent: 'QQBrowser/19.3.0.1 Windows NT 10.0', model: 'test-device' },
    runtime: {},
    network: {},
    storage: {},
    context: { mimeType: 'image/webp', sizeBytes: 2048 },
    breadcrumbs: [
      { at: 900, category: 'image', name: 'decode', data: { decoder: 'createImageBitmap' } }
    ],
    truncated: []
  }
}
