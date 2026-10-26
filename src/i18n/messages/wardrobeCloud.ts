import { resonanceCloudMessages } from './resonanceCloud'

export const wardrobeCloudMessages = {
  zh: {
    ...resonanceCloudMessages.zh,
    delete: '删除云端衣橱',
    count: '件',
    local: '本地存档已拥有记录',
    remote: '云端存档已拥有记录',
    uploadWarning: '本地完整衣橱将覆盖云端衣橱，不受当前筛选影响。云端独有的记录会被移除。',
    downloadWarning: '云端完整衣橱将覆盖本地衣橱，并恢复存档区服。建议先导出本地备份。',
    deleteWarning: '确认后删除当前账号的云端衣橱存档。账号、登录状态、本地衣橱和共鸣存档保留。',
    ready: '请核对账号、数量和区服后确认。暂未收录的记录会一并保留。',
    noSave: '暂无存档',
    unknown: '未知套装',
    cn: '国服',
    global: '国际服',
    updated: '云端更新时间',
    traceId: '错误追踪编号',
    regionChange: '下载后，衣橱展示区服将切换为',
    uploadRegionChange: '上传后，云端衣橱区服将切换为',
    emptyWarning: '此存档已拥有 0 件；确认后将按这份存档完整覆盖目标。',
    errors: {
      ...resonanceCloudMessages.zh.errors,
      EMPTY_LOCAL: '本地衣橱尚未导入或已经清空，没有可上传的存档。',
      EMPTY_CLOUD: '云端暂无衣橱存档，本地衣橱未改变。',
      TOO_LARGE: '衣橱超出同步容量（8 MiB、最多 50000 条服装记录和 10000 个未知套装）。',
      UNSUPPORTED_SCHEMA: '衣橱存档版本暂不受支持，请更新页面后重试。',
      NOT_CONFIGURED: '云同步服务尚未配置，请检查 Pages 绑定和衣橱数据库迁移。'
    }
  },
  en: {
    ...resonanceCloudMessages.en,
    delete: 'Delete cloud wardrobe',
    count: 'pieces',
    local: 'Local saved ownership',
    remote: 'Cloud saved ownership',
    uploadWarning:
      'The complete local wardrobe will replace the cloud wardrobe, regardless of filters. Cloud-only records will be removed.',
    downloadWarning:
      'The complete cloud wardrobe will replace your local wardrobe and restore its region. Export a local backup first if needed.',
    deleteWarning:
      'Delete this account’s cloud wardrobe. Your account, session, local wardrobe and resonance save will remain.',
    ready: 'Check the account, counts and regions. Uncatalogued records will also be preserved.',
    noSave: 'No save',
    unknown: 'Unknown outfits',
    cn: 'CN',
    global: 'Global',
    updated: 'Cloud updated',
    traceId: 'Error reference',
    regionChange: 'After download, the wardrobe region will change to',
    uploadRegionChange: 'After upload, the cloud wardrobe region will change to',
    emptyWarning:
      'This valid save owns 0 pieces. Confirming will fully replace the destination with this save.',
    errors: {
      ...resonanceCloudMessages.en.errors,
      EMPTY_LOCAL:
        'The local wardrobe has not been imported or has been cleared. There is no save to upload.',
      EMPTY_CLOUD: 'No cloud wardrobe exists. Your local wardrobe is unchanged.',
      TOO_LARGE:
        'Wardrobe exceeds the sync limits: 8 MiB, 50,000 item records and 10,000 unknown outfits.',
      UNSUPPORTED_SCHEMA: 'This wardrobe version is not supported. Update the page and try again.',
      NOT_CONFIGURED:
        'Cloud sync is not configured. Check the Pages binding and wardrobe database migration.'
    }
  }
}
