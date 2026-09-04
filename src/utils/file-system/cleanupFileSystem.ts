// 专项清理文件系统：负责收集、统计并执行低画质图片、日志、崩溃和网页缓存清理。
import { runWithConcurrency } from '../concurrency'
const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'])
const LOW_QUALITY_DIRECTORY_NAME = 'NikkiPhotos_LowQuality'
const SCREENSHOT_DIRECTORY_NAME = 'ScreenShot'
const FILE_DELETE_CONCURRENCY = 10

interface RelatedPhotoCleanupTarget { directoryName: string; directoryHandle: FileSystemDirectoryHandle; photoNames: string[] }
export type SpecialCleanupItem = 'lowQuality' | 'crashes' | 'logs' | 'webcache'
export interface SpecialCleanupDirectoryTarget { directoryName: string; directoryHandle: FileSystemDirectoryHandle; entries: Array<{ name: string; bytes: number; fileCount: number; sizeKnown: boolean }> }
export interface SpecialCleanupPlan { item: SpecialCleanupItem; fileCount: number; totalBytes: number; totalBytesKnown: boolean; photoTargets: RelatedPhotoCleanupTarget[]; directoryTargets: SpecialCleanupDirectoryTarget[]; missingDirectories: string[] }
export type RelatedCleanupFailureReason = 'unreadable-size' | 'remove-failed'
export interface RelatedPhotoCleanupResult { deletedCount: number; deletedBytes: number; failures: Array<{ path: string; reason: RelatedCleanupFailureReason }>; missingDirectories: string[] }

function isImageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(fileName.split('.').pop()?.toLowerCase() ?? '')
}

function isMissingDirectoryError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError'
}

async function getRequiredNestedDirectory(
  rootHandle: FileSystemDirectoryHandle,
  segments: string[]
): Promise<FileSystemDirectoryHandle> {
  let current = rootHandle
  for (const segment of segments) {
    current = await current.getDirectoryHandle(segment)
  }
  return current
}
async function collectCleanupTarget(
  directoryName: string,
  getDirectoryHandle: () => Promise<FileSystemDirectoryHandle>,
  targets: RelatedPhotoCleanupTarget[],
  missingDirectories: string[]
): Promise<void> {
  try {
    const directoryHandle = await getDirectoryHandle()
    const photoNames: string[] = []

    for await (const [name, handle] of directoryHandle.entries()) {
      if (handle.kind === 'file' && isImageFile(name)) photoNames.push(name)
    }

    targets.push({ directoryName, directoryHandle, photoNames })
  } catch (error) {
    if (!isMissingDirectoryError(error)) throw error
    // 多账号场景下同目录名只记录一次，避免重复提示。
    if (!missingDirectories.includes(directoryName)) missingDirectories.push(directoryName)
  }
}

/** 递归统计单个文件或目录条目的字节数和文件数；大小读取失败的文件仍计入文件数。 */
async function sumEntrySize(handle: FileSystemFileHandle | FileSystemDirectoryHandle): Promise<{ bytes: number; fileCount: number; sizeKnown: boolean }> {
  if (handle.kind === 'file') {
    try {
      const file = await (handle as FileSystemFileHandle).getFile()
      return { bytes: file.size, fileCount: 1, sizeKnown: true }
    } catch {
      // Deletion is still allowed by product design; only the size estimate is unknown.
      return { bytes: 0, fileCount: 1, sizeKnown: false }
    }
  }

  let bytes = 0
  let fileCount = 0
  let sizeKnown = true
  const children: Array<FileSystemFileHandle | FileSystemDirectoryHandle> = []
  for await (const [, childHandle] of (handle as FileSystemDirectoryHandle).entries()) {
    children.push(childHandle as FileSystemFileHandle | FileSystemDirectoryHandle)
  }
  const childSums = await runWithConcurrency(children, sumEntrySize, { concurrency: 6 })
  for (const childSum of childSums) {
    bytes += childSum.bytes
    fileCount += childSum.fileCount
    sizeKnown = sizeKnown && childSum.sizeKnown
  }
  return { bytes, fileCount, sizeKnown }
}

/** 收集目录类清理目标：枚举目录内全部顶层条目并统计容量；目录不存在时记入缺失列表。 */
async function collectDirectoryCleanupTarget(
  directoryName: string,
  getDirectoryHandle: () => Promise<FileSystemDirectoryHandle>,
  targets: SpecialCleanupDirectoryTarget[],
  missingDirectories: string[]
): Promise<void> {
  try {
    const directoryHandle = await getDirectoryHandle()
    const entries: SpecialCleanupDirectoryTarget['entries'] = []

    for await (const [name, handle] of directoryHandle.entries()) {
      const { bytes, fileCount, sizeKnown } = await sumEntrySize(handle as FileSystemFileHandle | FileSystemDirectoryHandle)
      entries.push({ name, bytes, fileCount, sizeKnown })
    }

    targets.push({ directoryName, directoryHandle, entries })
  } catch (error) {
    if (!isMissingDirectoryError(error)) throw error
    if (!missingDirectories.includes(directoryName)) missingDirectories.push(directoryName)
  }
}

