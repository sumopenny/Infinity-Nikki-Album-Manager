// 确认弹窗状态：将一次确认交互封装为可等待的 Promise 流程。
import { ref } from 'vue'
import type { ConfirmDialogTone } from '../components/ConfirmDialog.vue'

export interface ConfirmDialogState {
  visible: boolean
  title: string
  message: string
  tone: ConfirmDialogTone
  confirmLabel: string
  cancelLabel?: string
  resolve?: (confirmed: boolean) => void
}

/** 将确认弹窗封装为 Promise，业务流程只关心用户是否确认。 */
export function useConfirmDialog() {
  const confirmDialog = ref<ConfirmDialogState>({
    visible: false,
    title: '',
    message: '',
    tone: 'info',
    confirmLabel: ''
  })

  const openConfirmDialog = (options: Omit<ConfirmDialogState, 'visible' | 'resolve'>): Promise<boolean> => {
    if (confirmDialog.value.visible) return Promise.resolve(false)
    return new Promise((resolve) => {
      confirmDialog.value = { ...options, visible: true, resolve }
    })
  }

  const closeConfirmDialog = (confirmed: boolean) => {
    const resolve = confirmDialog.value.resolve
    confirmDialog.value = { visible: false, title: '', message: '', tone: 'info', confirmLabel: '' }
    resolve?.(confirmed)
  }

  return { confirmDialog, openConfirmDialog, closeConfirmDialog }
}
