import { useModuleOperation } from '../src/composables/useOperationCoordinator'
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
import { readOutfitCollection } from '../src/utils/outfit/outfitStorage'
import { getSavedX6GameDirectoryHandle } from '../src/utils/file-system/directoryStorage'
import { countHomeSchemes } from '../src/utils/homeBuild/homeSchemeStorage'

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

vi.mock('../src/utils/outfit/outfitStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/outfit/outfitStorage')>()
  return { ...actual, readOutfitCollection: vi.fn() }
})
vi.mock('../src/utils/file-system/directoryStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/file-system/directoryStorage')>()
  return { ...actual, getSavedX6GameDirectoryHandle: vi.fn() }
})

vi.mock('../src/utils/outfit/outfitBackup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/outfit/outfitBackup')>()
  return { ...actual, importOutfitBackup: vi.fn() }
})

vi.mock('../src/utils/photo-params/wasmClient', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/photo-params/wasmClient')>()
  return { ...actual, decodeCameraParams: vi.fn() }
})

vi.mock('../src/utils/homeBuild/homeSchemeStorage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils/homeBuild/homeSchemeStorage')>()
  return { ...actual, countHomeSchemes: vi.fn() }
})

vi.mock('../src/utils/homeBuild/homeSchemeMigration', () => ({
  migrateHomeSchemeLibrary: vi.fn(async () => ({
    addedCount: 0,
    replacedCount: 0,
    skippedCount: 0,
    failedCount: 0,
    tagsChanged: false,
    failures: []
  }))
}))

const getSavedAlbumDirectoryHandleMock = vi.mocked(getSavedAlbumDirectoryHandle)
const listRecentlyDeletedMock = vi.mocked(listRecentlyDeleted)
const readAlbumDirectoryMock = vi.mocked(readAlbumDirectory)
const saveAlbumDirectoryHandleMock = vi.mocked(saveAlbumDirectoryHandle)
const readOutfitLibraryMock = vi.mocked(readOutfitLibrary)
const readOutfitCollectionMock = vi.mocked(readOutfitCollection)
const getSavedX6GameDirectoryHandleMock = vi.mocked(getSavedX6GameDirectoryHandle)
const importOutfitBackupMock = vi.mocked(importOutfitBackup)
const decodeCameraParamsMock = vi.mocked(decodeCameraParams)
const countHomeSchemesMock = vi.mocked(countHomeSchemes)

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

beforeEach(() => {
  // jsdom 不提供布局观察器；应用挂载测试使用无布局副作用的替身。
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
})

