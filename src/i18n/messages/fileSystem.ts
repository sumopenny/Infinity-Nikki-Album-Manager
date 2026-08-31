// 文件系统文案：目录选择、浏览器权限、授权失败、目录校验和兼容性提示文字。
import type { LocaleMessages } from '../types'

export const fileSystemZh: LocaleMessages['fileSystem'] = {
      readFailed: '读取相册失败，请重试。',
      systemDirectory: '无法打开此文件夹：浏览器不允许网页访问包含系统文件或受保护的目录。请直接选择 NikkiPhotos_HighQuality 图片文件夹，不要选择游戏安装根目录、C 盘根目录、Windows、Program Files 等上级目录。',
      abortSelection: '已取消选择相册文件夹。',
      permissionRequired: '已记住上次相册路径，但浏览器需要重新授权。请点击“选择/恢复相册路径”完成授权。',
      unsupportedBrowser: '当前浏览器不支持选择文件夹。请使用电脑上的最新版 Chrome、Edge 或其他兼容的 Chromium 浏览器，并在 localhost/HTTPS 环境运行。',
      mobileBrowserUnsupported: '手机浏览器不支持目录授权。请使用电脑上的 Chrome、Edge 或其他兼容的 Chromium 浏览器打开网站并选择相册文件夹。',
      invalidAlbumDirectory: '不能选择 NikkiPhotos_LowQuality 或 ScreenShot 文件夹执行专项清理。',
      invalidX6GameDirectory: '所选目录不是当前相册对应的 X6Game 文件夹，请选择路径中的 X6Game 文件夹后重试。',
      restoreX6GamePermissionPrompt: '已保存的 X6Game 文件夹授权已经失效。点击“继续授权”后，请在浏览器权限窗口中允许本站点编辑该文件夹；如果浏览器无法恢复授权，页面会再提示你重新选择 X6Game 文件夹，用于专项清理和自动读取最新搭配码。',
      selectX6GameDirectoryPrompt: '授权后可使用专项清理、自动读取游戏最新搭配码的功能。请在接下来的窗口中选择路径里的 X6Game 文件夹（...\\InfinityNikki Launcher\\InfinityNikki\\X6Game）。授权会被保存，后续可直接使用。'
    }
export const fileSystemEn: LocaleMessages['fileSystem'] = {
      readFailed: 'Failed to read the album. Please try again.',
      systemDirectory: 'Cannot open this folder: the browser does not allow web pages to access system or protected folders. Please choose NikkiPhotos_HighQuality directly instead of the game root folder, C drive root, Windows, Program Files, or other parent folders.',
      abortSelection: 'Album folder selection was canceled.',
      permissionRequired: 'The last album folder is remembered, but the browser needs permission again. Click “Choose / restore album folder” to authorize it.',
      unsupportedBrowser: 'This browser does not support folder selection. Please use the latest desktop version of Chrome, Edge, or another compatible Chromium browser and run on localhost/HTTPS.',
      mobileBrowserUnsupported: 'Mobile browsers do not support folder authorization. Open this site in Chrome, Edge, or another compatible Chromium browser on a computer to select an album folder.',
      invalidAlbumDirectory: 'NikkiPhotos_LowQuality and ScreenShot cannot be selected for one-click cleanup.',
      invalidX6GameDirectory: 'The selected folder is not the X6Game folder that contains the current album. Select that X6Game folder and try again.',
      restoreX6GamePermissionPrompt: 'The saved X6Game folder permission has expired. Click “Continue authorization”, then allow this site to edit the folder in the browser permission prompt. If the browser cannot restore access, the page will ask you to select X6Game again.',
      selectX6GameDirectoryPrompt: 'Authorize the X6Game folder for the current game installation to use targeted cleanup and automatically read the latest in-game outfit code. Select the X6Game folder in the next folder picker (...\\InfinityNikki Launcher\\InfinityNikki\\X6Game). The authorization will be remembered for future use.'
    }

