import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { messages } from '../../src/i18n'
import type { PhotoItem } from '../../src/utils/photoGrouping'
import { outfitMessages } from '../../src/i18n/messages/outfit'
import type { OutfitItem } from '../../src/utils/outfit/outfitFileSystem'
import Lightbox from '../../src/components/Lightbox.vue'

const loadPhotoMock = vi.fn<(photo: PhotoItem) => Promise<string>>()

vi.mock('../../src/utils/photoLoader', () => ({
  loadPhotoWithRetry: (photo: PhotoItem) => loadPhotoMock(photo),
  loadPhotoWithRetryAndSize: async (photo: PhotoItem) => ({ url: await loadPhotoMock(photo), width: 1600, height: 900 })
}))

/** 创建大图测试所需的最小照片状态。参数：name 为照片文件名。 */
function createPhoto(name: string): PhotoItem {
  return {
    id: name,
    name,
    url: null,
    fileSizeText: '1 MB',
    fileHandle: {} as FileSystemFileHandle,
    directoryHandle: {} as FileSystemDirectoryHandle,
    dateKey: '2026-07-21',
    year: '2026',
    monthDay: '07月21日',
    displayDate: '2026年07月21日',
    timeText: '11:20',
    timestamp: 1
  }
}

describe('Lightbox preview navigation', () => {
  beforeEach(() => {
    loadPhotoMock.mockReset()
  })

  it('keeps the delete button visually enabled while the next image is loading', async () => {
    const firstPhoto = createPhoto('2026_07_21_11_20_00.jpeg')
    const nextPhoto = createPhoto('2026_07_21_11_21_00.jpeg')
    let finishNextLoad: ((url: string) => void) | undefined
    loadPhotoMock
      .mockResolvedValueOnce('blob:first')
      .mockImplementationOnce(() => new Promise((resolve) => { finishNextLoad = resolve }))

    const wrapper = mount(Lightbox, {
      props: {
        photo: firstPhoto,
        hasPrevious: false,
        hasNext: true,
        isDeleting: false,
        isFavorite: false,
        keyboardEnabled: true,
        mode: 'album',
        messages: messages.zh.lightbox,
        dateMessages: messages.zh.date
      },
      global: { stubs: { Teleport: true } }
    })
    await flushPromises()

    await wrapper.setProps({ photo: nextPhoto })
    const deleteButton = wrapper.get('.lightbox-delete')

    expect(deleteButton.attributes('disabled')).toBeUndefined()
    expect(deleteButton.attributes('aria-disabled')).toBe('true')
    expect(deleteButton.classes()).toContain('is-preview-loading')
    await deleteButton.trigger('click')
    expect(wrapper.emitted('deleteCurrent')).toBeUndefined()

    finishNextLoad?.('blob:next')
    await vi.waitFor(() => {
      expect(wrapper.get('.lightbox-delete').attributes('aria-disabled')).toBeUndefined()
    })
    wrapper.unmount()
  })

  it('clamps zoom and resets it whenever the photo changes', async () => {
    const firstPhoto = createPhoto('2026_07_21_11_20_00.jpeg')
    const nextPhoto = createPhoto('2026_07_21_11_21_00.jpeg')
    loadPhotoMock.mockResolvedValue('blob:photo')
    const wrapper = mount(Lightbox, {
      props: {
        photo: firstPhoto,
        hasPrevious: false,
        hasNext: true,
        isDeleting: false,
        isFavorite: false,
        keyboardEnabled: true,
        mode: 'album',
        messages: messages.zh.lightbox,
        dateMessages: messages.zh.date
      },
      global: { stubs: { Teleport: true } }
    })
    await flushPromises()

    await wrapper.get('.lightbox-stage').trigger('wheel', { deltaY: -1 })
    expect(wrapper.findAll('.lightbox-zoom-controls button')[1].text()).toBe('125%')
    await wrapper.findAll('.lightbox-zoom-controls button')[2].trigger('pointerdown', { pointerId: 1 })
    await wrapper.findAll('.lightbox-zoom-controls button')[2].trigger('click')
    expect(wrapper.findAll('.lightbox-zoom-controls button')[1].text()).toBe('150%')
    for (let index = 0; index < 10; index += 1) await wrapper.findAll('.lightbox-zoom-controls button')[2].trigger('click')
    expect(wrapper.findAll('.lightbox-zoom-controls button')[1].text()).toBe('300%')
    expect(wrapper.findAll('.lightbox-zoom-controls button')[2].attributes('disabled')).toBeDefined()

    await wrapper.setProps({ photo: nextPhoto })
    expect(wrapper.findAll('.lightbox-zoom-controls button')[1].text()).toBe('100%')
    wrapper.unmount()
  })

  it('matches the preview stage aspect ratio to the loaded image', async () => {
    loadPhotoMock.mockResolvedValue('blob:photo')
    const wrapper = mount(Lightbox, {
      props: {
        photo: createPhoto('2026_07_21_11_20_00.jpeg'),
        hasPrevious: false,
        hasNext: false,
        isDeleting: false,
        isFavorite: false,
        keyboardEnabled: true,
        mode: 'album',
        messages: messages.zh.lightbox,
        dateMessages: messages.zh.date
      },
      global: { stubs: { Teleport: true } }
    })
    await flushPromises()

    expect(wrapper.get('.lightbox-panel').attributes('style')).toContain('--lightbox-image-aspect-ratio: 1.7777777777777777')
    wrapper.unmount()
  })

  it('ignores preview shortcuts while an upper dialog disables the keyboard', async () => {
    loadPhotoMock.mockResolvedValue('blob:photo')
    const wrapper = mount(Lightbox, {
      props: {
        photo: createPhoto('2026_07_21_11_20_00.jpeg'),
        hasPrevious: true,
        hasNext: true,
        isDeleting: false,
        isFavorite: false,
        keyboardEnabled: false,
        mode: 'album',
        messages: messages.zh.lightbox,
        dateMessages: messages.zh.date
      },
      global: { stubs: { Teleport: true } }
    })
    await flushPromises()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(wrapper.emitted('close')).toBeUndefined()
    expect(wrapper.emitted('previous')).toBeUndefined()
    expect(wrapper.emitted('next')).toBeUndefined()

    await wrapper.setProps({ keyboardEnabled: true })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toHaveLength(1)
    wrapper.unmount()
  })

  it('locks background scroll while the preview is open and restores it on close', async () => {
    loadPhotoMock.mockResolvedValue('blob:photo')
    const wrapper = mount(Lightbox, {
      props: {
        photo: createPhoto('2026_07_21_11_20_00.jpeg'),
        hasPrevious: false,
        hasNext: false,
        isDeleting: false,
        isFavorite: false,
        keyboardEnabled: true,
        mode: 'album',
        messages: messages.zh.lightbox,
        dateMessages: messages.zh.date
      },
      global: { stubs: { Teleport: true } }
    })
    await flushPromises()

    expect(document.body.style.overflow).toBe('hidden')
    await wrapper.setProps({ photo: null })
    expect(document.body.style.overflow).toBe('')

    await wrapper.setProps({ photo: createPhoto('2026_07_21_11_21_00.jpeg') })
    expect(document.body.style.overflow).toBe('hidden')
    wrapper.unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('shows outfit metadata and emits copy and edit actions without closing the preview', async () => {
    loadPhotoMock.mockResolvedValue('blob:outfit')
    const outfit = { ...createPhoto('look.webp'), code: 'ABC-123', tags: ['甜美'] } as OutfitItem
    const wrapper = mount(Lightbox, {
      props: {
        photo: outfit,
        outfit,
    outfitMessages: outfitMessages.zh,
        hasPrevious: false,
        hasNext: false,
        isDeleting: false,
        isFavorite: false,
        keyboardEnabled: true,
        mode: 'outfit',
        messages: messages.zh.lightbox,
        dateMessages: messages.zh.date
      },
      global: { stubs: { Teleport: true } }
    })
    await flushPromises()

    expect(wrapper.get('.lightbox-outfit-meta').text()).toContain('标签：甜美')
    expect(wrapper.get('.lightbox-outfit-meta').text()).toContain('搭配码：ABC-123')
    await wrapper.get('[aria-label="复制搭配码"]').trigger('click')
    await wrapper.get('[aria-label="编辑方案"]').trigger('click')
    expect(wrapper.emitted('copyOutfit')).toHaveLength(1)
    expect(wrapper.emitted('editOutfit')).toHaveLength(1)
    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })
})

