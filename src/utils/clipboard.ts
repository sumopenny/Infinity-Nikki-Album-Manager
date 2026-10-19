/** HTTP 下同步选中文本复制，避免等待异步任务后丢失用户点击上下文。 */
function copyWithSelection(text: string): boolean {
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const selection = document.getSelection()
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index).cloneRange()
      )
    : []
  const input =
    active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement ? active : null
  const start = input?.selectionStart
  const end = input?.selectionEnd
  const direction = input?.selectionDirection
  const field = document.createElement('textarea')
  field.value = text
  field.readOnly = true
  field.tabIndex = -1
  field.style.cssText =
    'position:fixed;top:0;left:0;width:1px;height:1px;padding:0;border:0;opacity:0.01;font-size:16px;pointer-events:none;user-select:text;-webkit-user-select:text'
  // 放在当前弹窗内部，避免焦点约束把临时输入框的焦点移走。
  const host = active?.closest('dialog, [role="dialog"], [aria-modal="true"]') ?? document.body
  try {
    host.appendChild(field)
    field.focus({ preventScroll: true })
    field.select()
    field.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    field.remove()
    if (active?.isConnected) active.focus({ preventScroll: true })
    if (input && start != null && end != null)
      input.setSelectionRange(start, end, direction ?? undefined)
    if (selection) {
      selection.removeAllRanges()
      ranges.forEach((range) => selection.addRange(range))
    }
  }
}

/** 优先使用系统剪贴板 API；不可用或被拒绝时尝试文本选择回退，不记录复制内容。 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!text) return false
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText)
    return copyWithSelection(text)
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return copyWithSelection(text)
  }
}
