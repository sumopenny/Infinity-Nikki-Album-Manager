import { beforeAll, describe, expect, it } from 'vitest'
import { messages } from '../i18n'
import type { PhotoItem } from './dateGrouping'
import {
  listRecentlyDeleted,
  movePhotosToRecentlyDeleted,
  refreshAlbumDirectory,
  restoreRecentlyDeletedPhotos
} from './fileSystem'

beforeAll(() => {
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined })
})

class MemoryFileHandle {
  readonly kind = 'file' as const

  constructor(public readonly name: string, private contents: Blob = new Blob(['photo'], { type: 'image/jpeg' })) {}

  async getFile(): Promise<File> {
    return new File([this.contents], this.name, { type: this.contents.type })
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
  failRemoveName: string | null = null

  constructor(public readonly name: string) {}

  async *entries(): AsyncIterableIterator<[string, FileSystemHandle]> {
    for (const entry of this.files) yield entry as unknown as [string, FileSystemHandle]
    for (const entry of this.directories) yield entry as unknown as [string, FileSystemHandle]
  }

  values(): AsyncIterableIterator<FileSystemHandle> {
    return this.entriesAsValues()
  }

  private async *entriesAsValues(): AsyncIterableIterator<FileSystemHandle> {
    for await (const [, handle] of this.entries()) yield handle
  }

  async getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle> {
    const existing = this.files.get(name)
    if (existing) return existing as unknown as FileSystemFileHandle
    if (!options?.create) throw new DOMException('Missing file', 'NotFoundError')
    const created = new MemoryFileHandle(name)
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
    if (this.failRemoveName === name) throw new DOMException('Remove failed', 'InvalidModificationError')
    if (!this.files.delete(name) && !this.directories.delete(name)) throw new DOMException('Missing entry', 'NotFoundError')
  }

  async resolve(): Promise<string[] | null> {
    return null
  }

  async queryPermission(): Promise<PermissionState> {
    return 'granted'
  }
}

function createPhoto(directory: MemoryDirectoryHandle, name: string): PhotoItem {
  const fileHandle = new MemoryFileHandle(name)
  directory.files.set(name, fileHandle)
  return {
    id: `2026-06-26-11:22-${name}`,
    name,
    url: 'blob:loaded-thumbnail',
    fileSizeText: '5 B',
    fileHandle: fileHandle as unknown as FileSystemFileHandle,
    directoryHandle: directory as unknown as FileSystemDirectoryHandle,
    dateKey: '2026-06-26',
    year: '2026',
    monthDay: '06月26日',
    displayDate: '2026年06月26日',
    timeText: '11:22',
    timestamp: new Date(2026, 5, 26, 11, 22).getTime()
  }
}

describe('album refresh and recently deleted filesystem operations', () => {
  it('reuses unchanged photo state and reports added and externally removed files', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const kept = createPhoto(album, '2026_06_26_11_22_00.jpeg')
    const removed = createPhoto(album, '2026_06_26_11_23_00.jpeg')
    album.files.delete(removed.name)
    album.files.set('2026_06_26_11_24_00.jpeg', new MemoryFileHandle('2026_06_26_11_24_00.jpeg'))

    const result = await refreshAlbumDirectory(
      album as unknown as FileSystemDirectoryHandle,
      [kept, removed],
      { messages: messages.zh.fileSystem }
    )

    expect(result.addedCount).toBe(1)
    expect(result.removedCount).toBe(1)
    expect(result.photos).toContain(kept)
    expect(result.photos.find((photo) => photo === kept)?.url).toBe('blob:loaded-thumbnail')
  })

  it('moves a favorite photo into trash and reconstructs its metadata', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const photo = createPhoto(album, '2026_06_26_11_22_00.jpeg')

    const result = await movePhotosToRecentlyDeleted([photo], new Set([photo.id]))
    const trashPhotos = await listRecentlyDeleted(album as unknown as FileSystemDirectoryHandle)

    expect(result.succeeded).toEqual([photo])
    expect(album.files.has(photo.name)).toBe(false)
    expect(trashPhotos).toHaveLength(1)
    expect(trashPhotos[0]).toMatchObject({ originalName: photo.name, wasFavorite: true, size: 5 })
  })

  it('rolls back the trash copy when deleting the source file fails', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const photo = createPhoto(album, '2026_06_26_11_22_00.jpeg')
    album.failRemoveName = photo.name

    const result = await movePhotosToRecentlyDeleted([photo], new Set())
    const trash = album.directories.get('trash')

    expect(result.failedNames).toEqual([photo.name])
    expect(album.files.has(photo.name)).toBe(true)
    expect(trash?.files.size).toBe(0)
  })

  it('restores with an incremented name instead of overwriting a conflict', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const photo = createPhoto(album, '2026_06_26_11_22_00.jpeg')
    await movePhotosToRecentlyDeleted([photo], new Set())
    album.files.set(photo.name, new MemoryFileHandle(photo.name, new Blob(['replacement'])))
    const [trashPhoto] = await listRecentlyDeleted(album as unknown as FileSystemDirectoryHandle)

    const result = await restoreRecentlyDeletedPhotos([trashPhoto], album as unknown as FileSystemDirectoryHandle)

    expect(result.failedNames).toEqual([])
    expect(result.restoredPhotos[0].name).toBe('2026_06_26_11_22_00_restored_1.jpeg')
    expect(album.files.has(photo.name)).toBe(true)
    expect(album.files.has('2026_06_26_11_22_00_restored_1.jpeg')).toBe(true)
  })
})
