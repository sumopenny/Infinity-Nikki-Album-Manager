// 更新记录文案：当前版本和历史版本保持结构化，便于发布时维护。
import type { LocaleMessages } from '../types'

export const updateLogZh: LocaleMessages['updateLog'] = {
  title: '更新记录',
  helpAbout: '使用帮助',
  currentTitle: '当前版本',
  currentVersion: 'v2.0.1',
  currentDate: '2026.10.14 更新',
  currentItems: [
    '新增共鸣记录云同步：支持注册、登录账号，手动上传共鸣记录，并在电脑或手机登录同一账号下载，实现跨设备同步。每个账号保存一份云端存档；上传完整覆盖云端，下载完整覆盖本地，操作前可核对账号与记录数量。登录和本地修改不会自动同步。',
    '支持管理云端存档：登录后可确认删除云端共鸣存档，保留账号、登录状态和本地记录。',
    '调整共鸣导入方式：从奇美鸭梨或 JSON 文件导入时，确认后以本次预览结果替换全部本地共鸣记录。',
    '“清除数据”支持完整重置网站：确认后清除当前浏览器中的方案、图片、标签、共鸣记录、收藏及设置，重新加载回到初始状态。操作不可撤销，请先导出备份；电脑原文件及云端存档保留。',
    '优化使用逻辑和用户体验，并和大喵去吃了一顿大餐🍟🍔🍕🍝🍩'
  ],
  historyTitle: '历史版本记录',
  history: [
    {
      version: 'v2.0',
      items: [
        '手机网页版正式上线，界面全面升级！现在可以直接用手机浏览器管理搭配码、家园方案、相机参数收藏和共鸣记录，随时查看、整理与分享你的游戏灵感。新增底部四模块导航，重新设计顶部工具栏、卡片与操作布局，让常用功能更适合手机浏览和触摸操作。',
        '现有电脑端数据可迁移到手机：在电脑端“更多”中选择“导出全部数据”，将生成的 ZIP 文件传给手机，再用手机浏览器打开网站，在“更多”中选择“导入全部数据”，即可迁移搭配码、家园方案、相机参数收藏和共鸣记录。',
        '优化手机搜索与筛选：顶部放大镜支持搜索当前模块；标签窗口支持搜索、添加和拖拽排序，共鸣筛选集中提供卡池排序、星级筛选与套装快速定位。',
        '优化卡片与批量操作：常用操作统一放在卡片底部，方便复制、编辑、删除、解析。',
        '优化大图与编辑体验：支持单指滑动翻页、双指缩放和放大后拖动；优化弹窗布局、输入区域与软键盘避让，统一过渡动画和按压反馈。',
        '更新使用帮助与界面细节：手机和电脑分别展示对应的中英文帮助，优化排版、显示、视图设置及布局。'
      ]
    },
    {
      version: 'v1.8.2',
      items: [
        '搭配码与家园方案数据迁移至浏览器存储：搭配码、家园方案数据不再保存在所选相册文件夹中，改为存入浏览器并所有相册共用；进入对应页面后自动迁移旧数据，迁移成功自动清理旧文件夹。',
        '新增“导出全部数据 / 导入全部数据”：可在“更多”菜单中一键将搭配码、家园方案、相机参数收藏和共鸣记录打包到一个全部数据备份 ZIP 中。',
        '支持数据跨设备迁移：在电脑上导出全部数据，将 ZIP 并发送到手机，手机上打开网页即可导入数据并正常使用除相册外的其他模块。',
        '搭配码自动更新优化：无需先选择相册，授权 X6Game 文件夹即可使用自动更新。',
        '界面与体验优化：优化相关页面细节。'
      ]
    },
    {
      version: 'v1.8.1',
      items: [
        '新增相机参数收藏：将收藏夹分为“相机参数”和“照片收藏”，支持从照片参数解析窗口直接收藏，或输入相机参数码自动解析后保存。',
        '支持自定义名称、单标签分类、标签排序与搜索，以及参数复制、编辑、详情查看和批量删除。',
        '支持上传或更换收藏封面，保存时自动转换为 WebP。',
        '支持相机参数收藏 ZIP 备份导入与导出。'
      ]
    },
    {
      version: 'v1.8',
      items: [
        '新增共鸣记录模块：支持从美鸭梨导入共鸣记录，提供登录凭据获取指引，预览确认后保存。电脑获取登录凭据cookie后发送给手机，用手机端访问网页也可输入凭据查看共鸣记录',
        '支持共鸣数据导入导出：兼容暖暖共鸣录新旧版 JSON 文件，可导出本工具备份；导入时更新对应套装，保留其他本地记录。',
        '展示套装获取详情：支持查看第一套、第二套部件抽数，以及套装总抽数和平均抽数；部件按获取顺序展示，兼容文件中的手动补录标记。',
        '支持快速定位、排序与筛选：通过侧栏快速定位套装，可按卡池最新或最早排序，并筛选五星、四星记录。',
        '云端同步、衣柜数据等功能正在开发中，敬请期待'
      ]
    },
    {
      version: 'v1.7.1',
      items: [
        '相册侧边栏新增“拍摄动作”分类：开启“自动解析动作”后，自动识别每张照片的拍照动作，按动作分组，支持按动作编号（新动作优先）、名称、照片数量、最近拍摄时间排序；未使用动作和未解析的照片单独成组。开关默认关闭，照片较多时网页可能卡顿，可按需开启。',
        '动作解析结果在浏览器本地缓存，重新打开相册无需重复解析；“清除缓存”“清除数据”会同步清理照片动作解析缓存。'
      ]
    },
    {
      version: 'v1.7',
      items: [
        '新增家园方案管理模块：支持添加家园码和组合码，输入方案码后自动解析方案名称、类型、版本、家具数量等信息。',
        '新增家园方案 ZIP 备份导入导出，导出文件放在当前所选相册文件夹中。',
        '“清除缓存”改为清理搭配码和家园方案解析缓存。',
        '优化使用体验，并改进标签按钮动画、加载提示等。'
      ]
    },
    {
      version: 'v1.6.3',
      items: [
        '搭配码解析新增部件类型标注：在部件名称后显示发型、头饰、睫毛等类型，方便快速辨认。',
        '新增可点击的部件详情：点击解析结果中的部件图片，可查看当前部件、所属套装及套装图、进化/焕新状态和染色条件；有染色数据时还会展示区域、染色盘、色号与颜色。',
        '暖立方官网页面已上线，并带暖暖去观摩了一下🤩'
      ]
    },
    {
      version: 'v1.6.2',
      items: [
        '新增本地照片参数解析：可在工具栏解析窗口中选择电脑、手机上的游戏原图进行拍摄参数解析。该功能手机也可用，手机解析时需手动输入拍摄照片用的账号的 UID 。',
        '品牌名称升级为“暖立方 / NikkiCube”，暖立方 Nikki³ | 为每一张心动留个位置——官方主题网站即将上线✨',
        '更新搭配码解析图鉴到2.10版本。'
      ]
    },
    {
      version: 'v1.6.1',
      items: [
        '新增选中照片后可删除对应低画质图片的功能：按名称匹配并永久删除当前账号 ScreenShot 和 NikkiPhotos_LowQuality 中的图片，保留当前相册原图。',
        '改版“更新记录”窗口，重新整理更新版本的展示。',
        '优化了一些问题并和暖暖出去看了场电影💅。'
      ]
    },
    {
      version: 'v1.6',
      items: [
        '新增照片参数解析功能，支持从照片缩略图右上角、大图预览工具栏或“工具”菜单解析，解析结果展示相机、环境、画面、动作、灯光、滤镜等参数，支持复制相机参数一键导入游戏。',
        '新增“工具”菜单，集中专项清理、抽卡吉时、参数/搭配码解析统一解析窗口。',
        '抽卡吉时更新为 2.10 内容。',
        '手机访问网页虽然不能管理相册，但可从工具菜单里使用相机参数、搭配码解析功能。'
      ]
    },
    {
      version: 'v1.5',
      items: [
        '新增搭配码解析功能：搭配码页面新增直接输入解析入口，搭配卡片右上角同步新增解析按钮。',
        '新增主页点赞功能。'
      ]
    },
    {
      version: 'v1.4.1',
      items: [
        '取消 X6Game 授权相册限制。',
        '新增相册图片批量导入与导出功能。',
        '多选图片底栏支持导出选中图片。'
      ]
    },
    {
      version: 'v1.4',
      items: [
        '新增相册图片批量导入与导出功能。',
        '导出时取消会保留已完成的目标文件和源照片。',
        '正常完成导出后，可选择将成功导出的源照片移入最近删除。'
      ]
    },
    {
      version: 'v1.3.3',
      items: [
        '新增 2.9 版本抽卡吉时模块。',
        '提升 ZIP 导入导出、图片处理、批量删除和恢复及专项清理速度。'
      ]
    },
    {
      version: 'v1.3.2',
      items: [
        '新增照片和搭配码备注功能。',
        '新增顶部搜索框，支持搜索文件名、搭配码和备注。',
        '提升 ZIP 导入导出、图片处理、批量删除和恢复及专项清理速度。'
      ]
    },
    {
      version: 'v1.3.1',
      items: [
        '优化照片时间读取，无法从文件名读取时间时使用图片最后修改时间。',
        '新增更新记录入口。'
      ]
    },
    {
      version: 'v1.3.0 补充版',
      items: [
        '新增专项清理窗口，支持清理低画质图片、截图、崩溃快照、运行日志和网页缓存。',
        '新增问题反馈入口。'
      ]
    },
    {
      version: 'v1.3.0',
      items: ['新增专项清理窗口，支持清理低画质图片、截图、崩溃快照、运行日志和网页缓存。']
    },
    {
      version: 'v1.2.3',
      items: ['搭配码新增标签显示在列表首位，并支持拖拽调整顺序。', '优化动画效果和部分操作逻辑。']
    },
    { version: 'v1.2.2', items: ['优化搭配码导入导出性能。', '完善 X6Game 授权与清理逻辑。'] },
    { version: 'v1.2.1', items: ['搭配码编辑窗口新增快捷创建标签功能。'] },
    { version: 'v1.2', items: ['新增星绘图册搭配码管理模块。'] },
    { version: 'v1.1.1', items: ['优化 CSS 样式、页面布局和显示效果。'] },
    { version: 'v1.1', items: ['重新调整页面布局，使结构更合理、操作逻辑更清晰。'] },
    {
      version: 'v1.0.2',
      items: ['新增全部照片、收藏夹和最近删除视图。', '支持照片移入回收站、预览、恢复和永久删除。']
    },
    { version: 'v1.0.1', items: ['新增图片懒加载，减少高分辨率照片造成的页面卡顿。'] },
    {
      version: 'v1.0.0',
      items: [
        '初始版本：支持按日期管理和浏览照片、收藏夹、大图预览、键盘操作、缩略图比例调整，以及低画质照片和游戏截图清理。'
      ]
    }
  ],
  dontShowAgain: '当前版本不再提示',
  confirm: '我知道了',
  closeAria: '关闭更新记录窗口'
}

