import { collectDiagnosticEnvironment, prepareDiagnosticEnvironment } from './environment'
import {
  MAX_ERROR_BYTES,
  MAX_BREADCRUMBS,
  byteLength,
  clipText,
  diagnosticObject,
  diagnosticText,
  fingerprintInput,
  isExpectedError,
  serializeError,
  validateErrorPayload,
  type Breadcrumb,
  type BuildInfo,
  type ErrorEventPayload,
  type ErrorMetadata
} from './schema'

const annotations = new WeakMap<object, Partial<ErrorMetadata>>()
/** 底层只补充上下文；上层最终失败时上报，避免把成功降级也记成错误。 */
export function annotateDiagnosticError<T>(error: T, metadata: Partial<ErrorMetadata>): T {
  try {
    if (error && typeof error === 'object') {
      const previous = annotations.get(error) ?? {}
      annotations.set(error, {
        ...previous,
        ...metadata,
        context: { ...previous.context, ...metadata.context }
      })
    }
  } catch {
    /* 诊断不能改变异常。 */
  }
  return error
}
export function diagnosticId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') return crypto.randomUUID()
  const bytes = new Uint8Array(16)
  if (typeof globalThis.crypto?.getRandomValues === 'function') crypto.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return [...bytes].map((value) => value.toString(16).padStart(2, '0')).join('')
}
export interface ReporterOptions {
  enabled: boolean
  build: BuildInfo
  environment?: () => ReturnType<typeof collectDiagnosticEnvironment>
  transport?: typeof fetch
  now?: () => number
  pagePath?: () => string
}
export function createErrorReporter(options: ReporterOptions) {
  let enabled = options.enabled
  const now = options.now ?? Date.now
  const crumbs: Breadcrumb[] = []
  const queue: ErrorEventPayload[] = []
  const seen = new WeakSet<object>()
  const recent = new Map<string, number>()
  let sent: number[] = [],
    pauseUntil = 0,
    suppressed = 0
  let pending: Promise<void> | undefined
  let controller: AbortController | undefined
  let currentModule = 'application'
  function breadcrumb(category: string, name: string, data: Record<string, unknown> = {}) {
    if (!enabled) return
    try {
      crumbs.push({
        at: now(),
        category: diagnosticText(category, 40),
        name: diagnosticText(name, 96),
        data: diagnosticObject(data)
      })
      if (crumbs.length > MAX_BREADCRUMBS) crumbs.shift()
    } catch {
      /* no-op */
    }
  }
  async function transmit(event: ErrorEventPayload) {
    for (let attempt = 0; attempt < 2 && enabled; attempt++) {
      controller = new AbortController()
      let timer: ReturnType<typeof setTimeout> | undefined
      try {
        const transport = options.transport ?? globalThis.fetch
        const response = await Promise.race([
          transport('/api/errors', {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'X-Error-Report': '1' },
            body: JSON.stringify(event),
            credentials: 'omit',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            signal: controller.signal
          }),
          new Promise<never>((_, reject) => {
            timer = setTimeout(() => {
              controller?.abort()
              reject(new Error('REPORT_TIMEOUT'))
            }, 5000)
          })
        ])
        if (response.ok) return
        if (response.status === 429 || response.status === 503) {
          pauseUntil = now() + 60000
          queue.length = 0
          return
        }
        if (response.status < 500) return
      } catch {
        /* 不递归上报，不显示第二条错误通知。 */
      } finally {
        clearTimeout(timer)
      }
    }
  }
  function flush(): Promise<void> {
    if (pending) return pending
    pending = (async () => {
      while (enabled && queue.length && now() >= pauseUntil) {
        const event = queue.shift()!
        await transmit(event)
      }
    })()
      .catch(() => {})
      .finally(() => {
        pending = undefined
        if (enabled && queue.length && now() >= pauseUntil) void flush()
      })
    return pending
  }
  function report(error: unknown, metadata: Partial<ErrorMetadata> = {}): string | null {
    if (!enabled || now() < pauseUntil) return null
    try {
      if (isExpectedError(error)) return null
      let prior: unknown = error
      for (let i = 0; i < 6 && prior && typeof prior === 'object'; i++) {
        if (seen.has(prior)) return null
        prior = (prior as { cause?: unknown }).cause
      }
      const annotation = error && typeof error === 'object' ? annotations.get(error) : undefined
      const info = { ...annotation, ...metadata }
      const stamp = now()
      sent = sent.filter((at) => stamp - at < 60000)
      if (sent.length >= 20 || queue.length >= 10) {
        suppressed++
        return null
      }
      const environment = (options.environment ?? collectDiagnosticEnvironment)()
      const event: ErrorEventPayload = {
        schemaVersion: 1,
        eventId: diagnosticId(),
        occurredAt: stamp,
        module: info.module ?? currentModule,
        action: info.action ?? 'unhandled',
        stage: info.stage ?? '',
        code: info.code ?? '',
        type: info.type ?? 'business',
        severity: info.severity ?? 'error',
        handled: info.handled ?? true,
        build: options.build,
        error: serializeError(error),
        pagePath: clipText(
          (
            options.pagePath?.() ?? (typeof location === 'undefined' ? '/' : location.pathname)
          ).split(/[?#]/)[0],
          256
        ),
        ...environment,
        context: diagnosticObject({
          ...annotation?.context,
          ...metadata.context,
          suppressedSincePrevious: suppressed
        }),
        breadcrumbs: [...crumbs],
        truncated: []
      }
      if (
        [
          event.error.message,
          event.error.stack,
          ...event.error.causes.map((value) => value.stack)
        ].some((value) => value.includes('[truncated]'))
      )
        event.truncated.push('error')
      const fingerprint = fingerprintInput(event)
      if (stamp - (recent.get(fingerprint) ?? -Infinity) < 10000) {
        suppressed++
        return null
      }
      while (byteLength(JSON.stringify(event)) > MAX_ERROR_BYTES && event.breadcrumbs.length) {
        event.breadcrumbs.shift()
        if (!event.truncated.includes('breadcrumbs')) event.truncated.push('breadcrumbs')
      }
      if (byteLength(JSON.stringify(event)) > MAX_ERROR_BYTES) {
        event.context = { stage: event.stage }
        event.truncated.push('context')
      }
      if (byteLength(JSON.stringify(event)) > MAX_ERROR_BYTES) return null
      const clean = validateErrorPayload(event)
      recent.set(fingerprint, stamp)
      if (recent.size > 100) recent.delete(recent.keys().next().value!)
      // 标记整条 cause 链，避免同一异常经 Vue、Promise、业务边界重复上传。
      let current: unknown = error
      for (let i = 0; i < 6 && current && typeof current === 'object'; i++) {
        if (seen.has(current)) break
        seen.add(current)
        current = (current as { cause?: unknown }).cause
      }
      sent.push(stamp)
      suppressed = 0
      queue.push(clean)
      void flush()
      return clean.eventId
    } catch {
      return null
    }
  }
  return {
    report,
    breadcrumb,
    flush,
    setModule(value: string) {
      currentModule = value
      breadcrumb('navigation', 'module-enter', { module: value })
    },
    setEnabled(value: boolean) {
      enabled = value
      if (!value) {
        queue.length = 0
        crumbs.length = 0
        controller?.abort()
      }
    }
  }
}
const fallbackBuild: BuildInfo = {
  buildId: 'development',
  appVersion: 'unknown',
  gitCommit: '',
  builtAt: '',
  environment: 'development',
  dirty: true
}
export const diagnosticsConfigured =
  import.meta.env.PROD && import.meta.env.VITE_ERROR_REPORTING_ENABLED === 'true'
const preferenceKey = 'nikki-diagnostics-disabled'
export function diagnosticsAllowed(): boolean {
  try {
    return localStorage.getItem(preferenceKey) !== '1'
  } catch {
    return true
  }
}
const reporter = createErrorReporter({
  enabled: diagnosticsConfigured && diagnosticsAllowed(),
  build: typeof __ERROR_BUILD__ === 'undefined' ? fallbackBuild : __ERROR_BUILD__
})
export function setDiagnosticsAllowed(value: boolean) {
  try {
    localStorage.setItem(preferenceKey, value ? '0' : '1')
  } catch {
    /* session still applies */
  }
  reporter.setEnabled(diagnosticsConfigured && value)
  if (diagnosticsConfigured && value) prepareDiagnosticEnvironment()
}
export const reportError = reporter.report
export const trackDiagnostic = reporter.breadcrumb
export const setDiagnosticModule = reporter.setModule
export const flushDiagnostics = reporter.flush
export function initializeDiagnosticEnvironment() {
  if (diagnosticsConfigured && diagnosticsAllowed()) prepareDiagnosticEnvironment()
}
