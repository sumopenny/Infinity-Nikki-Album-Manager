// 使用帮助文案：网站介绍、功能说明、教程、注意事项和操作方式。
import type { LocaleMessages } from '../types'

export const helpAboutZh: LocaleMessages['helpAbout'] = {
  title: '使用帮助与介绍', eyebrow: '暖立方 · 无限暖暖工具集', introTitle: '网站介绍',
  intro: '暖立方是一个在浏览器本地运行的无限暖暖工具集，覆盖相册管理、搭配码、照片参数解析和专项清理，帮助你整理游戏照片与搭配资料。',
  privacyNote: '照片、搭配码、备注和本地设置保存在你的设备上，网站不会上传本地照片。部分搭配码解析服务和外部链接按对应功能说明工作。',
  featuresTitle: '特色功能',
  features: [
    { icon: 'images', title: '相册管理', text: '按拍摄日期整理照片，支持预览、复制、收藏、备注、最近删除、恢复和永久删除。' },
    { icon: 'outfit', title: '搭配码管理', text: '添加、编辑、标签筛选、批量导入导出，并可同步游戏内新增搭配码。' },
    { icon: 'camera', title: '照片参数', text: '支持直接解析 CameraParams 参数串，也支持完整照片参数和多 UID 解密。' },
    { icon: 'cleanup', title: '专项清理', text: '清理低画质照片、截图、崩溃快照、运行日志和游戏网页缓存。' },
    { icon: 'search', title: '显示与搜索', text: '搜索文件名和备注，调整缩略图比例，切换深色主题和中英文界面。' },
    { icon: 'tools', title: '辅助工具', text: '提供搭配码解析、抽卡吉时、问题反馈和点赞等辅助功能。' }
  ],
  tutorialTitle: '使用教程',
  tutorialSections: [
    { title: '首次使用', items: ['选择 NikkiPhotos_HighQuality 相册文件夹即可开始浏览。', '如需完整照片参数或游戏数据同步，再授权 X6Game 文件夹。', '网站只读取你选择的本地目录，不需要上传照片。'] },
    { title: '照片浏览与操作', items: ['通过左侧全部照片、收藏、搭配方案和最近删除切换视图。', '使用日期树跳转年份、月份或日期，顶部搜索框搜索文件名和备注。', '单击选择照片，双击打开大图；卡片上可收藏、编辑备注和解析照片参数。', '大图中可使用方向键切换，滚轮缩放，拖动查看。'] },
    { title: '搭配码管理', items: ['点击添加方案创建搭配卡片，可添加图片、搭配码、备注和标签。', '在搭配页面顶部输入搭配码可直接解析；已填写搭配码的卡片可点击右上角解析。', '使用标签筛选方案，导入会合并有效数据而不会覆盖已有方案，导出会生成 ZIP 备份。'] },
    { title: '相机参数解析', items: ['可在参数工具中直接输入 CameraParams 参数串。', '完整照片解析会扫描 X6Game/Saved/GamePlayPhotos 下的账号目录作为候选 UID。', '候选 UID 全部失败时输入正确 UID；成功 UID 会保存到浏览器，后续自动尝试。'] },
    { title: '专项清理', items: ['授权 X6Game 后选择清理项目和账号范围。', '清理前会显示文件数量和占用空间，确认后才会执行。'] }
  ],
  notesTitle: '注意事项', notes: ['清除缓存主要移除网站保存的目录状态；清除数据还会移除偏好设置、目录授权和手动 UID。', '永久删除照片或搭配方案不可恢复，请在操作前确认。', '完整照片参数解析需要原始照片尾部数据和正确 UID；当前相册不需要位于 X6Game 目录内。', '导出文件会写入当前相册或你选择的目标目录，关闭网页不会删除本地照片。', '建议使用支持 File System Access API 的现代浏览器。'],
  mouseTitle: '鼠标操作', mouseItems: ['单击照片可选择，双击打开大图预览。', '悬停照片可查看拍摄时间与文件大小。', '大图放大后可拖动查看，并可使用滚轮缩放。'],
  keyboardTitle: '快捷键', keyboardItems: ['方向键切换上一张或下一张。', 'Esc 关闭菜单、弹窗或大图预览。', 'Delete 删除当前预览照片。'], confirm: '我知道了', closeAria: '关闭使用帮助与介绍窗口'
}