export const updateLogEn: LocaleMessages['updateLog'] = {
  title: 'Release history',
  helpAbout: 'Help',
  currentTitle: 'Current version',
  currentVersion: 'v2.0.1',
  currentDate: 'Updated 2026.10.14',
  currentItems: [
    'Added resonance cloud sync: register and sign in to an account, manually upload your resonance records, and download them on another computer or phone signed in to the same account for cross-device syncing. Each account keeps one cloud save; uploading fully overwrites the cloud copy and downloading fully overwrites the local copy, so check the account and record count before confirming. Sign-in and local changes do not sync automatically.',
    'Manage cloud saves: after signing in, you can confirm the deletion of the cloud resonance save while keeping your account, sign-in status, and local records.',
    'Adjusted resonance import: when importing from Pear-Pal or a JSON file, confirming replaces all local resonance records with the previewed results.',
    '"Clear data" can now fully reset the site: after confirmation it clears schemes, photos, tags, resonance records, favorites, and settings in the current browser, then reloads to the initial state. This cannot be undone—export a backup first; original files on your computer and cloud saves are kept.',
    'Polished the logic and experience, and took Momo out for a big meal 🍟🍔🍕🍝🍩'
  ],
  historyTitle: 'Previous releases',
  history: [
    {
      version: 'v2.0',
      items: [
        'The mobile web version is officially live with a full interface upgrade! You can now manage outfit codes, home schemes, camera-parameter favorites, and resonance records directly in your mobile browser—view, organize, and share your game inspirations anytime. Added a bottom four-module navigation and redesigned the top toolbar, cards, and action layouts to better suit mobile browsing and touch use.',
        'Existing desktop data can be transferred to your phone: on desktop, choose Export all data from the More menu, send the generated ZIP to your phone, open the site in your mobile browser, and choose Import all data from the More menu to migrate outfit codes, home schemes, camera-parameter favorites, and resonance records.',
        'Improved mobile search and filtering: the magnifier at the top searches the current module; the tag window supports search, adding, and drag-to-reorder, and resonance filters consolidate banner sorting, star-rating filters, and quick outfit navigation.',
        'Improved cards and batch operations: common actions are now placed at the bottom of each card for easy copy, edit, delete, and decode.',
        'Improved preview and editing: support one-finger swipe paging, pinch-to-zoom, and panning while zoomed; improved dialog layouts, input areas, and on-screen keyboard avoidance, and unified transition animations and press feedback.',
        'Updated help and interface details: mobile and desktop each show their corresponding Chinese/English help, with improved typography, display, view settings, and layout.'
      ]
    },
    {
      version: 'v1.8.2',
      items: [
        'Outfit codes and home schemes are now stored in the browser and shared across all albums instead of the selected album folder. Old data is migrated automatically when you enter the page, and the old folder is removed after a successful migration.',
        'Added Export all data / Import all data: from the More menu, bundle outfit codes, home schemes, camera favorites, and resonance records into a single all-data ZIP backup.',
        'Supports cross-device transfer: export all data on your computer and send the ZIP to your phone, then open the site on your phone to import the data and use every module except the album normally.',
        'Auto-update for outfit codes improved: authorize the X6Game folder to use auto-update without selecting an album first.',
        'Interface and experience polish: refined related page details.'
      ]
    },
    {
      version: 'v1.8.1',
      items: [
        'Added camera-parameter favorites: Favorites is now split into "Camera Parameters" and "Photo Favorites". Save directly from the photo-parameter decoding window, or enter a camera-parameter code to decode and save automatically.',
        'Supports custom names, single-tag categories, tag sorting and search, plus parameter copying, editing, detail viewing, and batch deletion.',
        'Supports uploading or replacing a favorite cover image, automatically converted to WebP on save.',
        'Supports ZIP backup import and export for camera-parameter favorites.'
      ]
    },
    {
      version: 'v1.8',
      items: [
        'Added Resonance Records: import resonance records from Pear-Pal, with instructions for obtaining sign-in credentials and a preview before saving. After obtaining the sign-in cookie credentials on a computer, send them to your phone and enter them on the website in your mobile browser to view resonance records.',
        'Added resonance data import and export: supports old and new Resonance Recorder JSON files and exports backups for this app; importing updates matching outfit records while keeping other local records.',
        'View outfit acquisition details: check piece pull counts for the first and second sets, plus total and average pulls for each outfit; pieces are displayed in acquisition order, with support for manual edit markers in imported files.',
        'Added quick navigation, sorting, and filtering: use the sidebar to jump to an outfit, sort banners newest or oldest first, and filter 5-star or 4-star records.',
        'Cloud sync, wardrobe data, and more features are in development. Stay tuned!'
      ]
    },
    {
      version: 'v1.7.1',
      items: [
        'Added a "Capture Actions" view to the album sidebar: after turning on "Auto-parse actions", each photo\'s pose is detected automatically and photos are grouped by action, with sorting by action ID (newest first), name, photo count, or latest capture time; photos with no action and unparsed photos form separate groups. The switch is off by default—turn it on as needed, since parsing many photos may slow down the page.',
        'Action results are cached locally in the browser, so reopening an album does not reparse every photo; "Clear cache" and "Clear all data" also clear the photo-action parse cache.'
      ]
    },
    {
      version: 'v1.7',
      items: [
        'Added a Home schemes management module: add home codes and combo codes, and entering a scheme code automatically parses the scheme name, type, version, furniture count, and other information.',
        'Added ZIP backup import and export for home schemes; exported files are placed in the currently selected album folder.',
        '"Clear cache" now clears the outfit-code and home-scheme parsing caches.',
        'Polished the experience, including tag-button animations and loading hints.'
      ]
    },
    {
      version: 'v1.6.3',
      items: [
        'Outfit-code decoding now labels clothing-part types: the part type (hairstyle, hair accessory, eyelashes, etc.) is shown after the part name for quick identification.',
        'Added clickable part details: click a part image in the decoding results to view the current part, its outfit set and set image, evolution/refinement status, and dyeing conditions; when dyeing data is available, the region, dye palette, color number, and color are also displayed.',
        'The NikkiCube official website is now live, and I took Nikki along to take a look 🤩'
      ]
    },
    {
      version: 'v1.6.2',
      items: [
        'Added local photo parameter decoding: select game original photos on your computer or phone in the toolbar decoding window to analyze shooting parameters. The feature is also available on mobile; when decoding on mobile, you must manually enter the UID of the account used to take the photo.',
        'Upgraded the brand name to "NikkiCube / 暖立方". NikkiCube Nikki³ | A place for every heart-flutter — the official theme website is coming soon ✨',
        'Updated the outfit-code decoding gallery to version 2.10.'
      ]
    },
    {
      version: 'v1.6.1',
      items: [
        "Added deletion of the matching low-quality images for selected photos: images are matched by name and permanently deleted from the current account's ScreenShot and NikkiPhotos_LowQuality folders, while the original photos in the album are kept.",
        'Redesigned the Release history window and reorganized how releases are presented.',
        'Fixed various issues and went to see a movie with Nikki 💅.'
      ]
    },
    {
      version: 'v1.6',
      items: [
        'Added photo parameter decoding from photo thumbnails, the large-preview toolbar, or the Tools menu. Results include camera, environment, scene, pose, lighting, and filter parameters, and camera parameters can be copied for one-click import into the game.',
        'Added a Tools menu that centralizes targeted cleanup, lucky pull times, and parameter/outfit-code decoding.',
        'Updated lucky pull times to version 2.10 content.',
        'Mobile web access cannot manage albums, but camera-parameter and outfit-code decoding are available from the Tools menu.'
      ]
    },
    {
      version: 'v1.5',
      items: [
        'Added outfit-code decoding: the Outfit Code page now provides a direct input and decode entry, and outfit cards now have a decode button in the upper-right corner.',
        'Added homepage likes.'
      ]
    },
    {
      version: 'v1.4.1',
      items: [
        'Removed the X6Game album-location restriction.',
        'Added batch album photo import and export.',
        'The selection bar can export selected photos.'
      ]
    },
    {
      version: 'v1.4',
      items: [
        'Added batch album photo import and export.',
        'Cancelling an export keeps completed target files and source photos.',
        'After a completed export, successfully exported source photos can be moved to Recently Deleted.'
      ]
    },
    {
      version: 'v1.3.3',
      items: [
        'Added the 2.9 lucky pull times module.',
        'Improved ZIP transfer, image processing, deletion, recovery, and cleanup performance.'
      ]
    },
    {
      version: 'v1.3.2',
      items: [
        'Added notes for photos and outfit codes.',
        'Added filename, outfit-code, and note search.',
        'Improved ZIP transfer, image processing, deletion, recovery, and cleanup performance.'
      ]
    },
    {
      version: 'v1.3.1',
      items: [
        'Use the image modification time when the filename does not contain a readable capture time.',
        'Added the release history entry.'
      ]
    },
    {
      version: 'v1.3.0 Supplement',
      items: [
        'Added targeted cleanup for low-quality photos, screenshots, crash snapshots, runtime logs, and web cache.',
        'Added the feedback entry.'
      ]
    },
    {
      version: 'v1.3.0',
      items: [
        'Added targeted cleanup for low-quality photos, screenshots, crash snapshots, runtime logs, and web cache.'
      ]
    },
    {
      version: 'v1.2.3',
      items: [
        'New outfit tags appear first and can be reordered by dragging.',
        'Polished animations and interaction details.'
      ]
    },
    {
      version: 'v1.2.2',
      items: [
        'Improved outfit-code import and export performance.',
        'Improved X6Game authorization and cleanup.'
      ]
    },
    { version: 'v1.2.1', items: ['Added quick tag creation to the outfit editor.'] },
    { version: 'v1.2', items: ['Added the Starry Gallery outfit-code management module.'] },
    { version: 'v1.1.1', items: ['Polished CSS, layout, and visual presentation.'] },
    {
      version: 'v1.1',
      items: ['Reorganized the interface for clearer structure and interaction logic.']
    },
    {
      version: 'v1.0.2',
      items: [
        'Added All photos, Favorites, and Recently Deleted views.',
        'Added trash, preview, restore, and permanent deletion workflows.'
      ]
    },
    { version: 'v1.0.1', items: ['Added lazy loading to reduce high-resolution photo lag.'] },
    {
      version: 'v1.0.0',
      items: [
        'Initial release: date-based photo browsing, Favorites, full-screen preview, keyboard controls, thumbnail ratios, and targeted cleanup.'
      ]
    }
  ],
  dontShowAgain: "Don't show again for this version",
  confirm: 'Got it',
  closeAria: 'Close release history'
}
