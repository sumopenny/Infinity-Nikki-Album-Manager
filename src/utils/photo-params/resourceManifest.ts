import catalogJson from '../../data/nuan5ResourceCatalog.json'

type ResourceKind = 'light' | 'filter' | 'pose' | 'momo'
type ImageKind = ResourceKind

interface ResourceEntry {
  key: string
  aliases: string[]
  zh: string
  en: string
  image?: string
}

interface ImageTemplate {
  baseUrl: string
  replace: string
}

interface ResourceCatalog {
  resources: Record<'light' | 'filter' | 'pose' | 'momo_pose', ResourceEntry[]>
  templates: Record<'light' | 'filter' | 'pose' | 'momo_pose', ImageTemplate | null>
}

const catalog = catalogJson as ResourceCatalog

// 资源目录缺少某个版本时仍保留已有名称，避免更新资源表导致旧照片显示原始 ID。
const legacyZhLights: Record<string, string> = {
  None: '无',
  DirectionLight_L: '方向补光-侧光-左',
  DirectionLight_R: '方向补光-侧光-右',
  DirectionLight_T: '方向补光-顶光',
  DirectionLight_B: '方向补光-底光',
  HueEdgeLight_001_L: '色相边光-柔黄-左',
  HueEdgeLight_001_R: '色相边光-柔黄-右',
  HueEdgeLight_002_L: '色相边光-月蓝-左',
  HueEdgeLight_002_R: '色相边光-月蓝-右',
  HueEdgeLight_003_L: '色相边光-明紫-左',
  HueEdgeLight_003_R: '色相边光-明紫-右',
  HueEdgeLight_004_L: '色相边光-轻粉-左',
  HueEdgeLight_004_R: '色相边光-轻粉-右',
  VibeLight_001: '氛围灯光-轻白边光',
  VibeLight_002: '氛围灯光-梦幻虹光',
  VibeLight_003: '氛围灯光-绚丽极光',
  VibeLight_004: '氛围灯光-柔纱波光',
  BlueTearsLight: '氛围灯光-幽蓝一梦',
  VibeLight_006: '氛围灯光-桃雾'
}

const legacyZhFilters: Record<string, string> = {
  None: '无',
  Fresh_001: '清新-薄雾',
  Fresh_002: '清新-粉樱',
  Fresh_003: '清新-奶油',
  Fresh_004: '清新-暖阳',
  Fresh_005: '清新-晴日',
  Vibe_008: '清新-银雾',
  Weather_001: '氛围-暮色',
  Weather_002: '氛围-月白',
  Weather_003: '氛围-夜雨',
  Weather_004: '氛围-融雪',
  Weather_005: '氛围-深蓝冰雪',
  Vibe_009: '氛围-夜河',
  Vibe_011: '氛围-流光盛景',
  Vibe_012: '氛围-焦糖',
  Vibe_001: '风格-复古胶片',
  Vibe_002: '风格-悠然海岸',
  Vibe_003: '风格-夏日午后',
  Vibe_004: '风格-曼妙珠光',
  Vibe_005: '风格-红蓝交响',
  Vibe_007: '风格-麦乡'
}

function createIndex(entries: ResourceEntry[]): Map<string, ResourceEntry> {
  const index = new Map<string, ResourceEntry>()
  for (const entry of entries) {
    index.set(entry.key, entry)
    for (const alias of entry.aliases) {
      if (!index.has(alias)) index.set(alias, entry)
    }
  }
  return index
}

const indexes: Record<ResourceKind, Map<string, ResourceEntry>> = {
  light: createIndex(catalog.resources.light),
  filter: createIndex(catalog.resources.filter),
  pose: createIndex(catalog.resources.pose),
  momo: createIndex(catalog.resources.momo_pose)
}

function isEmptyResource(id: string): boolean {
  return id.length === 0 || id === 'None' || id === '0' || id === 'null'
}

function findEntry(kind: ResourceKind, id: string | number): ResourceEntry | undefined {
  const key = String(id)
  if (isEmptyResource(key)) return undefined
  return indexes[kind].get(key)
}

/** 返回数据库语言表中的名称；数据库尚未覆盖的历史 ID 使用旧映射或原始 ID。 */
export function resourceName(kind: ResourceKind, id: string | number, language: 'zh' | 'en'): string {
  const key = String(id)
  if (language === 'zh' && isEmptyResource(key)) return '无'
  if (language === 'en' && isEmptyResource(key)) return 'None'
  const entry = findEntry(kind, id)
  const translated = entry?.[language]
  if (translated) return translated
  if (language === 'zh' && kind === 'light') return legacyZhLights[key] ?? key
  if (language === 'zh' && kind === 'filter') return legacyZhFilters[key] ?? key
  return key
}

/** 灯光、滤镜和大喵使用数据库内部 ID；普通动作使用图库目录提供的图片文件名。 */
export function resourceImage(kind: ImageKind, id: string | number): string | undefined {
  const entry = findEntry(kind, id)
  const template = catalog.templates[kind === 'momo' ? 'momo_pose' : kind]
  if (!entry || !template || !template.replace) return undefined
  const imageValue = kind === 'pose' ? entry.image : entry.key
  if (!imageValue) return undefined
  return template.baseUrl.replaceAll(template.replace, encodeURIComponent(imageValue))
}
