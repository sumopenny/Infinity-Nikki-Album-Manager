// 更新记录文案：当前版本和历史版本保持结构化，便于发布时维护。
import type { LocaleMessages } from '../types'

export const updateLogZh: LocaleMessages['updateLog'] = {
  title: '更新记录', currentTitle: '当前版本', currentVersion: 'v1.6', currentDate: '2026.9.22 更新',
  currentItems: ['新增照片参数解析功能，支持从照片缩略图右上角、大图预览工具栏或“工具”菜单解析，解析结果展示相机、环境、画面、动作、灯光、滤镜等参数，支持复制相机参数一键导入游戏。', '新增“工具”菜单，集中专项清理、抽卡吉时、参数/搭配码解析统一解析窗口。', '抽卡吉时更新为 2.10 内容。', '手机访问网页虽然不能管理相册，但可从工具菜单里使用相机参数、搭配码解析功能。'],
  historyTitle: '历史版本记录',
  history: [
    { version: 'v1.5', items: ['新增搭配码解析功能：搭配码页面新增直接输入解析入口，搭配卡片右上角同步新增解析按钮。', '新增主页点赞功能。'] },
    { version: 'v1.4.1', items: ['取消 X6Game 授权相册限制。', '新增相册图片批量导入与导出功能。', '多选图片底栏支持导出选中图片。'] },
    { version: 'v1.4', items: ['新增相册图片批量导入与导出功能。', '导出时取消会保留已完成的目标文件和源照片。', '正常完成导出后，可选择将成功导出的源照片移入最近删除。'] },
    { version: 'v1.3.3', items: ['新增 2.9 版本抽卡吉时模块。', '提升 ZIP 导入导出、图片处理、批量删除和恢复及专项清理速度。'] },
    { version: 'v1.3.2', items: ['新增照片和搭配码备注功能。', '新增顶部搜索框，支持搜索文件名、搭配码和备注。', '提升 ZIP 导入导出、图片处理、批量删除和恢复及专项清理速度。'] },
    { version: 'v1.3.1', items: ['优化照片时间读取，无法从文件名读取时间时使用图片最后修改时间。', '新增更新记录入口。'] },
    { version: 'v1.3.0 补充版', items: ['新增专项清理窗口，支持清理低画质图片、截图、崩溃快照、运行日志和网页缓存。', '新增问题反馈入口。'] },
    { version: 'v1.3.0', items: ['新增专项清理窗口，支持清理低画质图片、截图、崩溃快照、运行日志和网页缓存。'] },
    { version: 'v1.2.3', items: ['搭配码新增标签显示在列表首位，并支持拖拽调整顺序。', '优化动画效果和部分操作逻辑。'] },
    { version: 'v1.2.2', items: ['优化搭配码导入导出性能。', '完善 X6Game 授权与清理逻辑。'] },
    { version: 'v1.2.1', items: ['搭配码编辑窗口新增快捷创建标签功能。'] },
    { version: 'v1.2', items: ['新增星绘图册搭配码管理模块。'] },
    { version: 'v1.1.1', items: ['优化 CSS 样式、页面布局和显示效果。'] },
    { version: 'v1.1', items: ['重新调整页面布局，使结构更合理、操作逻辑更清晰。'] },
    { version: 'v1.0.2', items: ['新增全部照片、收藏夹和最近删除视图。', '支持照片移入回收站、预览、恢复和永久删除。'] },
    { version: 'v1.0.1', items: ['新增图片懒加载，减少高分辨率照片造成的页面卡顿。'] },
    { version: 'v1.0.0', items: ['初始版本：支持按日期管理和浏览照片、收藏夹、大图预览、键盘操作、缩略图比例调整，以及低画质照片和游戏截图清理。'] }
  ],
  dontShowAgain: '当前版本不再提示', confirm: '我知道了', closeAria: '关闭更新记录窗口'
}

export const updateLogEn: LocaleMessages['updateLog'] = {
  title: 'Release history', currentTitle: 'Current version', currentVersion: 'v1.6', currentDate: 'Updated 2026.9.22',
  currentItems: ['Added photo parameter decoding from photo thumbnails, the large-preview toolbar, or the Tools menu. Results include camera, environment, scene, pose, lighting, and filter parameters, and camera parameters can be copied for one-click import into the game.', 'Added a Tools menu that centralizes targeted cleanup, lucky pull times, and parameter/outfit-code decoding.', 'Updated lucky pull times to version 2.10 content.', 'Mobile web access cannot manage albums, but camera-parameter and outfit-code decoding are available from the Tools menu.'],
  historyTitle: 'Previous releases',
  history: [
    { version: 'v1.5', items: ['Added outfit-code decoding: the Outfit Code page now provides a direct input and decode entry, and outfit cards now have a decode button in the upper-right corner.', 'Added homepage likes.'] },
    { version: 'v1.4.1', items: ['Removed the X6Game album-location restriction.', 'Added batch album photo import and export.', 'The selection bar can export selected photos.'] },
    { version: 'v1.4', items: ['Added batch album photo import and export.', 'Cancelling an export keeps completed target files and source photos.', 'After a completed export, successfully exported source photos can be moved to Recently Deleted.'] },
    { version: 'v1.3.3', items: ['Added the 2.9 lucky pull times module.', 'Improved ZIP transfer, image processing, deletion, recovery, and cleanup performance.'] },
    { version: 'v1.3.2', items: ['Added notes for photos and outfit codes.', 'Added filename, outfit-code, and note search.', 'Improved ZIP transfer, image processing, deletion, recovery, and cleanup performance.'] },
    { version: 'v1.3.1', items: ['Use the image modification time when the filename does not contain a readable capture time.', 'Added the release history entry.'] },
    { version: 'v1.3.0 Supplement', items: ['Added targeted cleanup for low-quality photos, screenshots, crash snapshots, runtime logs, and web cache.', 'Added the feedback entry.'] },
    { version: 'v1.3.0', items: ['Added targeted cleanup for low-quality photos, screenshots, crash snapshots, runtime logs, and web cache.'] },
    { version: 'v1.2.3', items: ['New outfit tags appear first and can be reordered by dragging.', 'Polished animations and interaction details.'] },
    { version: 'v1.2.2', items: ['Improved outfit-code import and export performance.', 'Improved X6Game authorization and cleanup.'] },
    { version: 'v1.2.1', items: ['Added quick tag creation to the outfit editor.'] },
    { version: 'v1.2', items: ['Added the Starry Gallery outfit-code management module.'] },
    { version: 'v1.1.1', items: ['Polished CSS, layout, and visual presentation.'] },
    { version: 'v1.1', items: ['Reorganized the interface for clearer structure and interaction logic.'] },
    { version: 'v1.0.2', items: ['Added All photos, Favorites, and Recently Deleted views.', 'Added trash, preview, restore, and permanent deletion workflows.'] },
    { version: 'v1.0.1', items: ['Added lazy loading to reduce high-resolution photo lag.'] },
    { version: 'v1.0.0', items: ['Initial release: date-based photo browsing, Favorites, full-screen preview, keyboard controls, thumbnail ratios, and targeted cleanup.'] }
  ],
  dontShowAgain: "Don't show again for this version", confirm: 'Got it', closeAria: 'Close release history'
}
