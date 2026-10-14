import { ref, watch, type Ref } from 'vue'

/** 手机模态层在退场结束前保留滚动锁和焦点管理；重开或切换窗口不会被旧退场释放。 */
export function useModalPresence(open: Ref<boolean>, enabled: Ref<boolean>) {
  const present = ref(enabled.value && open.value)
  const leaving = new Set<Element>()
  watch(
    [open, enabled],
    ([isOpen, isEnabled]) => {
      if (!isEnabled) {
        present.value = false
        leaving.clear()
      } else if (isOpen) present.value = true
    },
    { flush: 'sync' }
  )

  function beforeEnter(element: Element) {
    leaving.delete(element)
    element.removeAttribute('inert')
  }

  function beforeLeave(element: Element) {
    // 退场节点仍可见，但不再接受点击和键盘操作。
    if (enabled.value) {
      leaving.add(element)
      element.setAttribute('inert', '')
    }
  }

  function afterLeave(element: Element) {
    leaving.delete(element)
    if (!open.value && !leaving.size) present.value = false
  }

  return { present, beforeEnter, beforeLeave, afterLeave }
}
