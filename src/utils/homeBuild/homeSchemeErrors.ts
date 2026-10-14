import type { HomeSchemeMessages } from '../../i18n/messages/homeScheme'

type MessageKey =
  | 'storageFull'
  | 'recordChanged'
  | 'duplicateCode'
  | 'invalidCode'
  | 'invalidBackup'
  | 'permissionDenied'
  | 'imageInvalid'
  | 'dataInvalid'
  | 'tagsChanged'
  | 'operationFailed'
const errors: Record<string, MessageKey> = {
  QuotaExceededError: 'storageFull',
  NotAllowedError: 'permissionDenied',
  SecurityError: 'permissionDenied',
  home_scheme_record_changed: 'recordChanged',
  home_scheme_record_missing: 'recordChanged',
  home_scheme_code_duplicate: 'duplicateCode',
  home_scheme_code_invalid: 'invalidCode',
  home_scheme_image_invalid: 'imageInvalid',
  home_scheme_image_missing: 'imageInvalid',
  home_scheme_record_invalid: 'dataInvalid',
  home_scheme_tags_invalid: 'dataInvalid',
  home_scheme_tag_invalid: 'dataInvalid',
  home_scheme_tag_missing: 'dataInvalid',
  home_scheme_tag_in_use: 'tagsChanged',
  home_scheme_tag_order_invalid: 'tagsChanged',
  'Image dimensions are invalid': 'imageInvalid',
  'Image dimensions are too large': 'imageInvalid',
  'Image is empty': 'imageInvalid',
  'Image is too large': 'imageInvalid',
  'Canvas is unavailable': 'imageInvalid',
  'WebP conversion failed': 'imageInvalid',
  InvalidStateError: 'dataInvalid',
  NotReadableError: 'imageInvalid',
  EncodingError: 'imageInvalid'
}

/** 错误仅映射到白名单类别；诊断不输出原始异常、用户输入、文件名或凭据。 */
export function describeHomeSchemeError(
  error: unknown,
  messages: HomeSchemeMessages,
  operation: string
): string {
  const message = error instanceof Error ? error.message : ''
  const name = error instanceof Error ? error.name : ''
  const key =
    (Object.hasOwn(errors, message) ? errors[message] : undefined) ??
    (Object.hasOwn(errors, name) ? errors[name] : undefined) ??
    (message.startsWith('home_scheme_backup_') ? 'invalidBackup' : 'operationFailed')
  console.warn('[home-schemes]', { operation, category: key })
  return messages[key]
}
