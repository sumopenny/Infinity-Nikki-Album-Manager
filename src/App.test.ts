import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import App from './App.vue'
import { messages } from './i18n'
import {
  getSavedAlbumDirectoryHandle,
  listRecentlyDeleted,
  readAlbumDirectory,
  saveAlbumDirectoryHandle
} from './utils/fileSystem'
import { importOutfitBackup, readOutfitLibrary, type OutfitItem } from './utils/outfitFileSystem'

vi.mock('./utils/fileSystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils/fileSystem')>()
  return {
    ...actual,
    getSavedAlbumDirectoryHandle: vi.fn(),
    listRecentlyDeleted: vi.fn(),
    readAlbumDirectory: vi.fn(),
    saveAlbumDirectoryHandle: vi.fn()
  }
})

vi.mock('./utils/outfitFileSystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils/outfitFileSystem')>()
  return { ...actual, importOutfitBackup: vi.fn(), readOutfitLibrary: vi.fn() }
})

const getSavedAlbumDirectoryHandleMock = vi.mocked(getSavedAlbumDirectoryHandle)
const listRecentlyDeletedMock = vi.mocked(listRecentlyDeleted)
const readAlbumDirectoryMock = vi.mocked(readAlbumDirectory)
const saveAlbumDirectoryHandleMock = vi.mocked(saveAlbumDirectoryHandle)
const readOutfitLibraryMock = vi.mocked(readOutfitLibrary)
const importOutfitBackupMock = vi.mocked(importOutfitBackup)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

describe('App lifecycle coordination', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    listRecentlyDeletedMock.mockResolvedValue([])
    saveAlbumDirectoryHandleMock.mockResolvedValue(undefined)
    readOutfitLibraryMock.mockResolvedValue({
      outfits: [],
      tags: [],
      importedExternalCount: 0,
      importedSharedCount: 0,
      failedCount: 0
    })
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('locks directory selection while the saved directory lookup is pending', async () => {
    const savedDirectoryLookup = deferred<FileSystemDirectoryHandle | null>()
    getSavedAlbumDirectoryHandleMock.mockReturnValue(savedDirectoryLookup.promise)
    const wrapper = mount(App)

    await wrapper.get(`[aria-label="${messages.zh.topBar.albumMenuAria}"]`).trigger('click')
    await nextTick()
    const chooseDirectoryButton = [...document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')]
      .find((button) => button.textContent?.includes(messages.zh.topBar.chooseDirectory))

    expect(chooseDirectoryButton?.disabled).toBe(true)

    savedDirectoryLookup.resolve(null)
    await flushPromises()
    expect(chooseDirectoryButton?.disabled).toBe(false)
    wrapper.unmount()
  })

  it('releases outfit object URLs when the application unmounts', async () => {
    const directoryHandle = { kind: 'directory', name: 'NikkiPhotos_HighQuality' } as FileSystemDirectoryHandle
    const outfit = { id: 'outfit-1', url: 'blob:outfit' } as OutfitItem
    const revokeObjectUrl = vi.fn()
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl })
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(directoryHandle)
    readAlbumDirectoryMock.mockResolvedValue({ directoryName: directoryHandle.name, directoryHandle, photos: [] })
    readOutfitLibraryMock.mockResolvedValue({
      outfits: [outfit],
      tags: [],
      importedExternalCount: 0,
      importedSharedCount: 0,
      failedCount: 0
    })

    const wrapper = mount(App)
    await flushPromises()
    wrapper.unmount()

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:outfit')
  })

  it('applies the imported ZIP library without rescanning outfits', async () => {
    const directoryHandle = { kind: 'directory', name: 'NikkiPhotos_HighQuality' } as FileSystemDirectoryHandle
    const importedOutfit = { id: 'imported-outfit', url: null, timestamp: 1 } as OutfitItem
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(directoryHandle)
    readAlbumDirectoryMock.mockResolvedValue({ directoryName: directoryHandle.name, directoryHandle, photos: [] })
    importOutfitBackupMock.mockResolvedValue({
      addedCount: 1,
      duplicateCount: 0,
      failedCount: 0,
      rejectedTagCount: 0,
      library: {
        outfits: [importedOutfit],
        tags: ['甜美'],
        importedExternalCount: 0,
        importedSharedCount: 0,
        failedCount: 0
      }
    })
    const wrapper = mount(App)
    await flushPromises()
    const input = wrapper.get('input[accept=".zip,application/zip"]')
    const backup = new File(['zip'], 'backup.zip', { type: 'application/zip' })
    Object.defineProperty(input.element, 'files', { configurable: true, value: [backup] })

    await input.trigger('change')
    await flushPromises()

    expect(importOutfitBackupMock).toHaveBeenCalledWith(directoryHandle, backup)
    expect(readOutfitLibraryMock).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })
})
