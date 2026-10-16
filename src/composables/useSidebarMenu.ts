import { onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue'

/** 共用侧栏菜单定位：浮层移出滚动容器，空间不足时向上展开，外层滚动时收起。 */
export function useSidebarMenu(close: () => void, getMenu: () => HTMLElement | null) {
  const menuStyle = ref<CSSProperties>({})
  function positionMenu(trigger: HTMLElement) {
    const box = trigger.getBoundingClientRect()
    const below = window.innerHeight - box.bottom - 14
    const above = box.top - 14
    const upward = below < 180 && above > below
    menuStyle.value = {
      position: 'fixed',
      left: box.left + 'px',
      right: 'auto',
      width: box.width + 'px',
      boxSizing: 'border-box',
      zIndex: '100',
      top: upward ? 'auto' : box.bottom + 6 + 'px',
      bottom: upward ? window.innerHeight - box.top + 6 + 'px' : 'auto',
      maxHeight: Math.max(40, Math.min(216, upward ? above : below)) + 'px'
    }
  }
  function onViewportChange(event: Event) {
    if (event.target instanceof Node && getMenu()?.contains(event.target)) return
    close()
  }
  onMounted(() => {
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
  })
  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
  })
  return { menuStyle, positionMenu }
}
