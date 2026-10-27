import { computed } from 'vue'
import { mount, flushPromises } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import AllDataBackup from '../../src/components/AllDataBackup.vue'
import { useOperationNotice } from '../../src/composables/useOperationNotice'
import { messages } from '../../src/i18n'

vi.mock('../../src/utils/backup/backupAvailability', () => ({ hasAllBackupData: vi.fn() }))
vi.mock('../../src/utils/backup/allDataBackup', () => ({ exportAllDataBackup: vi.fn() }))
import { hasAllBackupData } from '../../src/utils/backup/backupAvailability'
import { exportAllDataBackup } from '../../src/utils/backup/allDataBackup'

it.each(['success', 'failure', 'empty'] as const)(
  'clears the all-data loading notice on %s',
  async (outcome) => {
    vi.mocked(hasAllBackupData).mockResolvedValue(outcome !== 'empty')
    vi.mocked(exportAllDataBackup).mockImplementation(async () => {
      if (outcome === 'failure') throw new Error('Backup failed')
      return 'backup.zip'
    })
    const notices = useOperationNotice(computed(() => messages.zh))
    const wrapper = mount(AllDataBackup, {
      props: {
        language: 'zh',
        disabled: false,
        onStatus: (
          message: string,
          tone: 'success' | 'warning' | 'error' | 'info',
          loading?: boolean,
          downloadFiles?: File[]
        ) =>
          notices.showStatus({ message, tone, loading, downloadFiles, source: 'all-data-export' })
      }
    })
    try {
      await flushPromises()
      await wrapper.vm.exportData()
      expect(notices.notices.value).toHaveLength(1)
      expect(notices.notices.value[0]).toMatchObject({ loading: false, source: 'all-data-export' })
      expect(notices.notices.value[0]?.message).toContain(
        outcome === 'success'
          ? '已生成全部数据备份'
          : outcome === 'failure'
            ? '操作失败'
            : '暂无可导出的数据'
      )
    } finally {
      wrapper.unmount()
      notices.dispose()
    }
  }
)
