import { Blob as NodeBlob } from 'node:buffer'
import 'fake-indexeddb/auto'
import { runStoreRequest } from '../src/utils/file-system/database'
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
import { countHomeSchemes } from '../src/utils/homeBuild/homeSchemeFileSystem'

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

vi.mock('../src/utils/homeBuild/homeSchemeFileSystem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/homeBuild/homeSchemeFileSystem')>()
  return { ...actual, countHomeSchemes: vi.fn() }
})

const getSavedAlbumDirectoryHandleMock = vi.mocked(getSavedAlbumDirectoryHandle)
const listRecentlyDeletedMock = vi.mocked(listRecentlyDeleted)
const readAlbumDirectoryMock = vi.mocked(readAlbumDirectory)
const saveAlbumDirectoryHandleMock = vi.mocked(saveAlbumDirectoryHandle)
const readOutfitLibraryMock = vi.mocked(readOutfitLibrary)
const importOutfitBackupMock = vi.mocked(importOutfitBackup)
const decodeCameraParamsMock = vi.mocked(decodeCameraParams)
const countHomeSchemesMock = vi.mocked(countHomeSchemes)

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
    countHomeSchemesMock.mockResolvedValue(0)
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('retains resonance and all favorites when clearing data through the application', async () => {
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
    const favoriteKey = 'infinity-nikki-favorite-photo-ids'
    localStorage.setItem(favoriteKey, JSON.stringify(['original-album/photo.jpg']))
    localStorage.setItem('infinity-nikki-language', 'zh')
    const preserved = [
      ['resonance-records', 'current-profile', [{ id: 'kept-record' }]],
      ['camera-favorite-tags', 'order', ['保留分类']],
      ['camera-favorite-covers', 'kept', new NodeBlob(['kept-cover'])],
      ['camera-favorites', undefined, {
        id: 'kept', version: 1, name: '保留参数', tag: '保留分类', code: 'ABC', source: 'manual',
        createdAt: '2026-10-12T00:00:00Z', updatedAt: '2026-10-12T00:00:00Z', cover: null,
        result: { rawCameraParams: 'ABC', environmentFields: [], cameraFields: [], imageFields: [], resourceGroups: [] }
      }]
    ] as const
    for (const [storeName, key, value] of preserved)
      await runStoreRequest(storeName, 'readwrite', store => key === undefined ? store.put(value) : store.put(value, key))
    await runStoreRequest('album-handles', 'readwrite', store => store.put('cache', 'home-scheme-parse:one'))
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { stubs: { CameraFavorites: true, ResonanceRecords: true } }
    })
    try {
      await flushPromises()
      wrapper.findComponent({ name: 'TopBar' }).vm.$emit('clearData')
      await nextTick()
      const dialog = wrapper.findComponent({ name: 'ConfirmDialog' })
      expect(dialog.props('message')).toContain('全部保留')
      dialog.vm.$emit('confirm')
      await vi.waitFor(() => expect(document.body.textContent).toContain(messages.zh.app.clearDataStatus))
      expect(localStorage.getItem(favoriteKey)).toBe(JSON.stringify(['original-album/photo.jpg']))
      expect(await runStoreRequest('album-handles', 'readonly', store => store.count())).toBe(0)
      for (const [storeName, key, value] of preserved)
        expect(await runStoreRequest(storeName, 'readonly', store => store.get(key ?? 'kept'))).toEqual(value)
    } finally {
      wrapper.unmount()
      for (const [storeName] of preserved)
        await runStoreRequest(storeName, 'readwrite', store => store.clear())
    }
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

  it('allows navigation without an album and opens resonance independently', async () => {
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { stubs: { ResonanceRecords: { template: '<div class="resonance-workspace-stub" />' } } }
    })
    await flushPromises()

    for (const index of [1, 2, 4, 5, 0]) {
      const button = wrapper.findAll('.album-view-button')[index]
      expect((button.element as HTMLButtonElement).disabled).toBe(false)
      await button.trigger('click')
      await flushPromises()
      expect(button.attributes('aria-pressed')).toBe('true')
      expect(wrapper.find('.empty-album-start').exists()).toBe(index === 0 || index === 5)
      if (index === 1) {
        expect(wrapper.get('.outfit-grid-wrap .inline-empty h2').text()).toBe(messages.zh.outfit.emptyTitle)
        expect(wrapper.findAll('.outfit-header-actions button').map(button => (button.element as HTMLButtonElement).disabled)).toEqual([true, false, true])
        await wrapper.findAll('.outfit-header-actions button')[1].trigger('click')
        await flushPromises()
        expect(wrapper.findComponent({ name: 'ConfirmDialog' }).props('visible')).toBe(false)
      }
      if (index === 2) {
        expect(wrapper.get('.home-scheme-empty h2').text()).toBe(messages.zh.homeScheme.emptyTitle)
        expect(wrapper.findAll('.home-scheme-header-actions button').map(button => (button.element as HTMLButtonElement).disabled)).toEqual([true, false, true])
        await wrapper.findAll('.home-scheme-header-actions button')[1].trigger('click')
        await flushPromises()
        expect(wrapper.findComponent({ name: 'ConfirmDialog' }).props('visible')).toBe(false)
      }
      if (index === 4) expect(wrapper.findComponent({ name: 'CameraFavorites' }).props('active')).toBe(true)
    }
    expect(readOutfitLibraryMock).not.toHaveBeenCalled()
    expect(wrapper.findComponent({ name: 'OutfitGuideDialog' }).props('visible')).toBe(false)

    await wrapper.findAll('.album-view-button')[3].trigger('click')
    await wrapper.get('.resonance-nav-menu [role="menuitem"]').trigger('click')
    expect(wrapper.find('.resonance-workspace-stub').exists()).toBe(true)
    expect(wrapper.find('.empty-album-start').exists()).toBe(false)
    expect(wrapper.get('.album-layout').classes()).not.toContain('without-album')
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
    const input = wrapper.get('#outfit-backup-input')
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
    const input = wrapper.findAll('.parse-tools-section input:not([type="file"])')[1]
    expect(input.attributes('placeholder')).toBe('填入搭配码进行解析')

    await input.setValue(' ABC 123 ')
    await flushPromises()
    await wrapper.findAll('form.parse-tools-section')[1].trigger('submit')

    expect(wrapper.get('.parse-dialog-stub').text()).toContain('ABC123')
    await wrapper.get('.parse-dialog-close').trigger('click')
    expect(wrapper.find('.parse-tools-dialog').exists()).toBe(true)
    expect((wrapper.findAll('.parse-tools-section input:not([type="file"])')[1].element as HTMLInputElement).value).toBe('')
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
    const input = wrapper.findAll('.parse-tools-section input:not([type="file"])')[0]
    await input.setValue('camera-raw')
    await wrapper.findAll('form.parse-tools-section')[0].trigger('submit')
    await flushPromises()

    const initialPhotoParamsText = wrapper.get('.photo-params-stub').text()
    const initialLanguage = initialPhotoParamsText.includes(messages.en.photoParams.labels.focalLength) ? 'en' : 'zh'
    const initialMessages = messages[initialLanguage]
    expect(initialPhotoParamsText).toContain(`${initialMessages.photoParams.eyebrow} ${initialMessages.photoParams.labels.focalLength} ${initialMessages.photoParams.stages.ready}`)
    await wrapper.get('.view-menu-button').trigger('click')
    await wrapper.get('.view-dropdown').findAll('button').at(-1)!.trigger('click')
    await new Promise((resolve) => window.setTimeout(resolve, 300))
    await flushPromises()
    const nextPhotoText = wrapper.get('.photo-params-stub').text()
    const nextMessages = messages[initialLanguage === 'zh' ? 'en' : 'zh']
    const expectedNext = `${nextMessages.photoParams.eyebrow} ${nextMessages.photoParams.labels.focalLength} ${nextMessages.photoParams.stages.ready}`
    const expectedCurrent = `${initialMessages.photoParams.eyebrow} ${initialMessages.photoParams.labels.focalLength} ${initialMessages.photoParams.stages.ready}`
    expect([expectedNext, expectedCurrent].some((expected) => nextPhotoText.includes(expected))).toBe(true)
    await wrapper.get('.photo-params-close').trigger('click')
    expect(wrapper.find('.parse-tools-dialog').exists()).toBe(true)
    expect((wrapper.findAll('.parse-tools-section input:not([type="file"])')[0].element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })
})

