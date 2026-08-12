import type { Language } from './i18n'

export interface OutfitMessages {
  viewName: string
  eyebrow: string
  tagsTitle: string
  all: string
  pending: string
  uncategorized: string
  addTag: string
  tagPlaceholder: string
  confirmAddTag: string
  reorderTag: string
  deleteTag: string
  importData: string
  importing: string
  exportData: string
  exporting: string
  updating: string
  upToDate: string
  scanComplete: (added: number, failed: number) => string
  addOutfit: string
  editTitle: string
  imageLabel: string
  imageHint: string
  replaceImage: string
  codeLabel: string
  codePlaceholder: string
  tagLabel: string
  noTag: string
  cancel: string
  confirm: string
  saving: string
  copy: string
  edit: string
  delete: string
  emptyTitle: string
  emptyDescription: string
  imageRequired: string
  unsupportedImage: string
  imageLoadFailed: string
  operations: {
    albumOpenedWithFailures: (failed: number) => string
    saveSucceeded: (wasEditing: boolean) => string
    invalidTag: (maxLength: number) => string
    duplicateOrReservedTag: string
    tagLimitReached: (maxTags: number) => string
    tagAdded: string
    deleteTagTitle: string
    deleteTagMessage: (tag: string, usedCount: number) => string
    tagDeleted: string
    copySucceeded: string
    copyFailed: (code: string) => string
    deleteOutfitTitle: string
    deleteSelectedTitle: string
    confirmPermanentDelete: string
    permanentlyDelete: string
    outfitDeleted: string
    deleteIncomplete: string
    deletingSelected: string
    deletedSelected: (deletedCount: number, failedCount: number) => string
    exportTitle: string
    exportConfirm: (directoryName: string) => string
    exportAction: string
    exportSucceeded: (fileName: string, count: number) => string
    rejectedTags: (count: number) => string
    importCompleted: (added: number, duplicates: number, failed: number, tagNote: string) => string
  }
  guideTitle: string
  guideIntro: string
  guideFeaturedSection: { title: string; items: string[] }
  guideSections: Array<{ title: string; items: string[] }>
  guideDontShowAgain: string
  guideConfirm: string
  guideClose: string
  guideOpen: string
  count: (count: number) => string
}

