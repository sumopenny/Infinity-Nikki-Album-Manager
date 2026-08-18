import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { messages } from '../i18n'
import type { PhotoItem } from './dateGrouping'
import {
  listGamePlayPhotoAccounts,
  listRecentlyDeleted,
  movePhotosToRecentlyDeleted,
  executeSpecialCleanup,
  pickAlbumDirectory,
  prepareSpecialCleanup,
  readAlbumDirectory,
  refreshAlbumDirectory,
  resolveX6GameAccountDirectory,
  restoreRecentlyDeletedPhotos
} from './fileSystem'

beforeAll(() => {
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: () => undefined })
})

afterEach(() => {
  vi.restoreAllMocks()
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

class DelayedMemoryFileHandle extends MemoryFileHandle {
  constructor(name: string, private readonly tracker: { active: number; peak: number }, lastModified: number) {
    super(name, new Blob(['photo'], { type: 'image/jpeg' }), false, lastModified)
  }

  override async getFile(): Promise<File> {
    this.tracker.active += 1
    this.tracker.peak = Math.max(this.tracker.peak, this.tracker.active)
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 5))
      return await super.getFile()
    } finally {
      this.tracker.active -= 1
    }
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
  it('reports unsupported directory authorization on mobile browsers', async () => {
    vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Linux; Android 16)')

    await expect(pickAlbumDirectory(messages.zh.fileSystem))
      .rejects.toThrow(messages.zh.fileSystem.mobileBrowserUnsupported)
  })

  it('scans album metadata with a maximum of six concurrent file reads', async () => {
    const album = new MemoryDirectoryHandle('NikkiPhotos_HighQuality')
    const tracker = { active: 0, peak: 0 }
    for (let index = 0; index < 8; index += 1) {
      const name = `2026_06_26_11_${String(index).padStart(2, '0')}_00.jpeg`
      album.files.set(name, new DelayedMemoryFileHandle(name, tracker, index))
    }

    const result = await readAlbumDirectory(
      album as unknown as FileSystemDirectoryHandle,
      { messages: messages.zh.fileSystem }
    )

    expect(tracker.peak).toBeGreaterThan(1)
    expect(tracker.peak).toBeLessThanOrEqual(6)
    expect(result.photos).toHaveLength(8)
    expect(result.photos.map((photo) => photo.name)).toEqual(
      [...result.photos.map((photo) => photo.name)].sort().reverse()
    )
  })

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

    const result = await executeSpecialCleanup({
      item: 'lowQuality',
      fileCount: 3,
      totalBytes: 0,
      totalBytesKnown: true,
      photoTargets: [{
        directoryName: 'ScreenShot',
        directoryHandle: directory as unknown as FileSystemDirectoryHandle,
        photoNames: ['ok.png', 'locked.png', 'unreadable.png']
      }],
      directoryTargets: [],
      missingDirectories: []
    })

    expect(result.deletedCount).toBe(1)
    expect(result.deletedBytes).toBe(4)
    expect(result.failures).toEqual([
      { path: 'ScreenShot\\locked.png', reason: 'remove-failed' },
      { path: 'ScreenShot\\unreadable.png', reason: 'unreadable-size' }
    ])
    expect(directory.files.has('unreadable.png')).toBe(true)
  })

  it('clears directory cleanup contents recursively while keeping the folder itself', async () => {
    const x6Game = new MemoryDirectoryHandle('X6Game')
    const saved = new MemoryDirectoryHandle('Saved')
    const crashes = new MemoryDirectoryHandle('Crashes')
    const nested = new MemoryDirectoryHandle('CrashContext')
    nested.files.set('context.log', new MemoryFileHandle('context.log', new Blob(['12'])))
    crashes.files.set('crash.dmp', new MemoryFileHandle('crash.dmp', new Blob(['1234'])))
    crashes.directories.set('CrashContext', nested)
    saved.directories.set('Crashes', crashes)
    x6Game.directories.set('Saved', saved)

    const plan = await prepareSpecialCleanup(x6Game as unknown as FileSystemDirectoryHandle, 'crashes')

    expect(plan.fileCount).toBe(2)
    expect(plan.totalBytes).toBe(6)
    expect(plan.totalBytesKnown).toBe(true)
    expect(plan.missingDirectories).toEqual([])

    const result = await executeSpecialCleanup(plan)

    expect(result.deletedCount).toBe(2)
    expect(result.deletedBytes).toBe(6)
    expect(result.failures).toEqual([])
    // 文件夹本身保留，内容被清空
    expect(saved.directories.has('Crashes')).toBe(true)
    expect(crashes.files.size).toBe(0)
    expect(crashes.directories.size).toBe(0)
  })

  it('deletes unreadable directory entries while marking the size estimate as incomplete', async () => {
    const x6Game = new MemoryDirectoryHandle('X6Game')
    const saved = new MemoryDirectoryHandle('Saved')
    const logs = new MemoryDirectoryHandle('Logs')
    logs.files.set('locked.log', new MemoryFileHandle('locked.log', new Blob(['1234']), true))
    saved.directories.set('Logs', logs)
    x6Game.directories.set('Saved', saved)

    const plan = await prepareSpecialCleanup(x6Game as unknown as FileSystemDirectoryHandle, 'logs')

    expect(plan.fileCount).toBe(1)
    expect(plan.totalBytes).toBe(0)
    expect(plan.totalBytesKnown).toBe(false)

    const result = await executeSpecialCleanup(plan)

    expect(result.deletedCount).toBe(1)
    expect(result.deletedBytes).toBe(0)
    expect(result.failures).toEqual([])
    expect(logs.files.size).toBe(0)
  })

  it('reports a missing directory when the cleanup target does not exist', async () => {
    const x6Game = new MemoryDirectoryHandle('X6Game')

    const plan = await prepareSpecialCleanup(x6Game as unknown as FileSystemDirectoryHandle, 'logs')

    expect(plan.fileCount).toBe(0)
    expect(plan.missingDirectories).toEqual(['Logs'])
  })

  it('lists account folders under GamePlayPhotos and returns empty when missing', async () => {
    const x6Game = new MemoryDirectoryHandle('X6Game')
    const saved = new MemoryDirectoryHandle('Saved')
    const gamePlayPhotos = new MemoryDirectoryHandle('GamePlayPhotos')
    gamePlayPhotos.directories.set('22222', new MemoryDirectoryHandle('22222'))
    gamePlayPhotos.directories.set('11111', new MemoryDirectoryHandle('11111'))
    saved.directories.set('GamePlayPhotos', gamePlayPhotos)
    x6Game.directories.set('Saved', saved)

    await expect(listGamePlayPhotoAccounts(x6Game as unknown as FileSystemDirectoryHandle)).resolves.toEqual(['11111', '22222'])

    const emptyX6Game = new MemoryDirectoryHandle('X6Game')
    await expect(listGamePlayPhotoAccounts(emptyX6Game as unknown as FileSystemDirectoryHandle)).resolves.toEqual([])
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
