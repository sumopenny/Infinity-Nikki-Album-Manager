import { describe, expect, it, vi } from 'vitest'
import { useConfirmDialog } from '../../src/composables/useConfirmDialog'

describe('confirmation secondary action', () => {
  it('cancels the destructive operation before exporting and clears the previous options', async () => {
    const dialog = useConfirmDialog()
    const backup = vi.fn(() => {
      expect(dialog.confirmDialog.value.visible).toBe(false)
    })
    const confirmed = dialog.openConfirmDialog({
      title: '清除数据',
      message: '无法撤销',
      tone: 'danger',
      confirmLabel: '清除',
      sections: [{ title: '将清除', items: ['收藏'] }],
      secondaryLabel: '备份',
      onSecondary: backup
    })
    await dialog.runSecondaryAction()
    expect(await confirmed).toBe(false)
    await dialog.runSecondaryAction()
    expect(backup).toHaveBeenCalledTimes(1)
    const next = dialog.openConfirmDialog({
      title: '普通确认',
      message: '说明',
      tone: 'info',
      confirmLabel: '继续'
    })
    expect(dialog.confirmDialog.value.sections).toBeUndefined()
    expect(dialog.confirmDialog.value.secondaryLabel).toBeUndefined()
    dialog.closeConfirmDialog(false)
    expect(await next).toBe(false)
  })
})
