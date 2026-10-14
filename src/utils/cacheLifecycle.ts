// A clear invalidates old producers before draining their already-started writes.
let generation = 0
const writes = new Set<Promise<unknown>>()
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
  await Promise.allSettled([...writes])
}
