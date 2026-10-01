import { beforeEach, describe, expect, it, vi } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { exportHomeSchemeBackup, importHomeSchemeBackup } from '../../src/utils/homeBuild/homeSchemeBackup'
import { saveHomeScheme, saveHomeSchemeTags } from '../../src/utils/homeBuild/homeSchemeFileSystem'
import { createEmptyHomeSchemeMetadata } from '../../src/utils/homeBuild/homeSchemeFileSystem'

class MemoryFileHandle {
  readonly kind = 'file' as const

  constructor(readonly name: string, public contents = new Blob()) {}

  async getFile(): Promise<File> {
    const file = new File([this.contents], this.name)
    Object.defineProperty(file, 'text', { value: () => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsText(this.contents)
    }) })
    return file
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    const chunks: BlobPart[] = []
    return {
      write: async (value: Blob | string | BufferSource) => { chunks.push(value as BlobPart) },
      close: async () => { this.contents = new Blob(chunks) },
      abort: async () => undefined
    } as FileSystemWritableFileStream
  }
}

class MemoryDirectoryHandle {
  readonly kind = 'directory' as const
  readonly files = new Map<string, MemoryFileHandle>()
  readonly directories = new Map<string, MemoryDirectoryHandle>()

  constructor(readonly name: string) {}

  async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    for (const [name, handle] of this.files) yield [name, handle as unknown as FileSystemHandle]
    for (const [name, handle] of this.directories) yield [name, handle as unknown as FileSystemHandle]
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> {
    let handle = this.files.get(name)
    if (!handle && options?.create) { handle = new MemoryFileHandle(name); this.files.set(name, handle) }
    if (!handle) throw new DOMException('Missing file', 'NotFoundError')
    return handle as unknown as FileSystemFileHandle
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle> {
    let handle = this.directories.get(name)
    if (!handle && options?.create) { handle = new MemoryDirectoryHandle(name); this.directories.set(name, handle) }
    if (!handle) throw new DOMException('Missing directory', 'NotFoundError')
    return handle as unknown as FileSystemDirectoryHandle
  }

  async removeEntry(name: string): Promise<void> {
    if (!this.files.delete(name) && !this.directories.delete(name)) throw new DOMException('Missing entry', 'NotFoundError')
  }
}

const albumHandle = (directory: MemoryDirectoryHandle) => directory as unknown as FileSystemDirectoryHandle

function streamedFile(bytes: Uint8Array): File {
  let consumed = false
  const file = new Blob([bytes]) as File
  Object.defineProperties(file, {
    name: { value: 'backup.zip' },
    stream: { value: () => ({ getReader: () => ({
      read: async () => {
        if (consumed) return { done: true, value: undefined }
        consumed = true
        return { done: false, value: bytes }
      },
      cancel: async () => { consumed = true },
      releaseLock: () => undefined
    }) }) }
  })
  return file
}

function readBlobBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:scheme') })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})

function archiveFile(entries: Record<string, Uint8Array>): File {
  const bytes = zipSync(entries)
  let consumed = false
  const file = new Blob([bytes]) as File
  Object.defineProperties(file, {
    name: { value: 'backup.zip' },
    stream: { value: () => ({ getReader: () => ({
      read: async () => {
        if (consumed) return { done: true, value: undefined }
        consumed = true
        return { done: false, value: bytes }
      },
      cancel: async () => { consumed = true },
      releaseLock: () => undefined
    }) }) }
  })
  return file
}

describe('home scheme ZIP backup validation', () => {
  it('rejects path traversal entries before accessing the album', async () => {
    const file = archiveFile({ '../manifest.json': strToU8('{}') })
    const album = {} as FileSystemDirectoryHandle

    await expect(importHomeSchemeBackup(album, file)).rejects.toThrow('home_scheme_backup_path_invalid')
  })

  it('does not accept an outfit backup manifest as a home scheme archive', async () => {
    const manifest = { format: 'infinity-nikki-outfit-backup', version: 1, tags: [], homeSchemes: [] }
    const file = archiveFile({ 'manifest.json': strToU8(JSON.stringify(manifest)) })
    const album = {} as FileSystemDirectoryHandle

    await expect(importHomeSchemeBackup(album, file)).rejects.toThrow('home_scheme_backup_format_unsupported')
  })

  it('streams an export and restores metadata and timestamps on import', async () => {
    const source = new MemoryDirectoryHandle('source')
    await saveHomeSchemeTags(albumHandle(source), ['庭院'])
    const saved = await saveHomeScheme(albumHandle(source), {
      code: '1UDB66QH',
      name: '花园',
      schemeType: 'home',
      tags: ['庭院'],
      note: '春日',
      metadata: {
        ...createEmptyHomeSchemeMetadata(),
        version: '2.10',
        furnitureCount: 7,
        server: 49,
        lastModifyTime: 123,
        coverImageUrl: 'https://example.test/cover.webp'
      }
    }, [])

    const target = new MemoryDirectoryHandle('target')
    const result = await exportHomeSchemeBackup(albumHandle(source), albumHandle(target))
    expect(result.count).toBe(1)
    const backupName = [...target.files.keys()].find((name) => name.endsWith('.zip'))
    expect(backupName).toBeTruthy()
    const archiveBytes = await readBlobBytes(target.files.get(backupName!)!.contents)
    const entries = unzipSync(archiveBytes)
    const manifest = JSON.parse(strFromU8(entries['manifest.json'])) as { homeSchemes: Array<Record<string, unknown>> }
    expect(manifest.homeSchemes[0]).toMatchObject({
      id: saved.id,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      metadata: saved.metadata
    })

    const restored = new MemoryDirectoryHandle('restored')
    const imported = await importHomeSchemeBackup(albumHandle(restored), streamedFile(archiveBytes))
    expect(imported.schemes[0]).toMatchObject({
      id: saved.id,
      code: saved.code,
      name: saved.name,
      createdAt: saved.createdAt,
      updatedAt: saved.updatedAt,
      metadata: saved.metadata
    })
  })
})
