import { diagnosticObject } from './schema'

interface HintNavigator extends Navigator {
  deviceMemory?: number
  connection?: {
    effectiveType?: string
    type?: string
    rtt?: number
    downlink?: number
    saveData?: boolean
  }
  userAgentData?: {
    brands?: Array<{ brand: string; version: string }>
    mobile?: boolean
    platform?: string
    getHighEntropyValues?: (keys: string[]) => Promise<Record<string, unknown>>
  }
}
let hints: Record<string, unknown> = { status: 'not-requested' }
let storage: Record<string, unknown> = { status: 'not-requested' }
let started = false
/** 只查询能力，不打开、创建或读取任何 IndexedDB 数据库。 */
export function prepareDiagnosticEnvironment() {
  if (started || typeof navigator === 'undefined') return
  started = true
  const nav = navigator as HintNavigator
  const bounded = async (task: () => Promise<unknown>) => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        task(),
        new Promise((resolve) => {
          timer = setTimeout(() => resolve({ status: 'timeout' }), 500)
        })
      ])
    } catch {
      return { status: 'unavailable' }
    } finally {
      clearTimeout(timer)
    }
  }
  hints = { status: nav.userAgentData?.getHighEntropyValues ? 'pending' : 'unsupported' }
  if (nav.userAgentData?.getHighEntropyValues)
    void bounded(() =>
      nav.userAgentData!.getHighEntropyValues!([
        'architecture',
        'bitness',
        'model',
        'platformVersion',
        'fullVersionList',
        'wow64'
      ])
    ).then((value) => {
      hints = diagnosticObject(value)
    })
  storage = { status: typeof nav.storage?.estimate === 'function' ? 'pending' : 'unsupported' }
  if (typeof nav.storage?.estimate === 'function')
    void bounded(() => nav.storage.estimate()).then((value) => {
      storage = { ...diagnosticObject(value), measuredAt: Date.now() }
    })
}
export function collectDiagnosticEnvironment() {
  if (typeof navigator === 'undefined' || typeof window === 'undefined')
    return { device: {}, runtime: {}, network: {}, storage: {} }
  const nav = navigator as HintNavigator
  const ua = nav.userAgent
  const match =
    ua.match(/(?:QQBrowser|EdgA?|EdgiOS|Firefox|FxiOS|CriOS|Chrome|Version)\/[\d.]+/g) ?? []
  const browser =
    match.find((part) => /QQBrowser|Edg|Firefox|FxiOS/.test(part)) ??
    match.find((part) => /Chrome|CriOS/.test(part)) ??
    match[0] ??
    'unknown'
  const os =
    ua.match(
      /Windows NT [\d.]+|Android [\d.]+|(?:CPU (?:iPhone )?OS|iPhone OS) [\d_]+|Mac OS X [\d_]+|Linux/
    )?.[0] ?? 'unknown'
  const connection = nav.connection
  return {
    device: diagnosticObject({
      userAgent: ua,
      browserDetected: browser,
      osDetected: os,
      detection: 'best-effort-UA',
      userAgentBrands: nav.userAgentData?.brands ?? null,
      clientHints: hints,
      deviceType: /iPad|Tablet/i.test(ua)
        ? 'tablet'
        : /Mobile|iPhone|Android/i.test(ua)
          ? 'mobile'
          : 'desktop-or-unknown',
      platform: nav.platform,
      vendor: nav.vendor,
      logicalProcessors: nav.hardwareConcurrency ?? null,
      approximateMemoryGB: nav.deviceMemory ?? null,
      maxTouchPoints: nav.maxTouchPoints,
      language: nav.language,
      languages: [...nav.languages],
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      screen: {
        width: screen.width,
        height: screen.height,
        availableWidth: screen.availWidth,
        availableHeight: screen.availHeight,
        colorDepth: screen.colorDepth
      },
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scale: window.visualViewport?.scale ?? null
      },
      pixelRatio: window.devicePixelRatio
    }),
    runtime: diagnosticObject({
      secureContext: window.isSecureContext,
      visibility: document.visibilityState,
      theme: document.documentElement.dataset.theme ?? null,
      createImageBitmap: typeof createImageBitmap === 'function',
      webAssembly: typeof WebAssembly !== 'undefined',
      cryptoRandomUUID: typeof globalThis.crypto?.randomUUID === 'function',
      cryptoSubtle: !!globalThis.crypto?.subtle,
      indexedDBApi: typeof indexedDB !== 'undefined',
      fileSystemAccess: 'showDirectoryPicker' in window
    }),
    network: diagnosticObject({
      online: nav.onLine,
      effectiveType: connection?.effectiveType ?? null,
      type: connection?.type ?? null,
      rtt: connection?.rtt ?? null,
      downlink: connection?.downlink ?? null,
      saveData: connection?.saveData ?? null
    }),
    storage: diagnosticObject(storage)
  }
}
