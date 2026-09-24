import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import App from '../src/App.vue'
import { messages } from '../src/i18n'
import {
  getSavedAlbumDirectoryHandle,
  readAlbumDirectory,
  saveAlbumDirectoryHandle
} from '../src/utils/file-system/albumFileSystem'
import { listRecentlyDeleted } from '../src/utils/file-system/trashFileSystem'
import { readOutfitLibrary, type OutfitItem } from '../src/utils/outfit/outfitFileSystem'
import { importOutfitBackup } from '../src/utils/outfit/outfitBackup'
import { decodeCameraParams } from '../src/utils/photo-params/wasmClient'

vi.mock('../src/utils/file-system/albumFileSystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/file-system/albumFileSystem')>()
  return {
    ...actual,
    getSavedAlbumDirectoryHandle: vi.fn(),
    readAlbumDirectory: vi.fn(),
    saveAlbumDirectoryHandle: vi.fn()
  }
})

vi.mock('../src/utils/file-system/trashFileSystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/file-system/trashFileSystem')>()
  return { ...actual, listRecentlyDeleted: vi.fn() }
})

vi.mock('../src/utils/outfit/outfitFileSystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/outfit/outfitFileSystem')>()
  return { ...actual, readOutfitLibrary: vi.fn() }
})

vi.mock('../src/utils/outfit/outfitBackup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/outfit/outfitBackup')>()
  return { ...actual, importOutfitBackup: vi.fn() }
})

vi.mock('../src/utils/photo-params/wasmClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/photo-params/wasmClient')>()
  return { ...actual, decodeCameraParams: vi.fn() }
})

const getSavedAlbumDirectoryHandleMock = vi.mocked(getSavedAlbumDirectoryHandle)
const listRecentlyDeletedMock = vi.mocked(listRecentlyDeleted)
const readAlbumDirectoryMock = vi.mocked(readAlbumDirectory)
const saveAlbumDirectoryHandleMock = vi.mocked(saveAlbumDirectoryHandle)
const readOutfitLibraryMock = vi.mocked(readOutfitLibrary)
const importOutfitBackupMock = vi.mocked(importOutfitBackup)
const decodeCameraParamsMock = vi.mocked(decodeCameraParams)

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

  it('opens the shared parse dialog from the outfit code input', async () => {
    const directoryHandle = { kind: 'directory', name: 'NikkiPhotos_HighQuality' } as FileSystemDirectoryHandle
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(directoryHandle)
    readAlbumDirectoryMock.mockResolvedValue({ directoryName: directoryHandle.name, directoryHandle, photos: [] })
    const wrapper = mount(App, {
      global: {
        stubs: {
          Teleport: true,
          OutfitParseDialog: {
            props: ['visible', 'code'],
            template: '<div v-if="visible" class="parse-dialog-stub">{{ code }}<button class="parse-dialog-close" @click="$emit(\'close\')">Close</button></div>'
          }
        }
      }
    })
    await flushPromises()

    await wrapper.get('.tools-menu-button').trigger('click')
    await wrapper.get('.header-dropdown').findAll('button')[2].trigger('click')
    const input = wrapper.findAll('.parse-tools-section input')[1]
    expect(input.attributes('placeholder')).toBe('填入搭配码进行解析')

    await input.setValue(' ABC 123 ')
    await flushPromises()
    await wrapper.findAll('.parse-tools-section')[1].trigger('submit')

    expect(wrapper.get('.parse-dialog-stub').text()).toContain('ABC123')
    await wrapper.get('.parse-dialog-close').trigger('click')
    expect(wrapper.find('.parse-tools-dialog').exists()).toBe(true)
    expect((wrapper.findAll('.parse-tools-section input')[1].element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('returns to the shared parse dialog after closing camera parameter results', async () => {
    const directoryHandle = { kind: 'directory', name: 'NikkiPhotos_HighQuality' } as FileSystemDirectoryHandle
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(directoryHandle)
    readAlbumDirectoryMock.mockResolvedValue({ directoryName: directoryHandle.name, directoryHandle, photos: [] })
    decodeCameraParamsMock.mockResolvedValue({ ok: true, value: {} } as Awaited<ReturnType<typeof decodeCameraParams>>)
    const wrapper = mount(App, {
      global: {
        stubs: {
          Teleport: true,
          OutfitParseDialog: {
            props: ['visible', 'code'],
            template: '<div v-if="visible" class="parse-dialog-stub" />'
          },
          PhotoParamsDialog: {
            props: ['visible', 'messages'],
            template: '<div v-if="visible" class="photo-params-stub"><span>{{ messages.eyebrow }} {{ messages.labels.focalLength }} {{ messages.stages.ready }}</span><button class="photo-params-close" @click="$emit(\'close\')">Close</button></div>'
          }
        }
      }
    })
    await flushPromises()

    await wrapper.get('.tools-menu-button').trigger('click')
    await wrapper.get('.header-dropdown').findAll('button')[2].trigger('click')
    const input = wrapper.findAll('.parse-tools-section input')[0]
    await input.setValue('camera-raw')
    await wrapper.findAll('.parse-tools-section')[0].trigger('submit')
    await flushPromises()

    const initialPhotoParamsText = wrapper.get('.photo-params-stub').text()
    const initialLanguage = initialPhotoParamsText.includes(messages.en.photoParams.labels.focalLength) ? 'en' : 'zh'
    const initialMessages = messages[initialLanguage]
    expect(initialPhotoParamsText).toContain(`${initialMessages.photoParams.eyebrow} ${initialMessages.photoParams.labels.focalLength} ${initialMessages.photoParams.stages.ready}`)
    await wrapper.get('.view-menu-button').trigger('click')
    await wrapper.get('.view-dropdown').findAll('button').at(-1)!.trigger('click')
    await new Promise((resolve) => window.setTimeout(resolve, 300))
    await flushPromises()
    const nextMessages = messages[initialLanguage === 'zh' ? 'en' : 'zh']
    expect(wrapper.get('.photo-params-stub').text()).toContain(`${nextMessages.photoParams.eyebrow} ${nextMessages.photoParams.labels.focalLength} ${nextMessages.photoParams.stages.ready}`)
    await wrapper.get('.photo-params-close').trigger('click')
    expect(wrapper.find('.parse-tools-dialog').exists()).toBe(true)
    expect((wrapper.findAll('.parse-tools-section input')[0].element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })
})

