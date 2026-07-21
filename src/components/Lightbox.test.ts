import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { messages } from '../i18n'
import type { PhotoItem } from '../utils/dateGrouping'
import Lightbox from './Lightbox.vue'

const loadPhotoMock = vi.fn<(photo: PhotoItem) => Promise<string>>()

vi.mock('../utils/photoLoader', () => ({
  loadPhotoWithRetry: (photo: PhotoItem) => loadPhotoMock(photo)
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
    vi.stubGlobal('Image', class {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      naturalWidth = 1600
      naturalHeight = 900

      set src(_value: string) {
        queueMicrotask(() => this.onload?.())
      }
    })
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
})
