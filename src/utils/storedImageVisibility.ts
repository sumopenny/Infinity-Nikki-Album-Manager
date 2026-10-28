type VisibilityCallback = (visible: boolean) => void

const subscriptions = new Map<HTMLElement, VisibilityCallback>()
// 收到正常观察通知后由浏览器接管，仅为尚未通知的元素保留布局检查兜底。
const pending = new Set<HTMLElement>()
let observer: IntersectionObserver | undefined
let frame: number | undefined
let fallbackTimer: ReturnType<typeof setTimeout> | undefined

function checkVisibility() {
  frame = undefined
  for (const element of pending) {
    const rect = element.getBoundingClientRect()
    subscriptions.get(element)?.(
      rect.width > 0 &&
        rect.height > 0 &&
        rect.bottom >= -240 &&
        rect.top <= window.innerHeight + 240 &&
        rect.right >= 0 &&
        rect.left <= window.innerWidth
    )
  }
}

function scheduleCheck() {
  if (pending.size && frame === undefined) frame = requestAnimationFrame(checkVisibility)
}

/** 所有活动封面共用观察器、全局监听和调度；最后一张退出时释放全部资源。 */
export function observeStoredImageVisibility(
  element: HTMLElement,
  callback: VisibilityCallback
): () => void {
  if (!subscriptions.size) {
    if (typeof window.IntersectionObserver === 'function') {
      observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const target = entry.target as HTMLElement
            pending.delete(target)
            subscriptions.get(target)?.(entry.isIntersecting)
          }
        },
        { rootMargin: '240px 0px' }
      )
    }
    window.addEventListener('scroll', scheduleCheck, true)
    window.addEventListener('resize', scheduleCheck)
    window.addEventListener('focus', scheduleCheck)
  }
  subscriptions.set(element, callback)
  pending.add(element)
  if (observer) observer.observe(element)
  else callback(true)
  scheduleCheck()
  if (fallbackTimer === undefined) {
    fallbackTimer = setTimeout(() => {
      fallbackTimer = undefined
      scheduleCheck()
    }, 1000)
  }

  return () => {
    observer?.unobserve(element)
    subscriptions.delete(element)
    pending.delete(element)
    if (subscriptions.size) return
    observer?.disconnect()
    observer = undefined
    window.removeEventListener('scroll', scheduleCheck, true)
    window.removeEventListener('resize', scheduleCheck)
    window.removeEventListener('focus', scheduleCheck)
    if (frame !== undefined) cancelAnimationFrame(frame)
    frame = undefined
    clearTimeout(fallbackTimer)
    fallbackTimer = undefined
  }
}
