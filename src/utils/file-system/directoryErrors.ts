import type { LocaleMessages } from '../../i18n'

export type DirectoryErrorCode = 'cancelled' | 'permission-denied' | 'invalid-directory' | 'read-failed' | 'system-directory'
export type FileSystemMessages = LocaleMessages['fileSystem']

/** 文件系统层统一错误；message 保留当前语言文案，code 供页面稳定映射。 */
export class DirectoryAccessError extends Error {
  readonly code: DirectoryErrorCode
  readonly cause?: unknown
  constructor(code: DirectoryErrorCode, message: string, cause?: unknown) {
    super(message)
    this.name = 'DirectoryAccessError'
    this.code = code
    this.cause = cause
  }
}

export function createDirectoryError(code: DirectoryErrorCode, messages: FileSystemMessages, cause?: unknown, messageOverride?: string): DirectoryAccessError {
  const messageByCode: Record<DirectoryErrorCode, string> = {
    cancelled: messages.abortSelection,
    'permission-denied': messages.permissionRequired,
    'invalid-directory': messages.invalidX6GameDirectory,
    'read-failed': messages.readFailed,
    'system-directory': messages.systemDirectory
  }
  const message = messageOverride ?? messageByCode[code]
  return new DirectoryAccessError(code, message, cause)
}

export function normalizeDirectoryError(error: unknown, messages: FileSystemMessages): DirectoryAccessError {
  if (error instanceof DirectoryAccessError) return error
  const record = error && typeof error === 'object' ? error as { name?: unknown; message?: unknown } : null
  const name = typeof record?.name === 'string' ? record.name : ''
  const rawMessage = typeof record?.message === 'string' ? record.message : ''
  const normalized = `${name} ${rawMessage}`.toLowerCase()
  if (name === 'AbortError') return createDirectoryError('cancelled', messages, error)
  if (normalized.includes('system') || rawMessage.includes('系统文件') || name === 'SecurityError') return createDirectoryError('system-directory', messages, error)
  return createDirectoryError('read-failed', messages, error)
}
