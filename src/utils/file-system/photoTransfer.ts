// 相册图片传输：负责批量导入、并发导出、重名分配和可取消进度。
import type { PhotoItem } from '../photoGrouping'

export const PHOTO_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'])
export const PHOTO_IMPORT_CONCURRENCY = 3
export const PHOTO_EXPORT_CONCURRENCY = 8

export interface PhotoTransferProgress {
  completed: number
  total: number
  succeeded: number
  failedNames: string[]
  cancelled: boolean
}

export interface PhotoImportResult extends PhotoTransferProgress {
  importedNames: string[]
}

export interface PhotoExportResult extends PhotoTransferProgress {
  succeededPhotos: PhotoItem[]
}

export interface PhotoTransferOptions {
  signal?: AbortSignal
  concurrency?: number
  onProgress?: (progress: PhotoTransferProgress) => void
}

function isImageFileName(name: string): boolean {
  return PHOTO_IMAGE_EXTENSIONS.has(name.split('.').pop()?.toLowerCase() ?? '')
}

function splitFileName(name: string): { base: string; extension: string } {
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return { base: name, extension: '' }
  return { base: name.slice(0, dot), extension: name.slice(dot) }
}

function safeFileName(name: string): string {
  const cleaned = name.replace(/[\\/\0]/g, '_').trim()
  return cleaned || 'imported-image'
}

function allocateName(preferred: string, occupied: Set<string>, suffix: string): string {
  const clean = safeFileName(preferred)
  if (!occupied.has(clean)) {
    occupied.add(clean)
    return clean
  }
  const { base, extension } = splitFileName(clean)
  let index = 1
  let candidate = `${base}${suffix}_${index}${extension}`
  while (occupied.has(candidate)) candidate = `${base}${suffix}_${++index}${extension}`
  occupied.add(candidate)
  return candidate
}

async function listFileNames(directory: FileSystemDirectoryHandle): Promise<Set<string>> {
  const names = new Set<string>()
  for await (const [name, handle] of directory.entries()) {
    if (handle.kind === 'file') names.add(name)
  }
  return names
}

async function writeFile(directory: FileSystemDirectoryHandle, name: string, source: File): Promise<void> {
  const handle = await directory.getFileHandle(name, { create: true })
  let writable: FileSystemWritableFileStream | null = null
  try {
    writable = await handle.createWritable()
    await writable.write(source)
    await writable.close()
  } catch (error) {
    await writable?.abort(error).catch(() => undefined)
    await directory.removeEntry(name).catch(() => undefined)
    throw error
  }
}

async function copyPhoto(directory: FileSystemDirectoryHandle, name: string, photo: PhotoItem): Promise<void> {
  const source = await photo.fileHandle.getFile()
  await writeFile(directory, name, source)
}

async function runWorkers<T>(items: T[], worker: (item: T) => Promise<void>, concurrency: number): Promise<void> {
  let nextIndex = 0
  const run = async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++
      await worker(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(Math.max(1, concurrency), items.length || 1) }, run))
}

function report(options: PhotoTransferOptions, state: PhotoTransferProgress): void {
  options.onProgress?.({ ...state, failedNames: [...state.failedNames] })
}

/** 将文件选择器选中的图片复制到当前相册目录。 */
export async function importPhotos(
  directory: FileSystemDirectoryHandle,
  files: File[],
  options: PhotoTransferOptions = {}
): Promise<PhotoImportResult> {
  const candidates = files.filter((file) => isImageFileName(file.name))
  const occupied = await listFileNames(directory)
  const jobs = candidates.map((file) => ({ file, name: allocateName(file.name, occupied, '_imported') }))
  const state: PhotoImportResult = { completed: 0, total: jobs.length, succeeded: 0, failedNames: [], cancelled: false, importedNames: [] }
  report(options, state)
  await runWorkers(jobs, async ({ file, name }) => {
    if (options.signal?.aborted) {
      state.cancelled = true
      state.completed += 1
      report(options, state)
      return
    }
    try {
      await writeFile(directory, name, file)
      state.succeeded += 1
      state.importedNames.push(name)
    } catch {
      state.failedNames.push(file.name)
    } finally {
      state.completed += 1
      report(options, state)
    }
  }, options.concurrency ?? PHOTO_IMPORT_CONCURRENCY)
  return state
}

/** 并发导出照片；取消只停止尚未开始的任务，已开始的单文件写入会完成。 */
export async function exportPhotos(
  photos: PhotoItem[],
  directory: FileSystemDirectoryHandle,
  options: PhotoTransferOptions = {}
): Promise<PhotoExportResult> {
  const occupied = await listFileNames(directory)
  const sorted = [...photos].sort((left, right) => left.timestamp - right.timestamp || left.name.localeCompare(right.name))
  const jobs = sorted.map((photo) => ({ photo, name: allocateName(photo.name, occupied, '_exported') }))
  const state: PhotoExportResult = { completed: 0, total: jobs.length, succeeded: 0, failedNames: [], cancelled: false, succeededPhotos: [] }
  report(options, state)
  await runWorkers(jobs, async ({ photo, name }) => {
    if (options.signal?.aborted) {
      state.cancelled = true
      state.completed += 1
      report(options, state)
      return
    }
    try {
      await copyPhoto(directory, name, photo)
      state.succeeded += 1
      state.succeededPhotos.push(photo)
    } catch {
      state.failedNames.push(photo.name)
    } finally {
      state.completed += 1
      report(options, state)
    }
  }, options.concurrency ?? PHOTO_EXPORT_CONCURRENCY)
  if (options.signal?.aborted) state.cancelled = true
  return state
}

export function isSupportedPhotoFile(file: File): boolean {
  return isImageFileName(file.name)
}
