import { nextTick, onBeforeUnmount, watch, type Ref } from 'vue'

/** 小型操作浮层的焦点循环与还原；其他模态层获得焦点时不抢占其键盘事件。 */
export function useModalFocus(active: Ref<boolean>, panel: Ref<HTMLElement | null>, close: () => void) {
  let previous: HTMLElement | null = null
  const keydown = (event: KeyboardEvent) => {
    if (!active.value || event.defaultPrevented || !panel.value?.contains(document.activeElement)) return
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key !== 'Tab') return
    const elements = [...panel.value.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select, [tabindex="0"]')]
      .filter(element => element.getClientRects().length)
    const first = elements[0], last = elements.at(-1)
    if (!first) { event.preventDefault(); return }
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.value)) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === panel.value)) { event.preventDefault(); first.focus() }
  }
  watch(active, async (open) => {
    if (open) {
      previous = document.activeElement as HTMLElement | null
      await nextTick()
      if (!active.value) return
      panel.value?.focus()
      document.addEventListener('keydown', keydown)
    } else {
      document.removeEventListener('keydown', keydown)
      if (previous?.isConnected) previous.focus()
    }
  })
  onBeforeUnmount(() => document.removeEventListener('keydown', keydown))
}