describe('App lifecycle coordination', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    getSavedX6GameDirectoryHandleMock.mockResolvedValue(null)
    readOutfitCollectionMock.mockResolvedValue({ outfits: [], tags: [] })
    listRecentlyDeletedMock.mockResolvedValue([])
    saveAlbumDirectoryHandleMock.mockResolvedValue(undefined)
    readOutfitLibraryMock.mockResolvedValue({
      outfits: [],
      tags: [],
      importedSharedCount: 0,
      failedCount: 0
    })
    countHomeSchemesMock.mockResolvedValue(0)
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('falls back from half thumbnails on mobile without changing desktop preferences', async () => {
    const listeners = new Set<() => void>()
    const query = {
      matches: true,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn)
    }
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => query)
    )
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
    const keys = [
      'infinity-nikki-thumbnail-mode',
      'infinity-nikki-outfit-thumbnail-mode',
      'infinity-nikki-home-thumbnail-mode'
    ]
    keys.forEach((key) => localStorage.setItem(key, 'half'))
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { stubs: { CameraFavorites: true } }
    })
    try {
      await flushPromises()
      const topBar = wrapper.getComponent({ name: 'TopBar' })
      const navigation = wrapper.getComponent({ name: 'AlbumViewSwitcher' })
      for (const view of ['all', 'outfits', 'home']) {
        navigation.vm.$emit('changeView', view)
        await flushPromises()
        expect(topBar.props('thumbnailMode')).toBe('default')
        if (view === 'outfits')
          expect(wrapper.getComponent({ name: 'OutfitGrid' }).props('thumbnailMode')).toBe(
            'default'
          )
        topBar.vm.$emit('changeThumbnailMode', 'half')
        await flushPromises()
        expect(topBar.props('thumbnailMode')).toBe('default')
      }
      keys.forEach((key) => expect(localStorage.getItem(key)).toBe('half'))
      query.matches = false
      listeners.forEach((fn) => fn())
      await flushPromises()
      for (const view of ['all', 'outfits', 'home']) {
        navigation.vm.$emit('changeView', view)
        await flushPromises()
        expect(topBar.props('thumbnailMode')).toBe('half')
      }
    } finally {
      wrapper.unmount()
      vi.unstubAllGlobals()
    }
  })

  it.each([true, false])(
    'disables all resonance ratios and rejects preference changes (compact=%s)',
    async (compact) => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn(() => ({ matches: compact, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
      )
      getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
      localStorage.setItem('infinity-nikki-thumbnail-mode', 'wide')
      const wrapper = mount(App, {
        attachTo: document.body,
        global: { stubs: { ResonanceRecords: true, CameraFavorites: true } }
      })
      try {
        await flushPromises()
        const navigation = wrapper.getComponent({ name: 'AlbumViewSwitcher' })
        const topBar = wrapper.getComponent({ name: 'TopBar' })
        navigation.vm.$emit('changeView', 'resonance')
        await flushPromises()
        expect(topBar.props('thumbnailModeDisabled')).toBe(true)
        await topBar
          .get(
            compact ? '.mobile-header-row button[aria-label="打开视图菜单"]' : '.view-menu-button'
          )
          .trigger('click')
        await flushPromises()
        const options = [
          ...document.querySelectorAll<HTMLButtonElement>('.thumbnail-options button')
        ]
        expect(options.length).toBeGreaterThan(0)
        expect(options.every((button) => button.disabled)).toBe(true)
        topBar.vm.$emit('changeThumbnailMode', 'portrait-standard')
        await flushPromises()
        expect(localStorage.getItem('infinity-nikki-thumbnail-mode')).toBe('wide')
        navigation.vm.$emit('changeView', 'all')
        await flushPromises()
        expect(topBar.props('thumbnailModeDisabled')).toBe(false)
        expect(topBar.props('thumbnailMode')).toBe('wide')
      } finally {
        wrapper.unmount()
        vi.unstubAllGlobals()
      }
    }
  )

  it('shows camera parameters in compact favorites and restores desktop photo tabs', async () => {
    const listeners = new Set<() => void>()
    const query = {
      matches: false,
      addEventListener: (_: string, fn: () => void) => listeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => listeners.delete(fn)
    }
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => query)
    )
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
    const wrapper = mount(App, { global: { stubs: { CameraFavorites: true } } })
    try {
      await flushPromises()
      await wrapper.findAll('.mobile-navigation button')[2]!.trigger('click')
      expect(wrapper.getComponent({ name: 'TopBar' }).props('thumbnailModeDisabled')).toBe(true)
      await wrapper.findAll('.favorites-tabs button')[1]!.trigger('click')
      expect(wrapper.getComponent({ name: 'TopBar' }).props('thumbnailModeDisabled')).toBe(false)
      expect(wrapper.findComponent({ name: 'CameraFavorites' }).props('active')).toBe(false)
      query.matches = true
      listeners.forEach((fn) => fn())
      await flushPromises()
      expect(wrapper.findAll('.mobile-navigation button')[2]!.text()).toBe('相机参数')
      expect(wrapper.find('.favorites-tabs').exists()).toBe(false)
      expect(wrapper.findComponent({ name: 'CameraFavorites' }).props('active')).toBe(true)
      expect(wrapper.find('.empty-album-start').exists()).toBe(false)
      expect(wrapper.get('.favorites-toolbar').isVisible()).toBe(false)
      query.matches = false
      listeners.forEach((fn) => fn())
      await flushPromises()
      expect(wrapper.findAll('.favorites-tabs button')).toHaveLength(2)
      expect(wrapper.findAll('.favorites-tabs button')[1]!.attributes('aria-pressed')).toBe('true')
      expect(wrapper.findComponent({ name: 'CameraFavorites' }).props('active')).toBe(false)
      await wrapper.getComponent({ name: 'TopBar' }).vm.$emit('toggleLanguage')
      await flushPromises()
      await vi.waitFor(() =>
        expect(wrapper.findAll('.mobile-navigation button')[2]!.text()).toBe('Camera parameters')
      )
    } finally {
      wrapper.unmount()
      vi.unstubAllGlobals()
    }
  })

  it('clears all website data and reloads only after the reset completes', async () => {
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    sessionStorage.setItem('reset-session', 'saved')
    const favoriteKey = 'infinity-nikki-favorite-photo-ids'
    localStorage.setItem(favoriteKey, JSON.stringify(['original-album/photo.jpg']))
    localStorage.setItem('infinity-nikki-language', 'zh')
    const preserved = [
      ['resonance-records', 'current-profile', [{ id: 'kept-record' }]],
      ['camera-favorite-tags', 'order', ['保留分类']],
      ['camera-favorite-covers', 'kept', new NodeBlob(['kept-cover'])],
      [
        'camera-favorites',
        undefined,
        {
          id: 'kept',
          version: 1,
          name: '保留参数',
          tag: '保留分类',
          code: 'ABC',
          source: 'manual',
          createdAt: '2026-10-12T00:00:00Z',
          updatedAt: '2026-10-12T00:00:00Z',
          cover: null,
          result: {
            rawCameraParams: 'ABC',
            environmentFields: [],
            cameraFields: [],
            imageFields: [],
            resourceGroups: []
          }
        }
      ]
    ] as const
    for (const [storeName, key, value] of preserved)
      await runStoreRequest(storeName, 'readwrite', (store) =>
        key === undefined ? store.put(value) : store.put(value, key)
      )
    await runStoreRequest('album-handles', 'readwrite', (store) =>
      store.put('cache', 'home-scheme-parse:one')
    )
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { stubs: { CameraFavorites: true, ResonanceRecords: true } }
    })
    try {
      await flushPromises()
      wrapper.findComponent({ name: 'TopBar' }).vm.$emit('clearData')
      await nextTick()
      const dialog = wrapper.findComponent({ name: 'ConfirmDialog' })
      expect(dialog.props('message')).toContain('永久删除')
      expect(dialog.props('message')).toContain('请先导出备份')
      dialog.vm.$emit('confirm')
      await vi.waitFor(() =>
        expect(document.body.textContent).toContain(messages.zh.app.clearDataStatus)
      )
      expect(localStorage.length).toBe(0)
      expect(sessionStorage.length).toBe(0)
      expect(reload).toHaveBeenCalledOnce()
      expect(await runStoreRequest('album-handles', 'readonly', (store) => store.count())).toBe(0)
      for (const [storeName, key] of preserved)
        expect(
          await runStoreRequest(storeName, 'readonly', (store) => store.get(key ?? 'kept'))
        ).toBeUndefined()
    } finally {
      wrapper.unmount()
      for (const [storeName] of preserved)
        await runStoreRequest(storeName, 'readwrite', (store) => store.clear())
      vi.unstubAllGlobals()
    }
  })

  it('keeps data and does not reload when reset confirmation is cancelled', async () => {
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    localStorage.setItem('reset-cancel', 'saved')
    await runStoreRequest('album-handles', 'readwrite', (store) =>
      store.put('saved', 'reset-cancel')
    )
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { stubs: { CameraFavorites: true } }
    })
    try {
      await flushPromises()
      wrapper.getComponent({ name: 'TopBar' }).vm.$emit('clearData')
      await nextTick()
      wrapper.getComponent({ name: 'ConfirmDialog' }).vm.$emit('cancel')
      await flushPromises()
      expect(localStorage.getItem('reset-cancel')).toBe('saved')
      expect(
        await runStoreRequest('album-handles', 'readonly', (store) => store.get('reset-cancel'))
      ).toBe('saved')
      expect(reload).not.toHaveBeenCalled()
    } finally {
      wrapper.unmount()
      await runStoreRequest('album-handles', 'readwrite', (store) => store.delete('reset-cancel'))
      vi.unstubAllGlobals()
    }
  })

  it('reports storage reset failures without reloading or claiming success', async () => {
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
    const reload = vi.fn()
    vi.stubGlobal('location', { reload })
    const wrapper = mount(App, {
      attachTo: document.body,
      global: { stubs: { CameraFavorites: true } }
    })
    let clear: ReturnType<typeof vi.spyOn> | undefined
    try {
      await flushPromises()
      clear = vi.spyOn(Storage.prototype, 'clear').mockImplementation(() => {
        throw new Error('Storage unavailable')
      })
      wrapper.getComponent({ name: 'TopBar' }).vm.$emit('clearData')
      await nextTick()
      wrapper.getComponent({ name: 'ConfirmDialog' }).vm.$emit('confirm')
      await vi.waitFor(() => expect(document.body.textContent).toContain('Storage unavailable'))
      expect(document.body.textContent).not.toContain(messages.zh.app.clearDataStatus)
      expect(reload).not.toHaveBeenCalled()
    } finally {
      clear?.mockRestore()
      wrapper.unmount()
      vi.unstubAllGlobals()
    }
  })

  it('locks directory selection while the saved directory lookup is pending', async () => {
    const savedDirectoryLookup = deferred<FileSystemDirectoryHandle | null>()
    getSavedAlbumDirectoryHandleMock.mockReturnValue(savedDirectoryLookup.promise)
    const wrapper = mount(App)

    await wrapper.get(`[aria-label="${messages.zh.topBar.albumMenuAria}"]`).trigger('click')
    await nextTick()
    const chooseDirectoryButton = [
      ...document.body.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
    ].find((button) => button.textContent?.includes(messages.zh.topBar.chooseDirectory))

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
      global: {
        stubs: { ResonanceRecords: { template: '<div class="resonance-workspace-stub" />' } }
      }
    })
    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.findComponent({ name: 'AlbumViewSwitcher' }).props('disabled')).toBe(false)
    )

    for (const index of [1, 2, 4, 5, 0]) {
      const button = wrapper.findAll('.album-view-button')[index]
      await vi.waitFor(() => expect((button.element as HTMLButtonElement).disabled).toBe(false))
      await button.trigger('click')
      await flushPromises()
      expect(button.attributes('aria-pressed')).toBe('true')
      expect(wrapper.find('.empty-album-start').exists()).toBe(index === 0 || index === 5)
      if (index === 1) {
        expect(wrapper.get('.outfit-grid-wrap .inline-empty h2').text()).toBe(
          messages.zh.outfit.emptyTitle
        )
        expect(
          wrapper
            .findAll('.outfit-header-actions button')
            .map((button) => (button.element as HTMLButtonElement).disabled)
        ).toEqual([false, true, false])
        await wrapper.findAll('.outfit-header-actions button')[1].trigger('click')
        await flushPromises()
        expect(wrapper.findComponent({ name: 'ConfirmDialog' }).props('visible')).toBe(false)
      }
      if (index === 2) {
        expect(wrapper.get('.home-scheme-empty h2').text()).toBe(messages.zh.homeScheme.emptyTitle)
        await vi.waitFor(() =>
          expect(
            wrapper
              .findAll('.home-scheme-header-actions button')
              .map((button) => (button.element as HTMLButtonElement).disabled)
          ).toEqual([false, true, false])
        )
        await wrapper.findAll('.home-scheme-header-actions button')[1].trigger('click')
        await flushPromises()
        expect(wrapper.findComponent({ name: 'ConfirmDialog' }).props('visible')).toBe(false)
      }
      if (index === 4)
        expect(wrapper.findComponent({ name: 'CameraFavorites' }).props('active')).toBe(true)
    }
    expect(readOutfitLibraryMock).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ sharedSource: null })
    )
    expect(wrapper.findComponent({ name: 'OutfitGuideDialog' }).props('visible')).toBe(false)

    await wrapper.findAll('.album-view-button')[3].trigger('click')
    expect(wrapper.find('.resonance-workspace-stub').exists()).toBe(true)
    expect(wrapper.find('.empty-album-start').exists()).toBe(false)
    expect(wrapper.get('.album-layout').classes()).not.toContain('without-album')
    wrapper.unmount()
  })

  it('releases outfit object URLs when the application unmounts', async () => {
    const directoryHandle = {
      kind: 'directory',
      name: 'NikkiPhotos_HighQuality'
    } as FileSystemDirectoryHandle
    const outfit = { id: 'outfit-1', url: 'blob:outfit' } as OutfitItem
    const revokeObjectUrl = vi.fn()
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl })
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(directoryHandle)
    readAlbumDirectoryMock.mockResolvedValue({
      directoryName: directoryHandle.name,
      directoryHandle,
      photos: []
    })
    readOutfitLibraryMock.mockResolvedValue({
      outfits: [outfit],
      tags: [],
      importedSharedCount: 0,
      failedCount: 0
    })

    const wrapper = mount(App)
    await flushPromises()
    wrapper.unmount()

    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:outfit')
  })

  it('imports ZIP data without an album and applies the result without rescanning', async () => {
    const importedOutfit = { id: 'imported-outfit', url: null, timestamp: 1 } as OutfitItem
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
    importOutfitBackupMock.mockResolvedValue({
      addedCount: 1,
      duplicateCount: 0,
      failedCount: 0,
      rejectedTagCount: 0,
      library: {
        outfits: [importedOutfit],
        tags: ['甜美'],
        importedSharedCount: 0,
        failedCount: 0
      }
    })
    const wrapper = mount(App)
    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.findComponent({ name: 'AlbumViewSwitcher' }).props('disabled')).toBe(false)
    )
    const scanCount = readOutfitLibraryMock.mock.calls.length
    const input = wrapper.get('#outfit-backup-input')
    const backup = new File(['zip'], 'backup.zip', { type: 'application/zip' })
    Object.defineProperty(input.element, 'files', { configurable: true, value: [backup] })

    await input.trigger('change')
    await flushPromises()

    expect(importOutfitBackupMock).toHaveBeenCalledWith(backup)
    expect(readOutfitLibraryMock).toHaveBeenCalledTimes(scanCount)
    wrapper.unmount()
  })

  it('keeps the global collection visible after cancelling album authorization', async () => {
    const directory = {
      kind: 'directory',
      name: 'NikkiPhotos_HighQuality'
    } as FileSystemDirectoryHandle
    const outfit: OutfitItem = {
      version: 1,
      id: 'global',
      image: 'global.webp',
      code: 'GLOBAL',
      tags: [],
      name: 'global.webp',
      note: '',
      url: null,
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z',
      fileSizeText: '1 KB',
      dateKey: '2026-07-31',
      year: '2026',
      monthDay: '07月31日',
      displayDate: '2026年07月31日',
      timeText: '08:00',
      timestamp: 1
    }
    readOutfitCollectionMock.mockResolvedValue({ outfits: [outfit], tags: [] })
    readOutfitLibraryMock.mockResolvedValue({
      outfits: [outfit],
      tags: [],
      importedSharedCount: 0,
      failedCount: 0
    })
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(directory)
    readAlbumDirectoryMock.mockResolvedValue({
      directoryName: directory.name,
      directoryHandle: directory,
      photos: []
    })
    const wrapper = mount(App, {
      global: {
        stubs: {
          CameraFavorites: true,
          OutfitGrid: {
            props: ['outfits'],
            template: '<div class="outfit-grid-stub">{{ outfits.length }}</div>'
          }
        }
      }
    })
    try {
      await flushPromises()
      wrapper.findComponent({ name: 'TopBar' }).vm.$emit('clearDirectory')
      await vi.waitFor(() =>
        expect(wrapper.findComponent({ name: 'TopBar' }).props('hasAlbumDirectory')).toBe(false)
      )
      await wrapper.findAll('.album-view-button')[1].trigger('click')
      await flushPromises()
      expect(wrapper.get('.outfit-grid-stub').text()).toBe('1')
      expect(
        wrapper
          .findAll('.outfit-header-actions button')
          .map((button) => (button.element as HTMLButtonElement).disabled)
      ).toEqual([false, false, false])
    } finally {
      wrapper.unmount()
    }
  })

  it.each([
    {
      name: 'Android',
      userAgent: 'Mozilla/5.0 (Linux; Android 14)',
      platform: 'Linux',
      touchPoints: 5,
      picker: true
    },
    {
      name: 'iPhone',
      userAgent: 'Mozilla/5.0 (iPhone)',
      platform: 'iPhone',
      touchPoints: 5,
      picker: false
    },
    {
      name: 'iPad desktop mode',
      userAgent: 'Mozilla/5.0 (Macintosh)',
      platform: 'MacIntel',
      touchPoints: 5,
      picker: true
    },
    {
      name: 'unsupported desktop',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0)',
      platform: 'Win32',
      touchPoints: 0,
      picker: false
    }
  ])('opens outfits silently on $name without directory authorization', async (device) => {
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
    localStorage.setItem('infinity-nikki-outfit-guide-dismissed', 'true')
    const userAgent = vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(device.userAgent)
    const platform = vi.spyOn(navigator, 'platform', 'get').mockReturnValue(device.platform)
    const touchDescriptor = Object.getOwnPropertyDescriptor(navigator, 'maxTouchPoints')
    Object.defineProperty(navigator, 'maxTouchPoints', {
      configurable: true,
      value: device.touchPoints
    })
    const descriptor = Object.getOwnPropertyDescriptor(window, 'showDirectoryPicker')
    const picker = vi.fn()
    Object.defineProperty(window, 'showDirectoryPicker', {
      configurable: true,
      value: device.picker ? picker : undefined
    })
    const wrapper = mount(App, { global: { stubs: { CameraFavorites: true } } })
    try {
      await flushPromises()
      await wrapper.findAll('.album-view-button')[1].trigger('click')
      await flushPromises()
      expect(wrapper.find('.outfit-grid-wrap').exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'ConfirmDialog' }).props('visible')).toBe(false)
      expect(wrapper.text()).not.toContain(messages.zh.fileSystem.mobileBrowserUnsupported)
      expect(wrapper.text()).not.toContain(messages.zh.fileSystem.unsupportedBrowser)
      expect(picker).not.toHaveBeenCalled()
      expect(readOutfitLibraryMock).toHaveBeenLastCalledWith(
        null,
        expect.objectContaining({ sharedSource: null })
      )
    } finally {
      wrapper.unmount()
      userAgent.mockRestore()
      platform.mockRestore()
      if (touchDescriptor) Object.defineProperty(navigator, 'maxTouchPoints', touchDescriptor)
      else Reflect.deleteProperty(navigator, 'maxTouchPoints')
      if (descriptor) Object.defineProperty(window, 'showDirectoryPicker', descriptor)
      else delete window.showDirectoryPicker
    }
  })

  it('checks an authorized game directory without an album and skips permission requests in background', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
    const requestPermission = vi.fn(),
      queryPermission = vi.fn(async () => 'granted' as PermissionState)
    const game = {
      kind: 'directory',
      name: 'X6Game',
      queryPermission,
      requestPermission
    } as unknown as FileSystemDirectoryHandle
    getSavedX6GameDirectoryHandleMock.mockResolvedValue(game)
    const wrapper = mount(App, { global: { stubs: { CameraFavorites: true } } })
    try {
      await flushPromises()
      expect(readOutfitLibraryMock).toHaveBeenCalledWith(
        null,
        expect.objectContaining({ sharedSource: { x6GameDirectory: game } })
      )
      queryPermission.mockResolvedValue('prompt')
      window.dispatchEvent(new Event('focus'))
      await vi.advanceTimersByTimeAsync(400)
      await flushPromises()
      expect(readOutfitLibraryMock).toHaveBeenLastCalledWith(
        null,
        expect.objectContaining({ sharedSource: null })
      )
      expect(requestPermission).not.toHaveBeenCalled()
      expect(wrapper.findComponent({ name: 'ConfirmDialog' }).props('visible')).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('opens the shared parse dialog from the outfit code input', async () => {
    const directoryHandle = {
      kind: 'directory',
      name: 'NikkiPhotos_HighQuality'
    } as FileSystemDirectoryHandle
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(directoryHandle)
    readAlbumDirectoryMock.mockResolvedValue({
      directoryName: directoryHandle.name,
      directoryHandle,
      photos: []
    })
    const wrapper = mount(App, {
      global: {
        stubs: {
          Teleport: true,
          OutfitParseDialog: {
            props: ['visible', 'code'],
            template:
              '<div v-if="visible" class="parse-dialog-stub">{{ code }}<button class="parse-dialog-close" @click="$emit(\'close\')">Close</button></div>'
          }
        }
      }
    })
    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.findComponent({ name: 'AlbumViewSwitcher' }).props('disabled')).toBe(false)
    )

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
    expect(
      (
        wrapper.findAll('.parse-tools-section input:not([type="file"])')[1]
          .element as HTMLInputElement
      ).value
    ).toBe('')
    wrapper.unmount()
  })

  it('returns to the shared parse dialog after closing camera parameter results', async () => {
    const directoryHandle = {
      kind: 'directory',
      name: 'NikkiPhotos_HighQuality'
    } as FileSystemDirectoryHandle
    getSavedAlbumDirectoryHandleMock.mockResolvedValue(directoryHandle)
    readAlbumDirectoryMock.mockResolvedValue({
      directoryName: directoryHandle.name,
      directoryHandle,
      photos: []
    })
    decodeCameraParamsMock.mockResolvedValue({ ok: true, value: {} } as Awaited<
      ReturnType<typeof decodeCameraParams>
    >)
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
            template:
              '<div v-if="visible" class="photo-params-stub"><span>{{ messages.eyebrow }} {{ messages.labels.focalLength }} {{ messages.stages.ready }}</span><button class="photo-params-close" @click="$emit(\'close\')">Close</button></div>'
          }
        }
      }
    })
    await flushPromises()
    await vi.waitFor(() =>
      expect(wrapper.findComponent({ name: 'AlbumViewSwitcher' }).props('disabled')).toBe(false)
    )

    await wrapper.get('.tools-menu-button').trigger('click')
    await wrapper.get('.header-dropdown').findAll('button')[2].trigger('click')
    const input = wrapper.findAll('.parse-tools-section input:not([type="file"])')[0]
    await input.setValue('camera-raw')
    await wrapper.findAll('form.parse-tools-section')[0].trigger('submit')
    await flushPromises()

    expect(wrapper.find('.photo-params-stub').exists()).toBe(true)
    await wrapper.get('.photo-params-close').trigger('click')
    expect(wrapper.find('.parse-tools-dialog').exists()).toBe(true)
    expect(
      (
        wrapper.findAll('.parse-tools-section input:not([type="file"])')[0]
          .element as HTMLInputElement
      ).value
    ).toBe('')
    wrapper.unmount()
  })
})

