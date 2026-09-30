import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEmptyHomeSchemeMetadata,
  deleteHomeSchemeTag,
  readHomeSchemeLibrary,
  saveHomeScheme,
  saveHomeSchemeTags
} from '../../src/utils/homeBuild/homeSchemeFileSystem'

class MemoryFileHandle {
  readonly kind = 'file' as const
  contents = new Blob()
  constructor(readonly name: string) {}
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
    let next = new Blob()
    return {
      write: async (value: Blob | string | BufferSource) => {
        next = value instanceof Blob ? value : new Blob([value as BlobPart])
      },
      close: async () => { this.contents = next },
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

describe('home scheme filesystem', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => 'blob:scheme') })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  })

  it('persists a scheme and tags, then rejects duplicate codes', async () => {
    const album = new MemoryDirectoryHandle('album')
    await saveHomeSchemeTags(albumHandle(album), ['室外'])
    const item = await saveHomeScheme(albumHandle(album), {
      code: '1UDB66QH', name: '花园', schemeType: 'home', tags: ['室外'], note: '春日',
      metadata: createEmptyHomeSchemeMetadata()
    }, [])
    expect((await readHomeSchemeLibrary(albumHandle(album))).schemes[0]).toMatchObject({
      code: '1UDB66QH', name: '花园', tags: ['室外'], image: null
    })
    await expect(saveHomeScheme(albumHandle(album), {
      code: item.code, name: '重复', schemeType: 'home', tags: [], note: '',
      metadata: createEmptyHomeSchemeMetadata()
    }, [item])).rejects.toThrow('home_scheme_code_duplicate')
  })

  it('removes a deleted tag from records while preserving schemes', async () => {
    const album = new MemoryDirectoryHandle('album')
    await saveHomeSchemeTags(albumHandle(album), ['室外'])
    const item = await saveHomeScheme(albumHandle(album), {
      code: '1UDB66QH', name: '花园', schemeType: 'home', tags: ['室外'], note: '',
      metadata: createEmptyHomeSchemeMetadata()
    }, [])
    const result = await deleteHomeSchemeTag(albumHandle(album), [item], '室外')
    expect(result).toMatchObject({ tags: [], updatedCount: 1 })
    expect((await readHomeSchemeLibrary(albumHandle(album))).schemes[0].tags).toEqual([])
  })
})
