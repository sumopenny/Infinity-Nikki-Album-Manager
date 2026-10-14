import { afterEach, expect, it, vi } from 'vitest'
import { describeHomeSchemeError } from '../../src/utils/homeBuild/homeSchemeErrors'
import { homeSchemeMessages } from '../../src/i18n/messages/homeScheme'

afterEach(() => vi.restoreAllMocks())
it.each(['zh', 'en'] as const)('classifies safe errors and hides raw diagnostic data (%s)', language => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  const messages = homeSchemeMessages[language]
  const cases = [
    [new DOMException('secret', 'QuotaExceededError'), 'storageFull'],
    [new DOMException('secret', 'NotAllowedError'), 'permissionDenied'],
    [new Error('home_scheme_image_missing'), 'imageInvalid'],
    [new Error('home_scheme_record_invalid'), 'dataInvalid'],
    [new Error('home_scheme_tag_in_use'), 'tagsChanged'],
    [new Error('home_scheme_record_changed'), 'recordChanged'],
    [new Error('home_scheme_backup_secret'), 'invalidBackup'],
    [new Error('token=secret'), 'operationFailed'],
    [new Error('constructor'), 'operationFailed'],
    [null, 'operationFailed']
  ] as const
  for (const [error, category] of cases) {
    expect(describeHomeSchemeError(error, messages, 'save')).toBe(messages[category])
    expect(warn).toHaveBeenLastCalledWith('[home-schemes]', { operation: 'save', category })
  }
  expect(JSON.stringify(warn.mock.calls)).not.toContain('secret')
})
