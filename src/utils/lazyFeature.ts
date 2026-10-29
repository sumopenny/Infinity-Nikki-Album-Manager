import { defineAsyncComponent, defineComponent, h, shallowRef, type Component } from 'vue'
import type { Language } from '../i18n/types'
import { reportError } from './errorReporting/errorReporter'
import LazyDialogFallback from '../components/LazyDialogFallback.vue'

/** 页面首次使用时加载；网络失败保留重试入口，不要求刷新丢失当前会话。 */
export function lazyFeature<T extends Component>(
  loader: () => Promise<T | { default: T }>,
  language: () => Language,
  dialog?: { active: () => boolean; cancel: () => void }
) {
  const retry = shallowRef<(() => void) | null>(null)
  const loading = defineComponent({
    // 加载占位不接收业务组件的属性和事件，避免误透传到模态层。
    inheritAttrs: false,
    setup: () => () => {
      if (dialog)
        return h(LazyDialogFallback, {
          active: dialog.active(),
          failed: !!retry.value,
          language: language(),
          onCancel: dialog.cancel,
          onRetry: () => retry.value?.()
        })
      const zh = language() === 'zh'
      return h('div', { class: 'empty-album inline-empty', role: 'status' }, [
        h(
          'p',
          retry.value
            ? zh
              ? '页面加载失败，请重试。'
              : 'This view could not load. Please retry.'
            : zh
              ? '正在加载…'
              : 'Loading…'
        ),
        retry.value
          ? h(
              'button',
              { type: 'button', class: 'primary-button', onClick: retry.value },
              zh ? '重试' : 'Retry'
            )
          : null
      ])
    }
  })
  return defineAsyncComponent({
    loader,
    loadingComponent: loading,
    delay: 150,
    onError(error, tryAgain) {
      reportError(error, { module: 'app', action: 'load-feature' })
      retry.value = () => {
        retry.value = null
        tryAgain()
      }
    }
  })
}
