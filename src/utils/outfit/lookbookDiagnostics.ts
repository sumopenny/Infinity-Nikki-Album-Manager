/** 会话内按需启用；仅输出阶段耗时和状态，不记录分享码、原始正文或部件数据。 */
export function lookbookTiming(
  stage: string,
  started: number,
  details: Record<string, string | number | null> = {}
): void {
  try {
    if (
      typeof sessionStorage === 'undefined' ||
      sessionStorage.getItem('nikki-lookbook-diagnostics') !== '1'
    )
      return
    console.info('[lookbook-timing]', {
      stage,
      durationMs: Math.round((performance.now() - started) * 100) / 100,
      ...details
    })
  } catch {
    // 浏览器禁止会话存储或控制台输出时，诊断不能影响解析。
  }
}

/** 成功与失败均记录耗时，保持原始返回值和异常不变。 */
export async function measureLookbook<T>(stage: string, action: () => Promise<T>): Promise<T> {
  const started = performance.now()
  try {
    const value = await action()
    lookbookTiming(stage, started, { outcome: 'success' })
    return value
  } catch (error) {
    lookbookTiming(stage, started, { outcome: 'error' })
    throw error
  }
}