export const helpAboutEn: LocaleMessages['helpAbout'] = {
  title: 'Help and introduction', eyebrow: 'NikkiCube · Infinity Nikki Toolkit', introTitle: 'About this site',
  intro: 'NikkiCube is a browser-local Infinity Nikki Toolkit for album management, outfit codes, photo-parameter decoding, and targeted cleanup.',
  privacyNote: 'Photos, outfit codes, notes, and local settings stay on your device. The site does not upload local photos. Some outfit-code services and external links follow their own feature descriptions.',
  featuresTitle: 'Highlights',
  features: [
    { icon: 'images', title: 'Album management', text: 'Organize photos by capture date, preview, copy, favorite, add notes, restore, or permanently delete them.' },
    { icon: 'outfit', title: 'Outfit codes', text: 'Add, edit, filter, import, export, and synchronize in-game outfit codes.' },
    { icon: 'camera', title: 'Photo parameters', text: 'Decode CameraParams strings directly or decode complete photos with multiple UID candidates.' },
    { icon: 'cleanup', title: 'Targeted cleanup', text: 'Clean low-quality photos, screenshots, crash snapshots, runtime logs, and game web cache.' },
    { icon: 'search', title: 'Display and search', text: 'Search filenames and notes, adjust thumbnail ratios, and switch theme and language.' },
    { icon: 'tools', title: 'Utilities', text: 'Use outfit-code decoding, lucky pull times, feedback, and homepage likes.' }
  ],
  tutorialTitle: 'How to use',
  tutorialSections: [
    { title: 'Getting started', items: ['Choose the NikkiPhotos_HighQuality album folder to begin browsing.', 'Authorize X6Game only when you need complete photo parameters or game-data synchronization.', 'The site reads the folders you choose locally and does not need to upload photos.'] },
    { title: 'Browse and manage photos', items: ['Use All photos, Favorites, Outfit codes, and Recently Deleted in the left navigation.', 'Use the date tree to jump to a year, month, or date; search filenames and notes from the top bar.', 'Click to select and double-click to preview; cards provide favorite, note, and photo-parameter actions.', 'Use arrow keys, wheel zoom, and dragging in the full-screen preview.'] },
    { title: 'Manage outfit codes', items: ['Add a plan with an image, outfit code, note, and tag.', 'Enter a code at the top of the Outfit Code page or decode a saved code from its card.', 'Filter by tags; imports merge valid data without overwriting existing plans, and exports create a ZIP backup.'] },
    { title: 'Decode photo parameters', items: ['Enter a CameraParams string directly in the parameter tool.', 'Complete-photo decoding scans account folders under X6Game/Saved/GamePlayPhotos as candidate UIDs.', 'If all candidates fail, enter the correct UID; a successful UID is saved in the browser for future attempts.'] },
    { title: 'Targeted cleanup', items: ['Authorize X6Game, then choose the cleanup item and account scope.', 'File counts and sizes are shown before confirmation.'] }
  ],
  notesTitle: 'Important notes', notes: ['Clear cache mainly removes saved site directory state; clear data also removes preferences, directory authorization, and manual UIDs.', 'Permanent deletion of photos or outfit plans cannot be undone.', 'Complete photo decoding needs the original photo tail and a correct UID; the current album does not need to be inside X6Game.', 'Exports are written to the current album or a directory you choose. Closing the page does not delete local photos.', 'Use a modern browser with File System Access API support.'],
  mouseTitle: 'Mouse', mouseItems: ['Click a photo to select it; double-click to open the preview.', 'Hover a photo to see its capture time and file size.', 'Drag a zoomed preview and use the mouse wheel to zoom.'],
  keyboardTitle: 'Keyboard', keyboardItems: ['Use the arrow keys to move between photos.', 'Press Esc to close a menu, dialog, or preview.', 'Press Delete to delete the current preview photo.'], confirm: 'Got it', closeAria: 'Close help and introduction'
}