it('blocks desktop and mobile navigation until a child operation settles', async () => {
  getSavedAlbumDirectoryHandleMock.mockResolvedValue(null)
  readOutfitCollectionMock.mockResolvedValue({ outfits: [], tags: [] })
  let finish!: () => void
  const wrapper = mount(App, {
    global: {
      stubs: {
        CameraFavorites: {
          setup() {
            const run = useModuleOperation('camera')
            void run(
              () =>
                new Promise<void>((resolve) => {
                  finish = resolve
                })
            )
            return () => null
          }
        }
      }
    }
  })
  try {
    await flushPromises()
    const desktop = wrapper.findComponent({ name: 'AlbumViewSwitcher' })
    const mobile = wrapper.findComponent({ name: 'MobileNavigation' })
    const previous = desktop.props('activeView')
    expect(desktop.props('disabled')).toBe(true)
    expect(mobile.props('disabled')).toBe(true)
    desktop.vm.$emit('changeView', 'resonance')
    await flushPromises()
    expect(desktop.props('activeView')).toBe(previous)
    finish()
    await flushPromises()
    expect(desktop.props('disabled')).toBe(false)
    expect(mobile.props('disabled')).toBe(false)
    desktop.vm.$emit('changeView', 'resonance')
    await flushPromises()
    expect(desktop.props('activeView')).toBe('resonance')
  } finally {
    wrapper.unmount()
  }
})
