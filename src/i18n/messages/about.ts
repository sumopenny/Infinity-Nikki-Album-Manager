// 关于页面文案：网站简介、功能说明、当前版本、历史版本和窗口操作文字。
import type { LocaleMessages } from '../types'

export const aboutZh: LocaleMessages['about'] = {
      title: '关于网站',
      introTitle: '网站简介',
      intro: '无限暖暖相册管理是一个纯本地运行的网站，照片和搭配码数据都只保存在你自己的设备上。',
      featuresTitle: '主要功能',
      features: [
        '相册管理：按拍摄日期整理游戏截图，支持预览、复制、收藏和移入相册。',
        '搭配码管理：管理星绘图册搭配方案，支持手动添加、批量导入，并自动同步游戏内新搭配码。',
        '专项清理：清理低画质照片、游戏截图、崩溃快照、运行日志和游戏内置网页缓存。'
      ],
      changelogTitle: '当前版本【2026.8.27更新】',
      // 更新日志只保留当前版本，发布新版本时替换该条内容，当前版本会自动带上“当前版本”标识
      changelog: [
        { version: 'v1.3.3', text: '新增2.9版本抽卡吉时模块。提升了 ZIP 导入导出、图片处理、批量删除和恢复及专项清理的速度' }
      ],
      historyLink: '更新记录',
      historyTitle: '历史版本记录',
      historyBack: '返回关于网站',
      historyBackAria: '返回关于网站',
      // 历史记录页从上一正式版本开始展示，当前版本只保留在关于页顶部。
      history: [
        { version: 'v1.3.2', text: '新增照片和搭配码备注功能，并增加顶部搜索框；照片搜索文件名/备注，搭配码搜索搭配码/备注；提升了 ZIP 导入导出、图片处理、批量删除和恢复及专项清理的速度。' },
        { version: 'v1.3.1', text: '优化相册照片时间读取：文件名不是类似2026_05_30_15_25_08_3094229的图片，现在会按图片最后修改时间显示；新增“更新记录”入口，可查看历史版本记录。' },
        { version: 'v1.3.0补充版', text: '新增专项清理窗口：支持清理低画质图片与截图、崩溃快照、运行日志和网页缓存，仅需授权 X6Game 文件夹即可使用。补充新增“问题反馈”入口：位于“更多”菜单，可在弹窗内直接填写反馈问卷。' },
        { version: 'v1.3.0', text: '新增专项清理窗口：支持清理低画质图片与截图、崩溃快照、运行日志和网页缓存，仅需授权 X6Game 文件夹即可使用。' },
        { version: 'v1.2.3', text: '搭配码新增标签现在会显示在列表首位，并支持拖拽调整顺序，排序结果会同步到搭配码编辑器。优化了动画效果和部分操作逻辑，更多一键清理功能考虑开发中，同时偷吃了一块大喵的五花肉🥩~' },
        { version: 'v1.2.2', text: '优化搭配码导入导出性能，完善 X6Game 授权与清理逻辑。家园码、组合码功能开发中。' },
        { version: 'v1.2.1', text: '搭配码编辑窗口新增快捷创建标签功能：在标签区域点击“+”按钮即可直接新建标签，创建成功后会自动选中该标签。' },
        { version: 'v1.2', text: '新增星绘图册搭配码管理模块，可手动添加、批量添加、自动同步游戏内新搭配码。（拍照参数、家园码管理模块开发中）' }
      ],
      dontShowAgain: '当前版本不再提示',
      confirm: '我知道了',
      closeAria: '关闭关于窗口'
    }
export const aboutEn: LocaleMessages['about'] = {
      title: 'About',
      introTitle: 'About this site',
      intro: 'Infinity Nikki Album Manager runs entirely locally. Your photos and outfit code data stay on your own device.',
      featuresTitle: 'Features',
      features: [
        'Album management: organize screenshots by capture date, with preview, copy, favorite and move-to-album.',
        'Outfit codes: manage Starry Gallery outfit plans with manual add, batch import, and auto sync of new in-game outfit codes.',
        'Targeted cleanup: clean low-quality photos, screenshots, crash snapshots, runtime logs, and web cache to free up disk space.'
      ],
      changelogTitle: 'Current version【2026.8.27 update】',
      changelog: [
        { version: 'v1.3.3', text: "Added the 2.9 version lucky times module. Improved the speed of ZIP import/export, image processing, batch deletion and recovery, and targeted cleanup." }
      ],
      historyLink: 'Release history',
      historyTitle: 'Release history',
      historyBack: 'Back to About',
      historyBackAria: 'Back to About',
      // The history page starts from the previous formal release; the current release stays on the About page.
      history: [
        { version: 'v1.3.2', text: "Added remark functionality for photos and outfit codes, and added a top search bar; photos are searched by filename/remark, and outfit codes are searched by outfit code/remark. Improved the speed of ZIP import/export, image processing, batch deletion and recovery, and targeted cleanup." },
        { version: 'v1.3.1', text: "Optimized album photo time reading: images whose filenames do not match the required date format now display using the image's last modified time; added a Release history entry for viewing past version notes." },
        { version: 'v1.3.0 Supplement', text: 'Added a targeted cleanup window: clean low-quality photos and screenshots, crash snapshots, runtime logs, and web cache with only X6Game folder authorization. Also added a Feedback entry in the More menu to fill out the survey in a dialog.' },
        { version: 'v1.3.0', text: 'Added a targeted cleanup window: clean low-quality photos and screenshots, crash snapshots, runtime logs, and web cache with only X6Game folder authorization.' },
        { version: 'v1.2.3', text: 'New outfit tags now appear first and can be reordered by dragging, with the order synchronized to the outfit editor. Animations and some interactions were polished, more one-click cleanup features were under consideration.' },
        { version: 'v1.2.2', text: 'Optimized outfit code import and export performance, and improved X6Game authorization and cleanup logic. Home codes and combination codes were under development.' },
        { version: 'v1.2.1', text: 'Added quick tag creation to the outfit editor: click the “+” button in the tag area to create a tag directly, which is selected automatically after creation.' },
        { version: 'v1.2', text: 'Added the Starry Gallery outfit code module: add manually, import in batches, and auto-sync new in-game outfit codes.' }
      ],
      dontShowAgain: "Don't show again for this version",
      confirm: 'Got it',
      closeAria: 'Close about window'
    }
