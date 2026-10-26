import type { WardrobeEntry } from './wardrobeCatalog'
import type { WardrobeSnapshot } from './wardrobeStorage'
import { isWardrobeItemUnknown } from './wardrobeFilters'

export { hasWardrobeSnapshot } from './wardrobeSchema'
export function getOwnershipSummary(entry: WardrobeEntry, snapshot: WardrobeSnapshot) {
  const owned = entry.parts.filter((id) => snapshot.entries[id]?.owned).length
  return {
    owned,
    total: entry.parts.length,
    complete: entry.parts.length > 0 && owned === entry.parts.length,
    unknown: isWardrobeItemUnknown(entry, owned > 0)
  }
}
