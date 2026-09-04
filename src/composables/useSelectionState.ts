// 选择状态管理：处理照片、搭配和回收站项目的选择、全选及收藏联动。
import { computed, type Ref } from 'vue'
import type { PhotoItem, RecentlyDeletedPhoto } from '../utils/photoGrouping'
import type { OutfitItem } from '../utils/outfit/outfitTypes'

export function useSelectionState(options: {
  recentlyDeleted: Ref<RecentlyDeletedPhoto[]>
  visiblePhotos: Ref<PhotoItem[]>
  visibleOutfits: Ref<OutfitItem[]>
  dateGroups: Ref<Array<{ dateKey: string; photos: PhotoItem[] }>>
  favoriteIds: Ref<Set<string>>
  selectedIds: Ref<Set<string>>
  selectedOutfitIds: Ref<Set<string>>
  trashSelectedIds: Ref<Set<string>>
  activeView: Ref<'all' | 'favorites' | 'trash' | 'outfits'>
}) {
  const { visiblePhotos, visibleOutfits, dateGroups, favoriteIds, selectedIds, selectedOutfitIds, trashSelectedIds, recentlyDeleted, activeView } = options
  const scopedSelectedPhotos = computed(() => visiblePhotos.value.filter((photo) => selectedIds.value.has(photo.id)))
  const selectedCount = computed(() => scopedSelectedPhotos.value.length)
  const selectedOutfitCount = computed(() => visibleOutfits.value.filter((outfit) => selectedOutfitIds.value.has(outfit.id)).length)
  const trashSelectedCount = computed(() => recentlyDeleted.value.filter((photo) => trashSelectedIds.value.has(photo.id)).length)
  const allSelected = computed(() => visiblePhotos.value.length > 0 && visiblePhotos.value.every((photo) => selectedIds.value.has(photo.id)))
  const allOutfitsSelected = computed(() => visibleOutfits.value.length > 0 && visibleOutfits.value.every((outfit) => selectedOutfitIds.value.has(outfit.id)))
  const allTrashSelected = computed(() => recentlyDeleted.value.length > 0 && recentlyDeleted.value.every((photo) => trashSelectedIds.value.has(photo.id)))
  const allSelectedFavorited = computed(() => scopedSelectedPhotos.value.length > 0 && scopedSelectedPhotos.value.every((photo) => favoriteIds.value.has(photo.id)))

  const toggleAll = () => {
    const ids = new Set(visiblePhotos.value.map((photo) => photo.id))
    selectedIds.value = allSelected.value
      ? new Set([...selectedIds.value].filter((id) => !ids.has(id)))
      : new Set([...selectedIds.value, ...ids])
  }

  const toggleAllOutfits = () => {
    const ids = new Set(visibleOutfits.value.map((outfit) => outfit.id))
    selectedOutfitIds.value = allOutfitsSelected.value
      ? new Set([...selectedOutfitIds.value].filter((id) => !ids.has(id)))
      : new Set([...selectedOutfitIds.value, ...ids])
  }

  const toggleOutfit = (id: string) => {
    const next = new Set(selectedOutfitIds.value)
    next.has(id) ? next.delete(id) : next.add(id)
    selectedOutfitIds.value = next
  }

  const togglePhoto = (id: string) => {
    const next = new Set(selectedIds.value)
    next.has(id) ? next.delete(id) : next.add(id)
    selectedIds.value = next
  }

  const toggleTrashPhoto = (id: string) => {
    const next = new Set(trashSelectedIds.value)
    next.has(id) ? next.delete(id) : next.add(id)
    trashSelectedIds.value = next
  }

  const toggleAllTrash = () => {
    trashSelectedIds.value = allTrashSelected.value
      ? new Set()
      : new Set(recentlyDeleted.value.map((photo) => photo.id))
  }

  const toggleFavorite = (id: string) => {
    const next = new Set(favoriteIds.value)
    next.has(id) ? next.delete(id) : next.add(id)
    favoriteIds.value = next
    if (activeView.value === 'favorites' && !next.has(id)) {
      selectedIds.value = new Set([...selectedIds.value].filter((selectedId) => selectedId !== id))
    }
  }

  const favoriteSelectedPhotos = () => {
    favoriteIds.value = new Set([
      ...favoriteIds.value,
      ...scopedSelectedPhotos.value.map((photo) => photo.id)
    ])
  }

  const unfavoriteSelectedPhotos = () => {
    const ids = new Set(scopedSelectedPhotos.value.map((photo) => photo.id))
    favoriteIds.value = new Set([...favoriteIds.value].filter((id) => !ids.has(id)))
    if (activeView.value === 'favorites') {
      selectedIds.value = new Set([...selectedIds.value].filter((id) => !ids.has(id)))
    }
  }

  const clearAlbumSelection = () => {
    selectedIds.value = new Set()
  }

  const clearOutfitSelection = () => {
    selectedOutfitIds.value = new Set()
  }

  const clearTrashSelection = () => {
    trashSelectedIds.value = new Set()
  }

  const toggleDate = (dateKey: string) => {
    const group = dateGroups.value.find((item) => item.dateKey === dateKey)
    if (!group) return

    const next = new Set(selectedIds.value)
    const selected = group.photos.every((photo) => next.has(photo.id))
    for (const photo of group.photos) {
      selected ? next.delete(photo.id) : next.add(photo.id)
    }
    selectedIds.value = next
  }

  return {
    scopedSelectedPhotos,
    selectedCount,
    selectedOutfitCount,
    trashSelectedCount,
    allSelected,
    allOutfitsSelected,
    allTrashSelected,
    allSelectedFavorited,
    toggleAll,
    toggleAllOutfits,
    toggleOutfit,
    togglePhoto,
    toggleTrashPhoto,
    toggleAllTrash,
    toggleFavorite,
    favoriteSelectedPhotos,
    unfavoriteSelectedPhotos,
    clearAlbumSelection,
    clearOutfitSelection,
    clearTrashSelection,
    toggleDate
  }
}
