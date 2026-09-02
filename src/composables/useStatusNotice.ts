import { ref } from 'vue'

export interface StatusNoticeOptions {
  loading?: boolean
  duration?: number
}

/** 统一管理顶部通知的显示、自动关闭和悬停暂停。 */
export function useStatusNotice() {
  const isVisible = ref(false)
  let timer: number | undefined
  let deadline = 0
  let remaining = 0
  let paused = false
  let loading = false

  const clearTimer = () => {
    if (timer === undefined) return
    window.clearTimeout(timer)
    timer = undefined
  }

  const hideAfter = (duration: number) => {
    remaining = duration
    deadline = Date.now() + duration
    timer = window.setTimeout(() => {
      isVisible.value = false
      timer = undefined
      remaining = 0
    }, duration)
  }

  const showNotice = (options: StatusNoticeOptions = {}) => {
    clearTimer()
    paused = false
    remaining = 0
    loading = Boolean(options.loading)
    isVisible.value = true
    if (!loading && options.duration !== undefined) hideAfter(options.duration)
  }

  const closeNotice = () => {
    clearTimer()
    paused = false
    remaining = 0
    loading = false
    isVisible.value = false
  }

  const pauseNotice = () => {
    if (!isVisible.value || loading || paused) return
    remaining = Math.max(0, deadline - Date.now())
    clearTimer()
    paused = true
  }

  const resumeNotice = () => {
    if (!paused || !isVisible.value || loading) return
    paused = false
    hideAfter(remaining)
  }

  return { isVisible, showNotice, closeNotice, pauseNotice, resumeNotice, dispose: clearTimer }
}