/** 目录类专项清理项对应的目录名与相对 X6Game 的路径。 */
const SPECIAL_CLEANUP_DIRECTORY_PATHS: Record<Exclude<SpecialCleanupItem, 'lowQuality'>, { name: string; segments: string[] }> = {
  crashes: { name: 'Crashes', segments: ['Saved', 'Crashes'] },
  logs: { name: 'Logs', segments: ['Saved', 'Logs'] },
  webcache: { name: 'webcache_4430', segments: ['Saved', 'webcache_4430'] }
}

/**
 * 构建专项清理计划。
 * 参数：x6GameHandle 为已授权的 X6Game 目录，item 为清理项，accountIds 为低画质项的目标账号 id 列表。
 * 返回：清理目标、文件数、预估释放字节数和缺失目录。
 */
export async function prepareSpecialCleanup(
  x6GameHandle: FileSystemDirectoryHandle,
  item: SpecialCleanupItem,
  accountIds: string[] = []
): Promise<SpecialCleanupPlan> {
  const photoTargets: RelatedPhotoCleanupTarget[] = []
  const directoryTargets: SpecialCleanupDirectoryTarget[] = []
  const missingDirectories: string[] = []

  if (item === 'lowQuality') {
    for (const accountId of accountIds) {
      await collectCleanupTarget(
        LOW_QUALITY_DIRECTORY_NAME,
        () => getRequiredNestedDirectory(x6GameHandle, ['Saved', 'GamePlayPhotos', accountId, LOW_QUALITY_DIRECTORY_NAME]),
        photoTargets,
        missingDirectories
      )
    }
    await collectCleanupTarget(
      SCREENSHOT_DIRECTORY_NAME,
      () => x6GameHandle.getDirectoryHandle(SCREENSHOT_DIRECTORY_NAME),
      photoTargets,
      missingDirectories
    )
  } else {
    const target = SPECIAL_CLEANUP_DIRECTORY_PATHS[item]
    await collectDirectoryCleanupTarget(
      target.name,
      () => getRequiredNestedDirectory(x6GameHandle, target.segments),
      directoryTargets,
      missingDirectories
    )
  }

  const fileCount = item === 'lowQuality'
    ? photoTargets.reduce((count, target) => count + target.photoNames.length, 0)
    : directoryTargets.reduce((count, target) => count + target.entries.reduce((sum, entry) => sum + entry.fileCount, 0), 0)
  const totalBytes = directoryTargets.reduce(
    (sum, target) => sum + target.entries.reduce((entrySum, entry) => entrySum + entry.bytes, 0),
    0
  )
  const totalBytesKnown = directoryTargets.every((target) => target.entries.every((entry) => entry.sizeKnown))

  return { item, fileCount, totalBytes, totalBytesKnown, photoTargets, directoryTargets, missingDirectories }
}

/**
 * 执行专项清理，并只累计实际成功删除的文件容量。
 * 参数：plan 为已确认的清理计划；目录类清理会保留目录本身，只删除目录内的条目。
 * 返回：成功数量、释放字节数、结构化失败原因和缺失目录。
 */
export async function executeSpecialCleanup(plan: SpecialCleanupPlan): Promise<RelatedPhotoCleanupResult> {
  type CleanupTask =
    | { kind: 'photo'; target: RelatedPhotoCleanupTarget; name: string }
    | { kind: 'entry'; target: SpecialCleanupDirectoryTarget; name: string; bytes: number; fileCount: number }
  const tasks: CleanupTask[] = []
  for (const target of plan.photoTargets) {
    for (const name of target.photoNames) tasks.push({ kind: 'photo', target, name })
  }
  for (const target of plan.directoryTargets) {
    for (const entry of target.entries) tasks.push({ kind: 'entry', target, name: entry.name, bytes: entry.bytes, fileCount: entry.fileCount })
  }

  const results = await runWithConcurrency(tasks, async (task) => {
    const path = `${task.target.directoryName}\\${task.name}`
    if (task.kind === 'entry') {
      try {
        await task.target.directoryHandle.removeEntry(task.name, { recursive: true })
        return { deletedCount: task.fileCount, deletedBytes: task.bytes, failure: null }
      } catch {
        return { deletedCount: 0, deletedBytes: 0, failure: { path, reason: 'remove-failed' as const } }
      }
    }

    let fileSize: number
    try {
      const fileHandle = await task.target.directoryHandle.getFileHandle(task.name)
      fileSize = (await fileHandle.getFile()).size
    } catch {
      return { deletedCount: 0, deletedBytes: 0, failure: { path, reason: 'unreadable-size' as const } }
    }
    try {
      await task.target.directoryHandle.removeEntry(task.name)
      return { deletedCount: 1, deletedBytes: fileSize, failure: null }
    } catch {
      return { deletedCount: 0, deletedBytes: 0, failure: { path, reason: 'remove-failed' as const } }
    }
  }, { concurrency: FILE_DELETE_CONCURRENCY })

  const deletedCount = results.reduce((sum, result) => sum + result.deletedCount, 0)
  const deletedBytes = results.reduce((sum, result) => sum + result.deletedBytes, 0)
  const failures = results.flatMap((result) => result.failure ? [result.failure] : [])

  return {
    deletedCount,
    deletedBytes,
    failures,
    missingDirectories: plan.missingDirectories
  }
}
