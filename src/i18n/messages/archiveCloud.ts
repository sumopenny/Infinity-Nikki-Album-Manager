import { cloudMessages } from './cloud'

export const archiveCloudMessages = {
  zh: {
    ...cloudMessages.zh,

    upload: '上传云端',
    download: '从云端同步',
    delete: '删除云端存档',
    count: '件',
    noSave: '暂无存档',
    unknown: '未知套装',
    cn: '国服',
    global: '国际服',
    updated: '云端更新时间',
    source: '来源',
    replaceTarget: '将被替换',
    createTarget: '将新建存档',
    deleteTarget: '将被删除',
    uploadDescription: '将所选模块的完整本机存档上传到当前账号，覆盖对应云端存档。',
    downloadDescription: '用云端完整存档替换所选模块的本机记录，不会合并两份数据。',
    deleteDescription: '选择要删除的云端存档。仅删除所选模块，本机记录和账号均保留。',
    uploadRisk: '所选模块的云端独有记录将被移除，上传不受页面筛选影响。',
    downloadRisk: '所选模块的本机独有记录将被移除，建议先导出本机备份。',
    uncatalogued: '暂未收录的套装记录会随存档一并保留。',
    preparing: '正在读取共鸣与衣橱存档…',
    uploading: '正在上传所选档案…',
    downloading: '正在下载并保存所选档案…',
    deleting: '正在删除所选云端存档…',
    exportBackup: '导出本机备份',
    backupHint: '备份所选模块当前的本机记录；两项一起导出为 ZIP，解压后可分别导入。',
    backupWorking: '正在生成本机备份…',
    backupReady: '本机备份已生成，请确认文件已保存后再继续。',
    backupFailed: '备份未能生成，请重试或取消后从页面导出。',
    emptyUpload: '衣橱本机存档已拥有 0 件，上传后云端已拥有记录将变为 0 件。',
    emptyDownload: '衣橱云端存档已拥有 0 件，下载后本机已拥有记录将变为 0 件。',
    uploadSuccess: '已上传所选档案',
    downloadSuccess: '已从云端恢复所选档案',
    deleteSuccess: '已删除所选云端存档',
    traceId: '错误追踪编号',
    regionChange: '下载后，衣橱展示区服将切换为',
    uploadRegionChange: '上传后，云端衣橱区服将切换为',
    resonance: '共鸣记录',
    wardrobe: '个人衣橱',
    localColumn: '本机存档',
    cloudColumn: '云端存档',
    selectHint: '默认选择可用模块，也可取消某一项。',
    deleteHint: '请明确勾选要删除的模块。',
    selected: '已选择',
    moduleUnit: '个模块',
    emptyLocal: '暂无可上传的本机存档',
    emptyCloud: '云端暂无存档',
    unavailable: '此模块暂不可操作',
    noSelection: '请选择至少一个可用模块后确认。',
    sharedCommit: '所选模块共同提交；任一模块冲突或失败时均不覆盖目标。',
    records: '条',
    preserved: '未选中的模块、本机记录、账号及登录状态均保留。',
    errors: {
      ...cloudMessages.zh.errors,

      CONFLICT: '云端存档已发生变化，本次未覆盖目标。请重新读取预览并确认。',
      LOCAL_CHANGED: '本机存档已发生变化，本次未覆盖目标。请重新读取预览并确认。',
      LOCAL_READ_FAILED: '无法读取本地记录，请检查浏览器存储权限后重试。',
      LOCAL_SAVE_FAILED: '本机保存失败，两个模块的原记录均已保留。请检查存储空间或权限。',
      EMPTY_LOCAL: '所选模块没有可上传的存档，请重新读取预览。',
      EMPTY_CLOUD: '所选云端存档已不存在，未覆盖本机记录。',
      TOO_LARGE:
        '所选存档超出同步容量限制：每个模块最多 8 MiB；共鸣最多 2000 条，衣橱最多 50000 条服装记录和 10000 个未知套装。',
      INVALID_DATA: '存档格式不完整或不受支持，未覆盖目标存档。',
      NOT_CONFIGURED: '云同步服务尚未配置，请检查档案数据库绑定及迁移。',
      UNSUPPORTED_SCHEMA: '衣橱存档版本暂不受支持，请更新页面后重试。'
    }
  },
  en: {
    ...cloudMessages.en,

    upload: 'Upload to cloud',
    download: 'Sync from cloud',
    delete: 'Delete cloud save',
    count: 'pieces',
    noSave: 'No save',
    unknown: 'Unknown outfits',
    cn: 'CN',
    global: 'Global',
    updated: 'Cloud updated',
    source: 'Source',
    replaceTarget: 'Will be replaced',
    createTarget: 'New save',
    deleteTarget: 'Will be deleted',
    uploadDescription:
      'Upload the complete selected local saves to this account, replacing the corresponding cloud saves.',
    downloadDescription:
      'Replace the selected local modules with their complete cloud saves. Records are not merged.',
    deleteDescription:
      'Select the cloud saves to delete. Your local records and account will remain.',
    uploadRisk:
      'Cloud-only records in the selected modules will be removed, regardless of page filters.',
    downloadRisk:
      'Local-only records in the selected modules will be removed. Export a local backup first.',
    uncatalogued: 'Uncatalogued outfit records are also preserved in the save.',
    preparing: 'Reading resonance and wardrobe saves…',
    uploading: 'Uploading selected saves…',
    downloading: 'Downloading and saving selected modules…',
    deleting: 'Deleting selected cloud saves…',
    exportBackup: 'Export local backup',
    backupHint:
      'Back up current local records for the selected modules. A combined ZIP contains JSON files you can import separately.',
    backupWorking: 'Preparing local backup…',
    backupReady: 'Local backup generated. Check that the file has been saved before continuing.',
    backupFailed: 'Could not generate the backup. Retry, or cancel and export from the page.',
    emptyUpload:
      'The local wardrobe owns 0 pieces. Uploading will set cloud ownership to 0 pieces.',
    emptyDownload:
      'The cloud wardrobe owns 0 pieces. Downloading will set local ownership to 0 pieces.',
    uploadSuccess: 'Selected saves uploaded',
    downloadSuccess: 'Selected modules restored from cloud',
    deleteSuccess: 'Selected cloud saves deleted',
    traceId: 'Error reference',
    regionChange: 'After download, the wardrobe region will change to',
    uploadRegionChange: 'After upload, the cloud wardrobe region will change to',
    resonance: 'Resonance',
    wardrobe: 'Wardrobe',
    localColumn: 'Local save',
    cloudColumn: 'Cloud save',
    selectHint: 'Available modules are selected by default. You can deselect either one.',
    deleteHint: 'Select the modules you want to delete.',
    selected: 'Selected',
    moduleUnit: 'modules',
    emptyLocal: 'No local save to upload',
    emptyCloud: 'No cloud save',
    unavailable: 'This module is unavailable',
    noSelection: 'Select at least one available module to continue.',
    sharedCommit:
      'Selected modules commit together. A conflict or failure leaves both destinations unchanged.',
    records: 'records',
    preserved: 'Unselected modules, local records, your account and login will remain.',
    errors: {
      ...cloudMessages.en.errors,

      CONFLICT:
        'Cloud saves changed. No destinations were replaced. Refresh the preview and confirm again.',
      LOCAL_CHANGED:
        'Local saves changed. No destinations were replaced. Refresh the preview and confirm again.',
      LOCAL_READ_FAILED:
        'Could not read local records. Check browser storage permissions and retry.',
      LOCAL_SAVE_FAILED:
        'Local save failed. Both modules kept their previous records. Check storage space or permissions.',
      EMPTY_LOCAL: 'A selected module has no local save to upload. Refresh the preview.',
      EMPTY_CLOUD: 'A selected cloud save no longer exists. Local records were not replaced.',
      TOO_LARGE:
        'Sync limits: 8 MiB per module; 2000 resonance records; 50,000 wardrobe item records and 10,000 unknown outfits.',
      INVALID_DATA: 'Invalid or unsupported save data. The destination was not replaced.',
      NOT_CONFIGURED:
        'Cloud sync is not configured. Check the archive database binding and migrations.',
      UNSUPPORTED_SCHEMA: 'This wardrobe version is not supported. Update the page and try again.'
    }
  }
}
