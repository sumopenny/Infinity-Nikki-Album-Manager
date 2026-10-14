import { getCurrentScope, onScopeDispose } from 'vue'

/** 为每次读取分配版本与中止信号；旧任务的成功、失败和收尾都必须验证当前版本。 */
export function useLatestRequest() {
  let controller: AbortController | null = null
  let version = 0
  function invalidate() {
    version++
    controller?.abort()
    controller = null
  }
  function begin() {
    invalidate()
    controller = new AbortController()
    const current = version
    const signal = controller.signal
    return { signal, isCurrent: () => current === version && !signal.aborted }
  }
  if (getCurrentScope()) onScopeDispose(invalidate)
  return { begin, invalidate }
}
