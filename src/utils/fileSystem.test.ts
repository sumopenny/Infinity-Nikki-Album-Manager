import { beforeAll, describe, expect, it } from 'vitest'
import { messages } from '../i18n'
import type { PhotoItem } from './dateGrouping'
import {
  listRecentlyDeleted,
  movePhotosToRecentlyDeleted,
  executeRelatedPhotoCleanup,
  prepareRelatedPhotoCleanup,
  refreshAlbumDirectory,
  resolveX6GameAccountDirectory,
  restoreRecentlyDeletedPhotos
} from './fileSystem'

beforeAll(() => {
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined })
})

class MemoryFileHandle {
  readonly kind = 'file' as const

  constructor(
    public readonly name: string,
    private contents: Blob = new Blob(['photo'], { type: 'image/jpeg' }),
    private readonly failRead = false,
    public readonly lastModified = 1
  ) {}

  async getFile(): Promise<File> {
    if (this.failRead) throw new DOMException('Read failed', 'NotReadableError')
    return new File([this.contents], this.name, { type: this.contents.type, lastModified: this.lastModified })
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
  readonly resolvedPaths = new Map<MemoryDirectoryHandle, string[]>()

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

  async resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null> {
    return this.resolvedPaths.get(possibleDescendant as unknown as MemoryDirectoryHandle) ?? null
  }

  async queryPermission(): Promise<PermissionState> {
    return 'granted'
  }
}

function createPhoto(directory: MemoryDirectoryHandle, name: string): PhotoItem {
  const fileHandle = new MemoryFileHandle(name)
  directory.files.set(name, fileHandle)
  const photoFileSize = 5
  return {
    id: `2026-06-26-11:22-${name}`,
    name,
    url: 'blob:loaded-thumbnail',
    fileSizeText: '5 B',
    fileSize: photoFileSize,
    lastModified: fileHandle.lastModified,
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
  it('allows X6Game authorization for an unrelated album without an account path', async () => {
    const album = new MemoryDirectoryHandle('MyPhotoCollection')
    const x6Game = new MemoryDirectoryHandle('X6Game')

    await expect(resolveX6GameAccountDirectory(
      x6Game as unknown as FileSystemDirectoryHandle,
      album as unknown as FileSystemDirectoryHandle,
      messages.zh.fileSystem,
      true
    )).resolves.toBe('')
  })

  it.each(['NikkiPhotos_LowQuality', 'ScreenShot'])(
    'rejects cleanup when the selected folder is %s',
    async (directoryName) => {
      const album = new MemoryDirectoryHandle(directoryName)

      await expect(prepareRelatedPhotoCleanup(
        album as unknown as FileSystemDirectoryHandle,
        messages.zh.fileSystem
      )).rejects.toThrow(messages.zh.fileSystem.invalidAlbumDirectory)
    }
  )

  it('rejects a non-X6Game folder even for unrelated album authorization', async () => {
    const album = new MemoryDirectoryHandle('MyPhotoCollection')
    const wrongDirectory = new MemoryDirectoryHandle('InfinityNikki')

    await expect(resolveX6GameAccountDirectory(
      wrongDirectory as unknown as FileSystemDirectoryHandle,
      album as unknown as FileSystemDirectoryHandle,
      messages.zh.fileSystem,
      true
    )).rejects.toThrow(messages.zh.fileSystem.invalidX6GameDirectory)
  })

  it('still validates the account path when the album is NikkiPhotos_HighQuality', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const unrelatedX6Game = new MemoryDirectoryHandle('X6Game')

    await expect(resolveX6GameAccountDirectory(
      unrelatedX6Game as unknown as FileSystemDirectoryHandle,
      album as unknown as FileSystemDirectoryHandle,
      messages.zh.fileSystem,
      true
    )).rejects.toThrow(messages.zh.fileSystem.invalidX6GameDirectory)
  })

  it('accepts another selected folder at the expected account path', async () => {
    const album = new MemoryDirectoryHandle('MyPhotoCollection')
    const x6Game = new MemoryDirectoryHandle('X6Game')
    x6Game.resolvedPaths.set(album, ['Saved', 'GamePlayPhotos', '123456789', 'MyPhotoCollection'])

    await expect(resolveX6GameAccountDirectory(
      x6Game as unknown as FileSystemDirectoryHandle,
      album as unknown as FileSystemDirectoryHandle,
      messages.zh.fileSystem
    )).resolves.toBe('123456789')
  })

  it('counts only successfully removed bytes and returns readable failures', async () => {
    const directory = new MemoryDirectoryHandle('ScreenShot')
    directory.files.set('ok.png', new MemoryFileHandle('ok.png', new Blob(['1234'])))
    directory.files.set('locked.png', new MemoryFileHandle('locked.png', new Blob(['123456'])))
    directory.files.set('unreadable.png', new MemoryFileHandle('unreadable.png', new Blob(['12']), true))
    directory.failRemoveName = 'locked.png'

    const result = await executeRelatedPhotoCleanup({
      totalCount: 3,
      missingDirectories: [],
      targets: [{
        directoryName: 'ScreenShot',
        directoryHandle: directory as unknown as FileSystemDirectoryHandle,
        photoNames: ['ok.png', 'locked.png', 'unreadable.png']
      }]
    })

    expect(result.deletedCount).toBe(1)
    expect(result.deletedBytes).toBe(4)
    expect(result.failures).toEqual([
      { path: 'ScreenShot\\locked.png', reason: 'remove-failed' },
      { path: 'ScreenShot\\unreadable.png', reason: 'unreadable-size' }
    ])
    expect(directory.files.has('unreadable.png')).toBe(true)
  })

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

  it('replaces a same-name photo when its file metadata changes', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const currentHandle = new MemoryFileHandle('2026_06_26_11_22_00.jpeg', new Blob(['old']), false, 1)
    album.files.set(currentHandle.name, currentHandle)
    const current = createPhoto(album, currentHandle.name)
    const replacementHandle = new MemoryFileHandle(currentHandle.name, new Blob(['new content']), false, 2)
    album.files.set(replacementHandle.name, replacementHandle)

    const result = await refreshAlbumDirectory(
      album as unknown as FileSystemDirectoryHandle,
      [current],
      { messages: messages.zh.fileSystem }
    )

    expect(result.photos[0]).not.toBe(current)
    expect(result.replacedPhotos).toEqual([current])
    expect(result.removedCount).toBe(0)
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