const outfitMessages: Record<Language, OutfitMessages> = {
  zh: {
    viewName: '搭配码',
    eyebrow: 'OUTFITS',
    tagsTitle: '标签',
    all: '全部',
    pending: '待填写',
    uncategorized: '未分类',
    addTag: '添加标签',
    tagPlaceholder: '最多5个字符',
    confirmAddTag: '添加',
    reorderTag: '调整标签顺序',
    deleteTag: '删除标签',
    importData: '导入数据',
    importing: '正在导入',
    exportData: '导出数据',
    exporting: '正在生成备份',
    updating: '搭配码更新中…',
    upToDate: '搭配码已是最新状态。',
    scanComplete: (added, failed) => `搭配码更新完成：新增 ${added} 个，失败 ${failed} 个。`,
    addOutfit: '添加方案',
    editTitle: '编辑方案',
    imageLabel: '搭配图片',
    imageHint: '点击选择、拖拽或粘贴 JPG、PNG、WebP 图片',
    replaceImage: '更换图片',
    codeLabel: '搭配码',
    codePlaceholder: '可以留空，稍后填写',
    tagLabel: '标签（单选）',
    noTag: '不选择标签',
    cancel: '取消',
    confirm: '确定',
    saving: '正在保存',
    copy: '复制搭配码',
    edit: '编辑方案',
    delete: '删除方案',
    emptyTitle: '还没有搭配方案',
    emptyDescription: '添加方案，或把图片放入相册的 clothe 文件夹。',
    imageRequired: '请先选择一张搭配图片。',
    unsupportedImage: '请选择 JPG、JPEG、PNG 或 WebP 图片。',
    imageLoadFailed: '搭配图片读取失败',
    operations: {
      albumOpenedWithFailures: (failed) => `相册已打开，${failed} 个搭配方案读取或导入失败。`,
      saveSucceeded: (wasEditing) => wasEditing ? '保存成功。' : '添加成功。',
      invalidTag: (maxLength) => `标签不能为空，且最多为${maxLength}个字符。`,
      duplicateOrReservedTag: '标签名称已存在或属于系统筛选项。',
      tagLimitReached: (maxTags) => `最多只能创建${maxTags}个用户标签。`,
      tagAdded: '标签添加成功。',
      deleteTagTitle: '删除标签',
      deleteTagMessage: (tag, usedCount) => `“${tag}”正用于 ${usedCount} 个方案。删除后这些方案会归入“未分类”，图片和方案不会删除。`,
      tagDeleted: '标签已删除。',
      copySucceeded: '复制成功。',
      copyFailed: (code) => `复制失败，请手动复制：${code}`,
      deleteOutfitTitle: '删除搭配方案',
      deleteSelectedTitle: '永久删除搭配方案',
      confirmPermanentDelete: '确定永久删除选中搭配码吗？删除后不可恢复。',
      permanentlyDelete: '永久删除',
      outfitDeleted: '删除成功。',
      deleteIncomplete: '方案未能完整清理，请检查 clothe 文件夹中的残留文件。',
      deletingSelected: '正在永久删除搭配方案…',
      deletedSelected: (deletedCount, failedCount) => `已永久删除 ${deletedCount} 个搭配方案${failedCount ? `，${failedCount} 个删除失败。` : '。'}`,
      exportTitle: '导出搭配码数据',
      exportConfirm: (directoryName) => `导出的 ZIP 将自动保存在当前相册文件夹“${directoryName}”中。是否继续？`,
      exportAction: '开始导出',
      exportSucceeded: (fileName, count) => `导出成功：${fileName}（${count} 个方案），文件位于当前相册文件夹。`,
      rejectedTags: (count) => `另有 ${count} 个标签因超过限制未添加。`,
      importCompleted: (added, duplicates, failed, tagNote) => `导入完成：新增 ${added} 个方案，跳过 ${duplicates} 个重复方案，${failed} 个方案导入失败。${tagNote}`
    },
    guideTitle: '搭配码使用指南',
    guideIntro: '搭配图片、搭配码和标签都保存在当前相册本地，不会上传到网站服务器。',
    guideFeaturedSection: {
      title: '自动更新游戏搭配码',
      items: [
        '使用自动更新搭配码的功能需要授权当前游戏的 X6Game 文件夹。可前往页面右上角相册下拉栏进行文件夹授权。',
        '在游戏内点击分享按钮，需要在搭配截图右下角点击框选按钮，框选完成后生成搭配码，再返回网页，网站会自动更新该条搭配码数据。'
      ]
    },
    guideSections: [
      { title: '添加与编辑方案', items: ['点击“添加方案”，可以选择、拖拽或粘贴图片（点击窗口空白处 Ctrl+V 粘贴）。', '搭配码可以留空稍后填写；每个方案最多选择一个标签，双击图片可打开预览。'] },
      { title: '标签与整理', items: ['左侧可按全部、待填写、未分类和用户标签筛选。最多创建 40 个标签，每个标签不超过 5 个字符。', '删除正在使用的标签只会让相关方案归入“未分类”，不会删除图片或方案。'] },
      { title: '批量导入搭配图片', items: ['网站会在当前相册中创建 clothe 文件夹来管理搭配码。批量导入图片：直接把保存好的搭配图片放入该文件夹。', '打开相册、刷新相册或页面重新获得焦点时，这些图片会自动转换为待填写方案，再通过编辑补充搭配码和标签。'] },
      { title: '导入与导出', items: ['“导出数据”会先确认，并在当前相册文件夹中导出为 ZIP，成功提示会显示文件名和保存位置。', '“导入数据”会校验并合并 ZIP，不覆盖已有方案；重复或无效内容会跳过。删除搭配方案是永久删除，不会进入最近删除。'] }
    ],
    guideDontShowAgain: '不再提示',
    guideConfirm: '知道了',
    guideClose: '关闭搭配码指南',
    guideOpen: '查看搭配码使用指南',
    count: (count) => `${count} 个方案`
  },
  en: {
    viewName: 'Outfit Codes',
    eyebrow: 'OUTFITS',
    tagsTitle: 'Tags',
    all: 'All',
    pending: 'Pending',
    uncategorized: 'Uncategorized',
    addTag: 'Add tag',
    tagPlaceholder: 'Up to 5 characters',
    confirmAddTag: 'Add',
    reorderTag: 'Reorder tag',
    deleteTag: 'Delete tag',
    importData: 'Import',
    importing: 'Importing',
    exportData: 'Export',
    exporting: 'Creating backup',
    updating: 'Updating outfit codes…',
    upToDate: 'Outfit codes are up to date.',
    scanComplete: (added, failed) => `Outfit code update complete: ${added} added, ${failed} failed.`,
    addOutfit: 'Add outfit',
    editTitle: 'Edit Outfit',
    imageLabel: 'Outfit image',
    imageHint: 'Click, drop, or paste a JPG, PNG, or WebP image',
    replaceImage: 'Replace image',
    codeLabel: 'Outfit code',
    codePlaceholder: 'Optional; you can add it later',
    tagLabel: 'Tag (single choice)',
    noTag: 'No tag',
    cancel: 'Cancel',
    confirm: 'Save',
    saving: 'Saving',
    copy: 'Copy outfit code',
    edit: 'Edit outfit',
    delete: 'Delete outfit',
    emptyTitle: 'No outfit plans yet',
    emptyDescription: 'Add a plan, or place images in the album clothe folder.',
    imageRequired: 'Choose an outfit image first.',
    unsupportedImage: 'Choose a JPG, JPEG, PNG, or WebP image.',
    imageLoadFailed: 'Unable to read outfit image',
    operations: {
      albumOpenedWithFailures: (failed) => `Album opened; ${failed} outfit item(s) could not be read or imported.`,
      saveSucceeded: (wasEditing) => wasEditing ? 'Outfit saved.' : 'Outfit added.',
      invalidTag: (maxLength) => `A tag must contain 1 to ${maxLength} characters.`,
      duplicateOrReservedTag: 'That name is already used or reserved.',
      tagLimitReached: (maxTags) => `You can create up to ${maxTags} user tags.`,
      tagAdded: 'Tag added.',
      deleteTagTitle: 'Delete tag',
      deleteTagMessage: (tag, usedCount) => `“${tag}” is used by ${usedCount} outfit(s). They will become uncategorized; no outfits or images will be deleted.`,
      tagDeleted: 'Tag deleted.',
      copySucceeded: 'Outfit code copied.',
      copyFailed: (code) => `Copy failed. Copy manually: ${code}`,
      deleteOutfitTitle: 'Delete outfit',
      deleteSelectedTitle: 'Permanently delete outfits',
      confirmPermanentDelete: 'Permanently delete this outfit code? This cannot be undone.',
      permanentlyDelete: 'Delete permanently',
      outfitDeleted: 'Outfit deleted.',
      deleteIncomplete: 'The outfit could not be fully removed. Check the clothe folder for leftover files.',
      deletingSelected: 'Permanently deleting outfits…',
      deletedSelected: (deletedCount, failedCount) => `Permanently deleted ${deletedCount} outfit(s)${failedCount ? `; ${failedCount} failed.` : '.'}`,
      exportTitle: 'Export outfit code data',
      exportConfirm: (directoryName) => `The exported ZIP will be saved automatically in the current album folder “${directoryName}”. Continue?`,
      exportAction: 'Export',
      exportSucceeded: (fileName, count) => `Exported ${count} outfit(s) to ${fileName} in the current album folder.`,
      rejectedTags: (count) => ` ${count} tag(s) were rejected by the limits.`,
      importCompleted: (added, duplicates, failed, tagNote) => `Import complete: ${added} added, ${duplicates} duplicate(s) skipped, ${failed} failed.${tagNote}`
    },
    guideTitle: 'Outfit Code Guide',
    guideIntro: 'Outfit images, codes, and tags stay in the current album on your device and are not uploaded to the website server.',
    guideFeaturedSection: {
      title: 'Auto update in-game codes',
      items: [
        'Using auto update for outfit codes requires authorizing the current game X6Game folder.',
        'In the game, tap Share, then tap the selection button at the lower-right of the outfit screenshot. After the selection generates an outfit code, return to the web page and the app will automatically update that outfit code data.'
      ]
    },
    guideSections: [
      { title: 'Add and edit', items: ['Click Add outfit to select, drag and drop, or paste an image (click an empty area in the dialog and press Ctrl+V).', 'The outfit code can be left blank and filled in later. Each plan can use at most one tag, and double-clicking the image opens the preview.'] },
      { title: 'Tags and filters', items: ['Filter by All, Pending, Uncategorized, or user tags. You can create up to 40 tags with no more than 5 characters each.', 'Deleting a tag in use only moves matching plans to Uncategorized; it does not delete their images or plans.'] },
      { title: 'Bulk import outfit images', items: ['The app creates a clothe folder in the current album to manage outfit codes. To import images in bulk, place your saved outfit images directly in this folder.', 'Opening or refreshing the album, or refocusing the page, converts those images into pending plans for later code and tag editing.'] },
      { title: 'Import and export', items: ['Export asks for confirmation, then exports a ZIP in the current album folder. The success notice shows the file name and saved location.', 'Import validates and merges a ZIP without replacing existing plans; duplicate or invalid content is skipped. Deleting an outfit is permanent and does not use Recently deleted.'] }
    ],
    guideDontShowAgain: "Don't show again",
    guideConfirm: 'Got it',
    guideClose: 'Close outfit code guide',
    guideOpen: 'Open outfit code guide',
    count: (count) => `${count} outfit${count === 1 ? '' : 's'}`
  }
}

export function getOutfitMessages(language: Language): OutfitMessages {
  return outfitMessages[language]
}
