import { expect, it } from 'vitest'
import { effectScope } from 'vue'
import { createOperationCoordinator } from '../../src/composables/useOperationCoordinator'
it('keeps pending work locked after its scope stops and releases each task independently', async () => {
  const coordinator = createOperationCoordinator()
  const scope = effectScope()
  let finish!: () => void
  let fail!: (error: Error) => void
  const first = scope.run(() =>
    coordinator.run(
      'home',
      () =>
        new Promise<void>((resolve) => {
          finish = resolve
        })
    )
  )!
  const second = coordinator.run(
    'home',
    () =>
      new Promise<void>((_, reject) => {
        fail = reject
      })
  )
  let drained = false
  const drain = coordinator.waitForPending().then(() => {
    drained = true
  })
  scope.stop()
  expect(coordinator.isBusy.value).toBe(true)
  finish()
  await first
  expect(coordinator.isBusy.value).toBe(true)
  expect(drained).toBe(false)
  const rejected = expect(second).rejects.toThrow('failed')
  fail(new Error('failed'))
  await rejected
  await drain
  expect(drained).toBe(true)
  expect(coordinator.isBusy.value).toBe(false)
  coordinator.activeOperation.value = 'all-data-backup'
  await coordinator.run('camera', async () => {})
  expect(coordinator.isBusy.value).toBe(true)
  coordinator.activeOperation.value = null
  expect(coordinator.isBusy.value).toBe(false)
})
