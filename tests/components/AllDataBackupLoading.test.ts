import { flushPromises, mount } from '@vue/test-utils'
import { expect, it, vi } from 'vitest'
import AllDataBackup from '../../src/components/AllDataBackup.vue'

const { loaded } = vi.hoisted(() => ({ loaded: vi.fn() }))
vi.mock('../../src/utils/backup/backupAvailability', () => ({
  hasAllBackupData: async () => false
}))
vi.mock('../../src/utils/backup/allDataBackup', () => {
  loaded()
  return {}
})

it('keeps the picker synchronous without importing the heavy backup module on mount', async () => {
  const wrapper = mount(AllDataBackup, { props: { language: 'zh', disabled: false } })
  await flushPromises()
  expect(loaded).not.toHaveBeenCalled()
  const click = vi.spyOn(wrapper.get('input').element, 'click')
  wrapper.vm.chooseImport()
  expect(click).toHaveBeenCalledTimes(1)
  expect(loaded).not.toHaveBeenCalled()
  wrapper.unmount()
})
