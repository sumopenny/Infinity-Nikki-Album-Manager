import { describe, expect, it } from 'vitest'
import type { PhotoItem } from '../../src/utils/photoGrouping'
import { exportPhotos, importPhotos } from '../../src/utils/file-system/photoTransfer'

class TestFileHandle implements FileSystemFileHandle {
  readonly kind = 'file' as const
  private data: Blob
  constructor(public readonly name: string, data = new Blob(['x'], { type: 'image/jpeg' }), private readonly fail = false) { this.data = data }
  async isSameEntry(other: FileSystemHandle): Promise<boolean> { return other === this }
  async getFile(): Promise<File> { if (this.fail) throw new Error('read failed'); return new File([this.data], this.name, { type: this.data.type, lastModified: 1 }) }
  async createWritable(): Promise<FileSystemWritableFileStream> {
    return { write: async (value: Blob | BufferSource | string) => { this.data = value instanceof Blob ? value : new Blob([value]) }, close: async () => undefined, abort: async () => undefined } as FileSystemWritableFileStream
  }
}

class TestDirectory implements FileSystemDirectoryHandle {
  readonly kind = 'directory' as const
  readonly files = new Map<string, TestFileHandle>()
  constructor(public readonly name: string) {}
  async isSameEntry(other: FileSystemHandle): Promise<boolean> { return other === this }
  async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> { for (const [name, handle] of this.files) yield [name, handle as unknown as FileSystemHandle] }
  values(): AsyncIterableIterator<FileSystemHandle> { return this.entriesAsValues() }
  private async *entriesAsValues() { for await (const [, handle] of this.entries()) yield handle }
  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> { const existing = this.files.get(name); if (existing) return existing; if (!options?.create) throw new DOMException('missing', 'NotFoundError'); const handle = new TestFileHandle(name); this.files.set(name, handle); return handle }
  async getDirectoryHandle(): Promise<FileSystemDirectoryHandle> { throw new DOMException('missing', 'NotFoundError') }
  async removeEntry(name: string): Promise<void> { this.files.delete(name) }
  async resolve(): Promise<string[] | null> { return null }
}

function photo(directory: TestDirectory, name: string, timestamp: number, fail = false): PhotoItem {
  const handle = new TestFileHandle(name, undefined, fail)
  directory.files.set(name, handle)
  return { id: name, name, url: null, fileSizeText: '1 B', fileSize: 1, lastModified: 1, fileHandle: handle, directoryHandle: directory, note: '', dateKey: '2026-01-01', year: '2026', monthDay: '01月01日', displayDate: '2026年01月01日', timeText: '00:00', timestamp }
}

describe('photo transfer', () => {
  it('imports supported files and allocates duplicate names', async () => {
    const directory = new TestDirectory('album')
    directory.files.set('a.jpg', new TestFileHandle('a.jpg'))
    const result = await importPhotos(directory, [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.png', { type: 'image/png' }), new File(['x'], 'note.txt')])
    expect(result.succeeded).toBe(2)
    expect([...directory.files.keys()]).toEqual(expect.arrayContaining(['a.jpg', 'a_imported_1.jpg', 'b.png']))
  })

  it('exports concurrently and keeps successful files when cancelled', async () => {
    const source = new TestDirectory('source')
    const target = new TestDirectory('target')
    const controller = new AbortController()
    const result = await exportPhotos([photo(source, '1.jpg', 1), photo(source, '2.jpg', 2), photo(source, '3.jpg', 3)], target, {
      concurrency: 8,
      signal: controller.signal,
      onProgress: (progress) => { if (progress.completed === 1) controller.abort() }
    })
    expect(result.cancelled).toBe(true)
    expect(result.succeeded).toBeGreaterThanOrEqual(1)
    expect(target.files.size).toBe(result.succeeded)
  })
})
