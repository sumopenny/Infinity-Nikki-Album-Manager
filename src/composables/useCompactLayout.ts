import { onBeforeUnmount, onMounted, ref } from 'vue'

/** 所有移动布局共用一个断点；按窗口宽度呈现，不用 UA 判断布局。 */
export function useCompactLayout() {
  const query =
    typeof window.matchMedia === 'function' ? window.matchMedia('(max-width: 899px)') : null
  const compact = ref(query?.matches ?? false)
  const update = () => {
    compact.value = query?.matches ?? false
  }
  onMounted(() => query?.addEventListener('change', update))
  onBeforeUnmount(() => query?.removeEventListener('change', update))
  return compact
}

/** 跟随软键盘和浏览器地址栏更新浮层可用高度，保持输入框及操作区可达。 */
export function useVisualViewport() {
  const update = () => {
    const viewport = window.visualViewport
    document.documentElement.style.setProperty(
      '--visible-height',
      `${viewport?.height ?? window.innerHeight}px`
    )
    document.documentElement.style.setProperty('--visible-top', `${viewport?.offsetTop ?? 0}px`)
  }
  onMounted(() => {
    update()
    window.addEventListener('resize', update)
    window.visualViewport?.addEventListener('resize', update)
    window.visualViewport?.addEventListener('scroll', update)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('resize', update)
    window.visualViewport?.removeEventListener('scroll', update)
    document.documentElement.style.removeProperty('--visible-height')
    document.documentElement.style.removeProperty('--visible-top')
  })
}
