// 相册图片传输：负责批量导入、并发导出、重名分配和可取消进度。
import type { PhotoItem } from '../photoGrouping'
import { runWithConcurrency } from '../concurrency'

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

export interface PreparedPhotoImport { kind: 'import'; jobs: Array<{ file: File; name: string }> }
export interface PreparedPhotoExport { kind: 'export'; jobs: Array<{ photo: PhotoItem; name: string }> }
export type PhotoTransferRequest = { kind: 'import'; files: File[] } | { kind: 'export'; photos: PhotoItem[] }
export type PreparedPhotoTransfer = PreparedPhotoImport | PreparedPhotoExport

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

function report(options: PhotoTransferOptions, state: PhotoTransferProgress): void {
  options.onProgress?.({ ...state, failedNames: [...state.failedNames] })
}

/** 枚举相册现有文件并为待导入图片分配目标文件名。 */
async function preparePhotoImport(directory: FileSystemDirectoryHandle, files: File[]): Promise<PreparedPhotoImport> {
  const candidates = files.filter((file) => isImageFileName(file.name))
  const occupied = await listFileNames(directory)
  return { kind: 'import', jobs: candidates.map((file) => ({ file, name: allocateName(file.name, occupied, '_imported') })) }
}

/** 执行已准备好的图片导入任务。 */
async function runPhotoImport(
  directory: FileSystemDirectoryHandle,
  prepared: PreparedPhotoImport,
  options: PhotoTransferOptions = {}
): Promise<PhotoImportResult> {
  const state: PhotoImportResult = { completed: 0, total: prepared.jobs.length, succeeded: 0, failedNames: [], cancelled: false, importedNames: [] }
  report(options, state)
  await runWithConcurrency(prepared.jobs, async ({ file, name }) => {
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
  }, { concurrency: options.concurrency ?? PHOTO_IMPORT_CONCURRENCY, signal: options.signal })
  state.cancelled = Boolean(options.signal?.aborted)
  return state
}

/** 枚举目标目录并预先分配全部导出文件名。 */
async function preparePhotoExport(photos: PhotoItem[], directory: FileSystemDirectoryHandle): Promise<PreparedPhotoExport> {
  const occupied = await listFileNames(directory)
  const sorted = [...photos].sort((left, right) => left.timestamp - right.timestamp || left.name.localeCompare(right.name))
  return { kind: 'export', jobs: sorted.map((photo) => ({ photo, name: allocateName(photo.name, occupied, '_exported') })) }
}

/** 并发执行已准备好的导出任务；取消只停止尚未开始的任务。 */
async function runPhotoExport(
  directory: FileSystemDirectoryHandle,
  prepared: PreparedPhotoExport,
  options: PhotoTransferOptions = {}
): Promise<PhotoExportResult> {
  const state: PhotoExportResult = { completed: 0, total: prepared.jobs.length, succeeded: 0, failedNames: [], cancelled: false, succeededPhotos: [] }
  report(options, state)
  await runWithConcurrency(prepared.jobs, async ({ photo, name }) => {
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
  }, { concurrency: options.concurrency ?? PHOTO_EXPORT_CONCURRENCY, signal: options.signal })
  state.cancelled = Boolean(options.signal?.aborted)
  return state
}

export function preparePhotoTransfer(directory: FileSystemDirectoryHandle, request: { kind: 'import'; files: File[] }): Promise<PreparedPhotoImport>
export function preparePhotoTransfer(directory: FileSystemDirectoryHandle, request: { kind: 'export'; photos: PhotoItem[] }): Promise<PreparedPhotoExport>
/** 枚举目标目录并准备导入或导出任务，执行阶段不再重复分配文件名。 */
export function preparePhotoTransfer(directory: FileSystemDirectoryHandle, request: PhotoTransferRequest): Promise<PreparedPhotoTransfer> {
  return request.kind === 'import'
    ? preparePhotoImport(directory, request.files)
    : preparePhotoExport(request.photos, directory)
}

export function runPhotoTransfer(directory: FileSystemDirectoryHandle, prepared: PreparedPhotoImport, options?: PhotoTransferOptions): Promise<PhotoImportResult>
export function runPhotoTransfer(directory: FileSystemDirectoryHandle, prepared: PreparedPhotoExport, options?: PhotoTransferOptions): Promise<PhotoExportResult>
/** 执行已准备的图片传输任务。 */
export function runPhotoTransfer(directory: FileSystemDirectoryHandle, prepared: PreparedPhotoTransfer, options: PhotoTransferOptions = {}): Promise<PhotoImportResult | PhotoExportResult> {
  return prepared.kind === 'import'
    ? runPhotoImport(directory, prepared, options)
    : runPhotoExport(directory, prepared, options)
}

export function isSupportedPhotoFile(file: File): boolean {
  return isImageFileName(file.name)
}
