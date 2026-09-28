import { describe, expect, it, beforeEach } from 'vitest'
import { acquireBodyScrollLock } from '../../src/utils/bodyScrollLock'

describe('body scroll lock', () => {
  beforeEach(() => {
    document.body.style.overflow = 'scroll'
    document.documentElement.style.overflowY = 'scroll'
  })

  it('restores the original overflow after the last lock is released', () => {
    const releaseFirst = acquireBodyScrollLock()
    const releaseSecond = acquireBodyScrollLock()

    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflowY).toBe('hidden')
    releaseFirst()
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overflowY).toBe('hidden')
    releaseSecond()
    expect(document.body.style.overflow).toBe('scroll')
    expect(document.documentElement.style.overflowY).toBe('scroll')
  })

  it('is safe to release the same lock more than once', () => {
    const release = acquireBodyScrollLock()
    release()
    release()

    expect(document.body.style.overflow).toBe('scroll')
    expect(document.documentElement.style.overflowY).toBe('scroll')
  })
})
