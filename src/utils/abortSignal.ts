/** AbortSignal.throwIfAborted is unavailable in some embedded browsers. */
export function throwIfSignalAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return
  throw signal.reason ?? new DOMException('The operation was aborted', 'AbortError')
}
