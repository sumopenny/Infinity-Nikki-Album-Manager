import { onBeforeUnmount, watch, type Ref } from 'vue'

// 统一管理模态窗口的背景滚动锁定，支持多个窗口同时存在。
let lockCount = 0
let previousBodyOverflow = ''

export function acquireBodyScrollLock(): () => void {
  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
  let released = false
  return () => {
    if (released) return
    released = true
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) {
      document.body.style.overflow = previousBodyOverflow
      previousBodyOverflow = ''
    }
  }
}

export function useBodyScrollLock(locked: Ref<boolean>): void {
  let release: (() => void) | null = null
  watch(locked, (isLocked) => {
    if (isLocked && !release) release = acquireBodyScrollLock()
    if (!isLocked) {
      release?.()
      release = null
    }
  }, { immediate: true })
  onBeforeUnmount(() => release?.())
}
