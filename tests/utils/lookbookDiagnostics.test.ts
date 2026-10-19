import { afterEach, expect, it, vi } from 'vitest'
import { lookbookTiming, measureLookbook } from '../../src/utils/outfit/lookbookDiagnostics'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('默认关闭诊断，存储访问受限也不影响解析结果', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.stubGlobal('sessionStorage', { getItem: () => null })
  expect(await measureLookbook('decode', async () => 42)).toBe(42)
  vi.stubGlobal('sessionStorage', {
    getItem: () => {
      throw new Error('denied')
    }
  })
  expect(await measureLookbook('decode', async () => 42)).toBe(42)
  expect(log).not.toHaveBeenCalled()
})

it('诊断只记录阶段和状态，保留原始返回值及异常', async () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.stubGlobal('sessionStorage', { getItem: () => '1' })
  const value = { code: 'private-code', payload: 'private-data' }
  expect(await measureLookbook('decode', async () => value)).toBe(value)
  const error = new Error('private-error-data')
  await expect(
    measureLookbook('decode', async () => {
      throw error
    })
  ).rejects.toBe(error)
  lookbookTiming('proxy_response', performance.now(), { status: 200, cache: 'HIT' })
  expect(log).toHaveBeenCalledTimes(3)
  expect(JSON.stringify(log.mock.calls)).not.toContain('private-')
  expect(log.mock.calls[1][1]).toMatchObject({ outcome: 'error', stage: 'decode' })
})
