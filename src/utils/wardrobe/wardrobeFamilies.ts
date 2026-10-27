import type { WardrobeEntry } from './wardrobeCatalog'

export const wardrobeFamilyKey = (entry: WardrobeEntry) =>
  `${entry.kind}:${entry.familyRootId ?? entry.id}`

/** Preserve the first matching entry's catalog/sort position; never aggregate ownership. */
export function groupWardrobeEntries(entries: WardrobeEntry[]) {
  const groups = new Map<string, WardrobeEntry[]>()
  for (const entry of entries) {
    const key = wardrobeFamilyKey(entry)
    const family = groups.get(key)
    if (family) family.push(entry)
    else groups.set(key, [entry])
  }
  return groups
}
