// 目录访问：负责浏览器目录选择、读写权限、X6Game 授权复用和账号路径验证。
import type { LocaleMessages } from '../../i18n'
import { clearSavedX6GameDirectoryHandle, getSavedX6GameDirectoryHandle, saveX6GameDirectoryHandle } from './directoryStorage'

const HIGH_QUALITY_DIRECTORY_NAME = 'NikkiPhotos_HighQuality'
const LOW_QUALITY_DIRECTORY_NAME = 'NikkiPhotos_LowQuality'
const SCREENSHOT_DIRECTORY_NAME = 'ScreenShot'
type FileSystemMessages = LocaleMessages['fileSystem']

export interface X6GameDirectoryOptions { beforePickX6GameDirectory?: () => boolean | Promise<boolean>; beforeRequestX6GamePermission?: () => boolean | Promise<boolean>; allowUnrelatedAlbum?: boolean; /** 强制打开目录选择器，不复用已保存的授权句柄。 */ forcePick?: boolean }
function isMobileDevice(): boolean { return /android|iphone|ipod|ipad/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) }
function getSupportedDirectoryPicker(messages: FileSystemMessages): NonNullable<typeof window.showDirectoryPicker> { if (isMobileDevice()) throw new Error(messages.mobileBrowserUnsupported); if (!window.showDirectoryPicker) throw new Error(messages.unsupportedBrowser); return window.showDirectoryPicker }
function isCleanupTargetDirectory(name: string): boolean { return name === LOW_QUALITY_DIRECTORY_NAME || name === SCREENSHOT_DIRECTORY_NAME }
function isMissingDirectoryError(error: unknown): boolean { return error instanceof DOMException && error.name === 'NotFoundError' }
async function getRequiredNestedDirectory(root: FileSystemDirectoryHandle, segments: string[]): Promise<FileSystemDirectoryHandle> { let current = root; for (const segment of segments) current = await current.getDirectoryHandle(segment); return current }
async function ensureReadWritePermission(handle: FileSystemDirectoryHandle, requestPermission: boolean): Promise<boolean> { const options = { mode: 'readwrite' as const }; if (handle.queryPermission) { const current = await handle.queryPermission(options); if (current === 'granted') return true; if (!requestPermission) return false } if (!requestPermission && handle.requestPermission) return false; if (!handle.requestPermission) return true; return (await handle.requestPermission(options)) === 'granted' }
function normalizeDirectoryError(error: unknown, messages: FileSystemMessages): Error { if (!(error instanceof Error)) return new Error(messages.readFailed); const raw = error.message || ''; const name = error.name || ''; const normalized = `${name} ${raw}`.toLowerCase(); if (normalized.includes('system') || raw.includes('系统文件') || name === 'SecurityError') return new Error(messages.systemDirectory); if (name === 'AbortError') return new Error(messages.abortSelection); return error }

export async function resolveX6GameAccountDirectory(
  x6GameHandle: FileSystemDirectoryHandle,
  albumDirectoryHandle: FileSystemDirectoryHandle,
  messages: FileSystemMessages,
  allowUnrelatedAlbum = false
): Promise<string> {
  if (x6GameHandle.name !== 'X6Game') {
    throw new Error(messages.invalidX6GameDirectory)
  }

  if (isCleanupTargetDirectory(albumDirectoryHandle.name)) {
    throw new Error(messages.invalidX6GameDirectory)
  }
  if (albumDirectoryHandle.name !== HIGH_QUALITY_DIRECTORY_NAME && allowUnrelatedAlbum) return ''

  const relativePath = await x6GameHandle.resolve(albumDirectoryHandle)
  const accountDirectoryName = relativePath?.[2] ?? ''
  const hasExpectedPath =
    relativePath?.length === 4 &&
    relativePath[0] === 'Saved' &&
    relativePath[1] === 'GamePlayPhotos' &&
    relativePath[3] === albumDirectoryHandle.name
  const hasValidAccountDirectory =
    Boolean(accountDirectoryName) && accountDirectoryName !== '.' && accountDirectoryName !== '..' && !/[\\/]/.test(accountDirectoryName)

  if (!hasExpectedPath || !hasValidAccountDirectory) {
    throw new Error(messages.invalidX6GameDirectory)
  }

  return accountDirectoryName
}

/**
 * 提示用户选择并授权当前相册对应的 X6Game 文件夹。
 * 参数：albumDirectoryHandle 为当前高画质相册句柄，messages 为文件系统提示文案。
 * 返回：验证通过的 X6Game 目录句柄和当前账号目录名。
 */
async function pickValidatedX6GameDirectory(
  albumDirectoryHandle: FileSystemDirectoryHandle,
  messages: FileSystemMessages,
  options: X6GameDirectoryOptions = {}
): Promise<{ directoryHandle: FileSystemDirectoryHandle; accountDirectoryName: string }> {
  const showDirectoryPicker = getSupportedDirectoryPicker(messages)

  if (options.beforePickX6GameDirectory && !(await options.beforePickX6GameDirectory())) {
    throw new Error(messages.abortSelection)
  }

  const directoryHandle = await showDirectoryPicker({
    id: 'infinity-nikki-x6game',
    mode: 'readwrite',
    startIn: albumDirectoryHandle
  })
  const hasPermission = await ensureReadWritePermission(directoryHandle, true)

  if (!hasPermission) {
    throw new Error(messages.permissionRequired)
  }

  const accountDirectoryName = await resolveX6GameAccountDirectory(
    directoryHandle,
    albumDirectoryHandle,
    messages,
    options.allowUnrelatedAlbum
  )
  await saveX6GameDirectoryHandle(directoryHandle)
  return { directoryHandle, accountDirectoryName }
}

