import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { getOutfitMessages } from '../../src/i18n/messages/outfit'
import type { OutfitItem } from '../../src/utils/outfit/outfitFileSystem'
import OutfitGrid from '../../src/components/OutfitGrid.vue'
import OutfitEditor from '../../src/components/OutfitEditor.vue'
import OutfitGuideDialog from '../../src/components/OutfitGuideDialog.vue'
import OutfitSidebar from '../../src/components/OutfitSidebar.vue'

function outfit(id: string, code: string, tags: string[] = []): OutfitItem {
  return {
    id,
    name: `${id}.webp`,
    image: `${id}.webp`,
    metadataName: `${id}.json`,
    code,
    tags,
    createdAt: '2026-07-31T00:00:00.000Z',
    dateKey: '2026-07-31',
    year: '2026',
    monthDay: '07月31日',
    displayDate: '2026年07月31日',
    timeText: '08:00',
    timestamp: 1,
    url: null,
    fileSizeText: '1 KB',
    fileHandle: {} as FileSystemFileHandle,
    directoryHandle: {} as FileSystemDirectoryHandle
  }
}

describe('outfit workspace components', () => {
  it('keeps operation feedback complete in both locales', () => {
    expect(getOutfitMessages('zh').operations.deletedSelected(2, 1)).toContain('1 个删除失败')
    expect(getOutfitMessages('en').operations.importCompleted(2, 1, 0, '')).toContain('2 added')
  })

  it('renders system filters before user tags and emits the selected filter', async () => {
    const wrapper = mount(OutfitSidebar, {
      props: {
        outfits: [outfit('1', ''), outfit('2', 'ABC', ['甜美'])],
        tags: ['甜美', '清新'],
        activeFilter: 'all',
        disabled: false,
        messages: getOutfitMessages('zh')
      }
    })

    expect(wrapper.findAll('.outfit-filter-button').map((button) => button.text())).toEqual([
      '全部2', '待填写1', '未分类1', '甜美1', '清新0'
    ])
    await wrapper.findAll('.outfit-filter-button')[3].trigger('click')
    expect(wrapper.emitted('changeFilter')).toEqual([['tag:甜美']])
  })

  it('disables tag creation after forty user tags', () => {
    const wrapper = mount(OutfitSidebar, {
      props: {
        outfits: [],
        tags: Array.from({ length: 40 }, (_, index) => `T${index}`),
        activeFilter: 'all',
        disabled: false,
        messages: getOutfitMessages('zh')
      }
    })

    expect(wrapper.find('.outfit-add-tag-toggle').attributes('disabled')).toBeDefined()
  })

  it('reorders user tags only when dragging from the handle', async () => {
    const wrapper = mount(OutfitSidebar, {
      attachTo: document.body,
      props: {
        outfits: [],
        tags: ['最新', '甜美', '清新'],
        activeFilter: 'all',
        disabled: false,
        messages: getOutfitMessages('zh')
      }
    })
    const rows = wrapper.findAll('.outfit-filter-row')
    const target = rows[2].element as HTMLElement
    vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
      top: 100, bottom: 134, left: 0, right: 200, width: 200, height: 34, x: 0, y: 100, toJSON: () => ({})
    })
    const originalElementFromPoint = document.elementFromPoint
    Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => target) })

    await rows[0].get('.outfit-tag-drag-handle').trigger('pointerdown', { button: 0 })
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: 10, clientY: 130 }))
    window.dispatchEvent(new MouseEvent('pointerup'))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('reorderTags')).toEqual([[['甜美', '清新', '最新']]])
    expect(wrapper.findAll('.outfit-filter-row').map((row) => row.attributes('data-outfit-tag'))).toEqual(['甜美', '清新', '最新'])
    if (originalElementFromPoint) {
      Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: originalElementFromPoint })
    } else {
      Reflect.deleteProperty(document, 'elementFromPoint')
    }
    wrapper.unmount()
  })

  it('disables tag drag handles with the rest of the sidebar', () => {
    const wrapper = mount(OutfitSidebar, {
      props: {
        outfits: [],
        tags: ['甜美'],
        activeFilter: 'all',
        disabled: true,
        messages: getOutfitMessages('zh')
      }
    })

    expect(wrapper.get('.outfit-tag-drag-handle').attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('.outfit-tag-drag-handle')).toHaveLength(1)
  })

  it('uses an app tooltip instead of the native title for drag handles', () => {
    const wrapper = mount(OutfitSidebar, {
      props: {
        outfits: [],
        tags: ['甜美'],
        activeFilter: 'all',
        disabled: false,
        messages: getOutfitMessages('zh')
      }
    })
    const handle = wrapper.get('.outfit-tag-drag-handle')

    expect(handle.attributes('title')).toBeUndefined()
    expect(handle.attributes('data-tooltip')).toBe('调整标签顺序')
    expect(handle.attributes('aria-label')).toBe('调整标签顺序: 甜美')
  })

  it('closes the tag popover when the user clicks outside it', async () => {
    const wrapper = mount(OutfitSidebar, {
      attachTo: document.body,
      props: {
        outfits: [],
        tags: [],
        activeFilter: 'all',
        disabled: false,
        messages: getOutfitMessages('zh')
      }
    })

    await wrapper.get('.outfit-add-tag-toggle').trigger('click')
    expect(document.body.querySelector('.outfit-tag-editor-popover')).not.toBeNull()
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('.outfit-tag-editor-popover')).toBeNull()
    wrapper.unmount()
  })

  it('shows the standalone guide and emits the dismissal preference', async () => {
    const wrapper = mount(OutfitGuideDialog, {
      props: { visible: true, dismissed: false, messages: getOutfitMessages('zh') },
      global: { stubs: { Teleport: true } }
    })

    expect(wrapper.text()).toContain('自动更新游戏搭配码')
    expect(wrapper.text()).toContain('搭配截图右下角点击框选按钮')
    expect(wrapper.text()).toContain('批量导入搭配图片')
    expect(wrapper.text()).toContain('clothe')
    expect(wrapper.text()).toContain('导入与导出')
    await wrapper.get('input[type="checkbox"]').setValue(true)
    await wrapper.get('.outfit-guide-panel > footer .primary-button').trigger('click')
    expect(wrapper.emitted('close')).toEqual([[true]])
    wrapper.unmount()
  })

  it('syncs the stored dismissal preference when reopened from help', () => {
    const wrapper = mount(OutfitGuideDialog, {
      props: { visible: true, dismissed: true, messages: getOutfitMessages('zh') },
      global: { stubs: { Teleport: true } }
    })

    expect((wrapper.get('input[type="checkbox"]').element as HTMLInputElement).checked).toBe(true)
    wrapper.unmount()
  })

  it('disables copying for pending outfits and opens them for editing from the status text', async () => {
    const pending = outfit('1', '')
    const wrapper = mount(OutfitGrid, {
      props: {
        outfits: [pending],
        selectedIds: new Set<string>(),
        thumbnailMode: 'portrait-standard',
        messages: getOutfitMessages('zh'),
        disabled: false
      },
      global: { stubs: { LazyPhotoImage: true } }
    })

    expect(wrapper.find('[title="复制搭配码"]').attributes('disabled')).toBeDefined()
    await wrapper.find('.outfit-pending-code').trigger('click')
    expect(wrapper.emitted('edit')).toEqual([[pending]])
  })

  it('selects an outfit card by single click without triggering card actions', async () => {
    const item = outfit('1', 'ABC-123', ['甜美'])
    const wrapper = mount(OutfitGrid, {
      props: {
        outfits: [item],
        selectedIds: new Set<string>(),
        thumbnailMode: 'portrait-standard',
        messages: getOutfitMessages('zh'),
        disabled: false
      },
      global: { stubs: { LazyPhotoImage: true } }
    })

    await wrapper.get('.outfit-card').trigger('click')
    expect(wrapper.emitted('toggleOutfit')).toEqual([[item.id]])
    await wrapper.get('[title="复制搭配码"]').trigger('click')
    expect(wrapper.emitted('copy')).toEqual([[item]])
    expect(wrapper.emitted('toggleOutfit')).toHaveLength(1)
  })

  it('does not select from nested keyboard actions or while disabled', async () => {
    const item = outfit('1', 'ABC-123')
    const wrapper = mount(OutfitGrid, {
      props: {
        outfits: [item],
        selectedIds: new Set<string>(),
        thumbnailMode: 'portrait-standard',
        messages: getOutfitMessages('zh'),
        disabled: false
      },
      global: { stubs: { LazyPhotoImage: true } }
    })

    await wrapper.get('.outfit-card-actions button').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('toggleOutfit')).toBeUndefined()
    await wrapper.setProps({ disabled: true })
    await wrapper.get('.outfit-card').trigger('click')
    await wrapper.get('.outfit-card').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('toggleOutfit')).toBeUndefined()
  })

  it('ignores an older asynchronous preview after the editor is reopened', async () => {
    const files: Array<(file: File) => void> = []
    const firstFile = new File(['first'], 'first.webp', { type: 'image/webp' })
    const secondFile = new File(['second'], 'second.webp', { type: 'image/webp' })
    const item = outfit('1', 'ABC')
    item.fileHandle = { getFile: () => new Promise<File>((resolve) => files.push(resolve)) } as FileSystemFileHandle
    const createObjectURL = vi.fn((file: File) => `blob:${file.name}`)
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectURL })
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })

    const wrapper = mount(OutfitEditor, {
      props: { visible: false, outfit: item, tags: [], busy: false, messages: getOutfitMessages('zh') }
    })
    await wrapper.setProps({ visible: true })
    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })

    files[0](firstFile)
    await flushPromises()
    expect(document.body.querySelector('.outfit-editor img')).toBeNull()
    files[1](secondFile)
    await flushPromises()
    expect(document.body.querySelector('.outfit-editor img')?.getAttribute('src')).toBe('blob:second.webp')
    expect(createObjectURL).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('opens the inline tag creation popover and closes it with Escape', async () => {
    const wrapper = mount(OutfitEditor, {
      attachTo: document.body,
      props: { visible: true, outfit: null, tags: ['甜美'], busy: false, messages: getOutfitMessages('zh') }
    })

    ;(document.body.querySelector('.outfit-editor-add-tag') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('.outfit-tag-editor-popover')).not.toBeNull()
    expect(document.activeElement).toBe(document.body.querySelector('.outfit-tag-editor-popover input'))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('.outfit-tag-editor-popover')).toBeNull()
    wrapper.unmount()
  })

  it('keeps the editor open when the backdrop closes the tag popover', async () => {
    const wrapper = mount(OutfitEditor, {
      attachTo: document.body,
      props: { visible: true, outfit: null, tags: ['甜美'], busy: false, messages: getOutfitMessages('zh') }
    })

    ;(document.body.querySelector('.outfit-editor-add-tag') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    const editorBackdrop = document.body.querySelector('.outfit-editor') as HTMLElement
    editorBackdrop.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    editorBackdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(document.body.querySelector('.outfit-tag-editor-popover')).toBeNull()
    expect(document.body.querySelector('.outfit-editor')).not.toBeNull()
    expect(wrapper.emitted('close')).toBeUndefined()
    wrapper.unmount()
  })

  it('selects a newly created tag after the parent confirms persistence', async () => {
    const wrapper = mount(OutfitEditor, {
      attachTo: document.body,
      props: { visible: true, outfit: null, tags: ['甜美'], busy: false, messages: getOutfitMessages('zh') }
    })

    ;(document.body.querySelector('.outfit-editor-add-tag') as HTMLButtonElement).click()
    await wrapper.vm.$nextTick()
    const tagInput = document.body.querySelector('.outfit-tag-editor-popover input') as HTMLInputElement
    tagInput.value = '清新'
    tagInput.dispatchEvent(new Event('input', { bubbles: true }))
    ;(document.body.querySelector('.outfit-tag-editor-popover') as HTMLFormElement).requestSubmit()
    await wrapper.vm.$nextTick()
    expect(wrapper.emitted('addTag')).toEqual([['清新']])
    ;(wrapper.vm as unknown as { selectCreatedTag: (tag: string) => void }).selectCreatedTag('清新')
    await wrapper.setProps({ tags: ['甜美', '清新'] })
    expect(document.body.querySelectorAll('.outfit-tag-choices button')[1].classList).toContain('active')
    expect(document.body.querySelector('.outfit-tag-editor-popover')).toBeNull()
    wrapper.unmount()
  })
})

