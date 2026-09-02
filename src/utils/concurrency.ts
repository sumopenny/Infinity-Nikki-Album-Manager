export interface ConcurrencyOptions<T, R> {
  concurrency: number
  signal?: AbortSignal
  onItemComplete?: (item: T, index: number, result: R) => void
}

/**
 * 以固定并发数处理任务；取消后不再分派新任务，已开始任务仍会正常收尾。
 * 返回结果保持输入顺序；业务层可在 worker 内隔离单项异常。
 */
export async function runWithConcurrency<T, R>(
  items: readonly T[],
  worker: (item: T, index: number) => Promise<R>,
  options: ConcurrencyOptions<T, R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  const completed = new Array<boolean>(items.length).fill(false)
  let nextIndex = 0
  const runWorker = async () => {
    while (nextIndex < items.length && !options.signal?.aborted) {
      const index = nextIndex++
      const result = await worker(items[index], index)
      results[index] = result
      completed[index] = true
      options.onItemComplete?.(items[index], index, result)
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, Math.floor(options.concurrency)), items.length) }, runWorker))
  return results.filter((_, index) => completed[index])
}
