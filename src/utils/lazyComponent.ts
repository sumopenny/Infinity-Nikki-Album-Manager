import {
  defineAsyncComponent,
  defineComponent,
  h,
  onBeforeUnmount,
  shallowRef,
  ref,
  watch,
  type Component
} from 'vue'
import AsyncModuleState from '../components/AsyncModuleState.vue'

const MODULE_LOAD_TIMEOUT_MS = 15000

/** 模块按需加载；失败或等待超过 15 秒时提供用户恢复入口。 */
export function lazyComponent<T extends Component>(
  loader: () => Promise<{ default: T }>,
  dialog = false
) {
  const retryLoad = shallowRef<(() => void) | null>(null)
  const reloadRequired = shallowRef(false)
  const loadStartedAt = shallowRef(0)
  let loadingOrigin: HTMLElement | null = null
  let isDialogOpen = () => false
  return defineAsyncComponent<T>({
    loader: async () => {
      retryLoad.value = null
      loadStartedAt.value = Date.now()
      const result = await loader()
      // 真正弹窗初始化前还原来源焦点，避免它记住即将卸载的加载占位按钮。
      if (isDialogOpen() && loadingOrigin?.isConnected) loadingOrigin.focus({ preventScroll: true })
      return result.default
    },
    loadingComponent: defineComponent({
      inheritAttrs: false,
      setup(_, { attrs }) {
        const timedOut = ref(false)
        let timer: ReturnType<typeof setTimeout> | undefined
        // 仅更新占位状态，不包裹 import Promise；迟到模块仍遵守最新 visible 状态。
        watch(
          [loadStartedAt, retryLoad],
          ([started, retry]) => {
            clearTimeout(timer)
            timedOut.value = false
            if (retry) return
            timer = setTimeout(
              () => {
                timedOut.value = true
              },
              Math.max(0, MODULE_LOAD_TIMEOUT_MS - (Date.now() - started))
            )
          },
          { immediate: true, flush: 'sync' }
        )
        loadingOrigin =
          document.activeElement instanceof HTMLElement ? document.activeElement : null
        isDialogOpen = () => dialog && attrs.visible !== false
        onBeforeUnmount(() => {
          clearTimeout(timer)
          isDialogOpen = () => false
        })
        return () =>
          dialog && attrs.visible === false
            ? null
            : h(AsyncModuleState, {
                language: document.documentElement.lang.startsWith('en') ? 'en' : 'zh',
                dialog: dialog && attrs.visible !== false,
                failed: timedOut.value || !!retryLoad.value,
                reloadRequired: timedOut.value || reloadRequired.value,
                onRetry: () => {
                  // 浏览器会缓存模块下载失败；此类错误由用户明确重新加载页面恢复。
                  if (timedOut.value || reloadRequired.value) window.location.reload()
                  else retryLoad.value?.()
                },
                onClose: () => {
                  if (typeof attrs.onClose === 'function') attrs.onClose()
                  if (loadingOrigin?.isConnected) loadingOrigin.focus({ preventScroll: true })
                }
              })
      }
    }),
    onError(error, retry) {
      reloadRequired.value =
        error.name === 'TypeError' ||
        /preload CSS|dynamically imported module|module script failed/i.test(error.message)
      retryLoad.value = retry
    }
  })
}
