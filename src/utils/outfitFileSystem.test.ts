import { beforeAll, describe, expect, it, vi } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import {
  importOutfitBackup,
  deleteOutfit,
  isReservedOutfitTag,
  isSafeOutfitArchivePath,
  isValidOutfitTag,
  normalizeOutfitCode,
  readOutfitLibrary,
  saveOutfit,
  saveOutfitTags
} from './outfitFileSystem'

function readBlob(blob: Blob, mode: 'buffer' | 'text'): Promise<ArrayBuffer | string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(reader.result as ArrayBuffer | string)
    mode === 'buffer' ? reader.readAsArrayBuffer(blob) : reader.readAsText(blob)
  })
}

function browserFile(parts: BlobPart[], name: string, options?: FilePropertyBag): File {
  const file = new File(parts, name, options)
  Object.defineProperties(file, {
    arrayBuffer: { value: () => readBlob(file, 'buffer') as Promise<ArrayBuffer> },
    text: { value: () => readBlob(file, 'text') as Promise<string> }
  })
  return file
}

class MemoryFileHandle {
  readonly kind = 'file' as const

  constructor(public readonly name: string, public contents: Blob = new Blob()) {}

  async getFile(): Promise<File> {
    return browserFile([this.contents], this.name, { type: this.contents.type, lastModified: Date.now() })
  }

  async createWritable(): Promise<FileSystemWritableFileStream> {
    return {
      write: async (data: BufferSource | Blob | string) => {
        this.contents = data instanceof Blob ? data : new Blob([data])
      },
      close: async () => undefined,
      abort: async () => undefined
    } as FileSystemWritableFileStream
  }
}

class MemoryDirectoryHandle {
  readonly kind = 'directory' as const
  readonly files = new Map<string, MemoryFileHandle>()
  readonly directories = new Map<string, MemoryDirectoryHandle>()
  failJsonWrites = false
  failTagsWrites = false
  failRemoveName: string | null = null

  constructor(public readonly name: string) {}

  async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    for (const entry of this.files) yield entry as unknown as [string, FileSystemHandle]
    for (const entry of this.directories) yield entry as unknown as [string, FileSystemHandle]
  }

  async *values(): AsyncIterableIterator<FileSystemHandle> {
    for await (const [, handle] of this.entries()) yield handle
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> {
    const existing = this.files.get(name)
    if (existing) return existing as unknown as FileSystemFileHandle
    if (!options?.create) throw new DOMException('Missing file', 'NotFoundError')
    const created = new MemoryFileHandle(name)
    if ((this.failJsonWrites && name.endsWith('.json') && name !== 'tags.json') || (this.failTagsWrites && name === 'tags.json')) {
      created.createWritable = async () => ({
        write: async () => { throw new Error('JSON write failed') },
        close: async () => undefined,
        abort: async () => undefined
      }) as unknown as FileSystemWritableFileStream
    }
    this.files.set(name, created)
    return created as unknown as FileSystemFileHandle
  }

  async getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle> {
    const existing = this.directories.get(name)
    if (existing) return existing as unknown as FileSystemDirectoryHandle
    if (!options?.create) throw new DOMException('Missing directory', 'NotFoundError')
    const created = new MemoryDirectoryHandle(name)
    this.directories.set(name, created)
    return created as unknown as FileSystemDirectoryHandle
  }

  async removeEntry(name: string): Promise<void> {
    if (name === this.failRemoveName) throw new Error('Remove failed')
    if (!this.files.delete(name) && !this.directories.delete(name)) throw new DOMException('Missing entry', 'NotFoundError')
  }

  async resolve(): Promise<string[] | null> {
    return null
  }
}

function asDirectory(value: MemoryDirectoryHandle): FileSystemDirectoryHandle {
  return value as unknown as FileSystemDirectoryHandle
}

function backupFile(outfits: unknown[], extraFiles: Record<string, Uint8Array> = {}): File {
  const manifest = {
    format: 'infinity-nikki-outfit-backup',
    version: 1,
    exportedAt: '2026-07-31T00:00:00.000Z',
    tags: ['甜美'],
    outfits
  }
  const bytes = zipSync({ 'manifest.json': strToU8(JSON.stringify(manifest)), ...extraFiles })
  return browserFile([bytes], 'backup.zip', { type: 'application/zip' })
}

beforeAll(() => {
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 100, height: 140, close: () => undefined })))
})

