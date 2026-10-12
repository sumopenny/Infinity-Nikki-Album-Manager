import type { PhotoParamsResult } from './types'

type Resource = PhotoParamsResult['resourceGroups'][number]
const kinds: Record<string, Resource['kind']> = {
  '动作': 'pose', action: 'pose', pose: 'pose',
  '灯光': 'light', light: 'light', lighting: 'light',
  '滤镜': 'filter', filter: 'filter'
}
const missing = new Set(['', '无', 'none', 'null', 'undefined', '--', '—', '0'])

/** 旧解析快照只有标题、名称和图片，也必须保留已有动作；不把大喵动作当成暖暖动作。 */
export function favoriteResources(result: PhotoParamsResult): Resource[] {
  const groups = Array.isArray(result?.resourceGroups) ? result.resourceGroups : []
  return groups.flatMap((group) => {
    if (!group || typeof group.title !== 'string' || typeof group.name !== 'string') return []
    const kind = group.kind ?? kinds[group.title.trim().toLowerCase()]
    if (!kind || !['pose', 'light', 'filter'].includes(kind)) return []
    const hasId = group.id != null && !missing.has(String(group.id).trim().toLowerCase())
    const hasName = !missing.has(group.name.trim().toLowerCase())
    if (!hasId && !hasName && !group.imageUrl) return []
    return [{ ...group, kind }]
  }).sort((a, b) => ['pose', 'light', 'filter'].indexOf(a.kind!) - ['pose', 'light', 'filter'].indexOf(b.kind!))
}
