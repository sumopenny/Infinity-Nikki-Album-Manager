import { onBeforeUnmount, watch, type Ref } from 'vue'

// 根节点负责锁定滚动；body 使用 clip，避免创建新滚动容器导致手机 sticky 头栏移出屏幕。
let lockCount = 0
let previousBodyOverflow = ''
let previousRootOverflowY = ''

export function acquireBodyScrollLock(): () => void {
  if (lockCount === 0) {
    previousBodyOverflow = document.body.style.overflow
    previousRootOverflowY = document.documentElement.style.overflowY
    document.body.style.overflow = 'clip'
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
  watch(
    locked,
    (isLocked) => {
      if (isLocked && !release) release = acquireBodyScrollLock()
      if (!isLocked) {
        release?.()
        release = null
      }
    },
    { immediate: true }
  )
  onBeforeUnmount(() => release?.())
}
