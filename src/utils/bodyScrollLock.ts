import { onBeforeUnmount, watch, type Ref } from 'vue'

// 锁定页面背景滚动并隐藏根滚动条，支持多个模态窗口共享锁。
let lockCount = 0
let previousBodyOverflow = ''
let previousRootOverflowY = ''

export function acquireBodyScrollLock(): () => void {
  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    previousRootOverflowY = document.documentElement.style.overflowY
    document.body.style.overflow = 'hidden'
    document.documentElement.style.overflowY = 'hidden'
  }
  lockCount += 1
  let released = false
  return () => {
    if (released) return
    released = true
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflowY = previousRootOverflowY
      previousBodyOverflow = ''
      previousRootOverflowY = ''
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
