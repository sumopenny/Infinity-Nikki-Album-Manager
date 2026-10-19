// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { copyTextToClipboard } from '../../src/utils/clipboard'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(document, 'execCommand')
  document.body.replaceChildren()
})
// jsdom 默认没有剪贴板和 execCommand，为每个用例提供独立的浏览器能力。
function clipboard(writeText?: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('navigator', { clipboard: writeText ? { writeText } : undefined })
  const copy = vi.fn(() => true)
  Object.defineProperty(document, 'execCommand', { value: copy, configurable: true })
  return copy
}
it('uses the modern clipboard without creating a temporary field', async () => {
  const write = vi.fn().mockResolvedValue(undefined)
  const legacy = clipboard(write)
  expect(await copyTextToClipboard('搭配 ABC\n第二行')).toBe(true)
  expect(write).toHaveBeenCalledWith('搭配 ABC\n第二行')
  expect(legacy).not.toHaveBeenCalled()
  expect(document.querySelector('textarea')).toBeNull()
})
it('copies synchronously on HTTP, selects all text, and removes the temporary field', async () => {
  const legacy = clipboard()
  legacy.mockImplementation(() => {
    const field = document.activeElement as HTMLTextAreaElement
    expect(field.value).toBe('代码\n123')
    expect(field.selectionStart).toBe(0)
    expect(field.selectionEnd).toBe(6)
    expect(field.readOnly).toBe(true)
    return true
  })
  const result = copyTextToClipboard('代码\n123')
  expect(legacy).toHaveBeenCalledWith('copy')
  expect(await result).toBe(true)
  expect(document.querySelector('textarea')).toBeNull()
})
it('keeps fallback inside the active dialog and restores input focus and selection', async () => {
  const legacy = clipboard()
  document.body.innerHTML = '<section role="dialog"><textarea>original</textarea></section>'
  const original = document.querySelector('textarea')!
  original.focus()
  original.setSelectionRange(1, 4)
  legacy.mockImplementation(() => {
    expect(document.activeElement?.parentElement).toBe(original.parentElement)
    return true
  })
  expect(await copyTextToClipboard('replacement')).toBe(true)
  expect(document.activeElement).toBe(original)
  expect(original.value).toBe('original')
  expect([original.selectionStart, original.selectionEnd]).toEqual([1, 4])
  expect(document.querySelectorAll('textarea')).toHaveLength(1)
})
it('falls back after a rejected modern clipboard write', async () => {
  const legacy = clipboard(vi.fn().mockRejectedValue(new Error('NotAllowedError')))
  expect(await copyTextToClipboard('ABC')).toBe(true)
  expect(legacy).toHaveBeenCalledOnce()
})
it.each(['false', 'throw'])('reports a failed fallback (%s) and cleans up', async (mode) => {
  const legacy = clipboard()
  legacy.mockImplementation(() => {
    if (mode === 'throw') throw new Error('denied')
    return false
  })
  expect(await copyTextToClipboard('ABC')).toBe(false)
  expect(document.querySelector('textarea')).toBeNull()
})
it('rejects empty text without accessing the clipboard', async () => {
  const legacy = clipboard()
  expect(await copyTextToClipboard('')).toBe(false)
  expect(legacy).not.toHaveBeenCalled()
})
