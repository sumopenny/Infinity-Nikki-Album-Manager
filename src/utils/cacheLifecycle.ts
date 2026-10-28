// A clear invalidates old producers before draining their already-started writes.
let generation = 0
const writes = new Set<Promise<unknown>>()
const resets = new Map<string, () => void>()
/** 惰性模块只注册自身内存清理，清缓存不需要反向加载尚未使用的模块。 */
export function registerCacheReset(name: string, reset: () => void): void {
  resets.set(name, reset)
}
export const cacheGeneration = () => generation
export const isCurrentCacheGeneration = (value: number) => value === generation
export async function persistCacheIfCurrent(
  value: number,
  action: () => Promise<void>
): Promise<void> {
  if (!isCurrentCacheGeneration(value)) return
  const pending = action()
  writes.add(pending)
  try {
    await pending
  } finally {
    writes.delete(pending)
  }
}
export async function invalidateCacheWrites(): Promise<void> {
  generation += 1
  for (const reset of resets.values()) reset()
  await Promise.allSettled([...writes])
}
