import { defineAsyncComponent, defineComponent, h, shallowRef, type Component } from 'vue'
import type { Language } from '../i18n/types'
import { reportError } from './errorReporting/errorReporter'

/** 页面首次使用时加载；网络失败保留重试入口，不要求刷新丢失当前会话。 */
export function lazyFeature<T extends Component>(
  loader: () => Promise<T | { default: T }>,
  language: () => Language
) {
  const retry = shallowRef<(() => void) | null>(null)
  const loading = defineComponent(() => () => {
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
