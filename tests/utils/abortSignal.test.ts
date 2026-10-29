import { expect, it } from 'vitest'
import { throwIfSignalAborted } from '../../src/utils/abortSignal'

it('supports signals without throwIfAborted', () => {
  const controller = new AbortController()
  const signal = { aborted: false, reason: undefined } as AbortSignal
  expect(() => throwIfSignalAborted(signal)).not.toThrow()
  controller.abort(new Error('cancelled'))
  expect(() => throwIfSignalAborted(controller.signal)).toThrow('cancelled')
  expect(() => throwIfSignalAborted({ aborted: true } as AbortSignal)).toThrow()
})