async function getValidatedX6GameDirectory(
  albumDirectoryHandle: FileSystemDirectoryHandle,
  messages: FileSystemMessages,
  options: X6GameDirectoryOptions = {}
): Promise<{ directoryHandle: FileSystemDirectoryHandle; accountDirectoryName: string }> {
  if (isCleanupTargetDirectory(albumDirectoryHandle.name) && !options.allowUnrelatedAlbum) {
    throw new Error(messages.invalidAlbumDirectory)
  }

  const savedHandle = options.forcePick ? null : await getSavedX6GameDirectoryHandle()

  if (savedHandle) {
    let hasPermission = await ensureReadWritePermission(savedHandle, false)

    if (!hasPermission) {
      if (options.beforeRequestX6GamePermission && !(await options.beforeRequestX6GamePermission())) {
        throw new Error(messages.abortSelection)
      }
      hasPermission = await ensureReadWritePermission(savedHandle, true)
    }

    if (hasPermission) {
      try {
        const accountDirectoryName = await resolveX6GameAccountDirectory(
          savedHandle,
          albumDirectoryHandle,
          messages,
          options.allowUnrelatedAlbum
        )
        return { directoryHandle: savedHandle, accountDirectoryName }
      } catch {
        await clearSavedX6GameDirectoryHandle()
      }
    }
  }

  try {
    return await pickValidatedX6GameDirectory(albumDirectoryHandle, messages, options)
  } catch (error) {
    throw normalizeDirectoryError(error, messages)
  }
}

/** 获取当前相册对应的 X6Game 目录授权。参数：albumDirectoryHandle 为当前相册，messages 为文案，options 为授权确认回调。 */
export async function getX6GameDirectoryForAlbum(
  albumDirectoryHandle: FileSystemDirectoryHandle,
  messages: FileSystemMessages,
  options: X6GameDirectoryOptions = {}
): Promise<{ directoryHandle: FileSystemDirectoryHandle; accountDirectoryName: string }> {
  return getValidatedX6GameDirectory(albumDirectoryHandle, messages, options)
}

/**
 * 独立于相册授权 X6Game 文件夹，供专项清理使用。
 * 参数：messages 为文件系统提示文案，options 为授权确认回调。
 * 返回：验证通过的 X6Game 目录句柄；句柄会与搭配码授权共用同一份持久化记录。
 */
export async function pickStandaloneX6GameDirectory(
  messages: FileSystemMessages,
  options: X6GameDirectoryOptions = {}
): Promise<FileSystemDirectoryHandle> {
  const savedHandle = await getSavedX6GameDirectoryHandle()

  if (!options.forcePick && savedHandle && savedHandle.name === 'X6Game') {
    let hasPermission = await ensureReadWritePermission(savedHandle, false)

    if (!hasPermission) {
      if (options.beforeRequestX6GamePermission && !(await options.beforeRequestX6GamePermission())) {
        throw new Error(messages.abortSelection)
      }
      hasPermission = await ensureReadWritePermission(savedHandle, true)
    }

    if (hasPermission) return savedHandle
    await clearSavedX6GameDirectoryHandle()
  }

  const showDirectoryPicker = getSupportedDirectoryPicker(messages)

  try {
    if (options.beforePickX6GameDirectory && !(await options.beforePickX6GameDirectory())) {
      throw new Error(messages.abortSelection)
    }

    const directoryHandle = await showDirectoryPicker({
      id: 'infinity-nikki-x6game',
      mode: 'readwrite'
    })
    if (directoryHandle.name !== 'X6Game') {
      throw new Error(messages.invalidX6GameDirectory)
    }
    const hasPermission = await ensureReadWritePermission(directoryHandle, true)
    if (!hasPermission) {
      throw new Error(messages.permissionRequired)
    }

    await saveX6GameDirectoryHandle(directoryHandle)
    return directoryHandle
  } catch (error) {
    throw normalizeDirectoryError(error, messages)
  }
}

/**
 * 列出游戏拍照目录下的全部账号文件夹名。
 * 参数：x6GameHandle 为已授权的 X6Game 目录句柄。
 * 返回：Saved\GamePlayPhotos 下的子目录名列表；目录不存在时返回空数组。
 */
export async function listGamePlayPhotoAccounts(x6GameHandle: FileSystemDirectoryHandle): Promise<string[]> {
  let gamePlayPhotosHandle: FileSystemDirectoryHandle
  try {
    gamePlayPhotosHandle = await getRequiredNestedDirectory(x6GameHandle, ['Saved', 'GamePlayPhotos'])
  } catch (error) {
    if (isMissingDirectoryError(error)) return []
    throw error
  }

  const accounts: string[] = []
  for await (const [name, handle] of gamePlayPhotosHandle.entries()) {
    if (handle.kind === 'directory') accounts.push(name)
  }
  return accounts.sort()
}