describe('outfit filesystem', () => {
  it('normalizes code whitespace and enforces the fallback limit', () => {
    expect(normalizeOutfitCode(' 1x Z\nua\tWPoXrU# ')).toBe('1xZuaWPoXrU#')
    expect(normalizeOutfitCode('x'.repeat(40))).toHaveLength(30)
  })

  it('rejects reserved tags and unsafe archive paths', () => {
    expect(isReservedOutfitTag('全部')).toBe(true)
    expect(isReservedOutfitTag('Pending')).toBe(true)
    expect(isSafeOutfitArchivePath('images/outfit.webp')).toBe(true)
    expect(isSafeOutfitArchivePath('../outfit.webp')).toBe(false)
    expect(isSafeOutfitArchivePath('images\\outfit.webp')).toBe(false)
  })

  it('allows five-character tags and rejects longer tags', () => {
    expect(isValidOutfitTag('12345')).toBe(true)
    expect(isValidOutfitTag('123456')).toBe(false)
  })

  it('saves a pending outfit with at most one known tag', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    await saveOutfitTags(asDirectory(album), ['甜美'])
    const saved = await saveOutfit(asDirectory(album), {
      imageFile: browserFile([new Blob(['webp'], { type: 'image/webp' })], 'look.webp', { type: 'image/webp' }),
      code: '  ',
      tag: '不存在'
    })

    expect(saved.code).toBe('')
    expect(saved.tags).toEqual([])
    expect(album.directories.get('clothe')?.files.has(`${saved.id}.webp`)).toBe(true)
    expect(album.directories.get('clothe')?.files.has(`${saved.id}.json`)).toBe(true)
  })

  it('imports an external WebP and removes the source only after image and JSON are valid', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const clothe = new MemoryDirectoryHandle('clothe')
    clothe.files.set('new-look.webp', new MemoryFileHandle('new-look.webp', new Blob(['webp'], { type: 'image/webp' })))
    album.directories.set('clothe', clothe)

    const result = await readOutfitLibrary(asDirectory(album))

    expect(result.importedExternalCount).toBe(1)
    expect(result.outfits).toHaveLength(1)
    expect(result.outfits[0]).toMatchObject({ code: '', tags: [] })
    expect(clothe.files.has('new-look.webp')).toBe(false)
  })

  it('rejects unsupported ZIP content before creating the clothe directory', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const file = backupFile([], { 'images/payload.html': strToU8('<script></script>') })

    await expect(importOutfitBackup(asDirectory(album), file)).rejects.toThrow('unsupported file')
    expect(album.directories.has('clothe')).toBe(false)
  })

  it('removes a newly written image when its metadata write fails during import', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const clothe = new MemoryDirectoryHandle('clothe')
    clothe.failJsonWrites = true
    album.directories.set('clothe', clothe)
    const file = backupFile([
      { id: 'look-1', image: 'images/look-1.webp', code: '', tags: [], createdAt: '2026-07-31T00:00:00.000Z' }
    ], { 'images/look-1.webp': strToU8('webp') })

    const result = await importOutfitBackup(asDirectory(album), file)

    expect(result.failedCount).toBe(1)
    expect(clothe.files.has('look-1.webp')).toBe(false)
    expect(clothe.files.has('look-1.json')).toBe(false)
  })

  it('rolls back imported files when the final tag commit fails', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const clothe = new MemoryDirectoryHandle('clothe')
    const tagsFile = new MemoryFileHandle('tags.json', new Blob([JSON.stringify(['鐢滅編'])], { type: 'application/json' }))
    tagsFile.createWritable = async () => ({
      write: async () => { throw new Error('JSON write failed') },
      close: async () => undefined,
      abort: async () => undefined
    }) as unknown as FileSystemWritableFileStream
    clothe.files.set('tags.json', tagsFile)
    clothe.failTagsWrites = true
    album.directories.set('clothe', clothe)
    const file = backupFile([
      { id: 'look-1', image: 'images/look-1.webp', code: '', tags: ['新标签'], createdAt: '2026-07-31T00:00:00.000Z' }
    ], { 'images/look-1.webp': strToU8('webp') })

    await expect(importOutfitBackup(asDirectory(album), file)).rejects.toThrow('JSON write failed')
    expect(clothe.files.has('look-1.webp')).toBe(false)
    expect(clothe.files.has('look-1.json')).toBe(false)
  })

  it('restores both files when outfit deletion cannot remove the image', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const saved = await saveOutfit(asDirectory(album), {
      imageFile: browserFile([new Blob(['webp'], { type: 'image/webp' })], 'look.webp', { type: 'image/webp' }),
      code: 'ABC',
      tag: null
    })
    const clothe = album.directories.get('clothe')!
    clothe.failRemoveName = saved.image

    await expect(deleteOutfit(saved)).rejects.toThrow()
    expect(clothe.files.has(saved.image)).toBe(true)
    expect(clothe.files.has(saved.metadataName)).toBe(true)
  })
})
