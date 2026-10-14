import { datePartsFromTimestamp } from '../photoGrouping'
import { formatFileSize } from '../file-system/photoUrl'
import type { OutfitItem, OutfitRecord } from './outfitTypes'

/** File-system handles never enter the global collection display model. */
export function displayOutfit(
  record: OutfitRecord,
  size: number,
  loadImageBlob: () => Promise<Blob>
): OutfitItem {
  return {
    ...record,
    ...datePartsFromTimestamp(Date.parse(record.createdAt))!,
    name: record.image,
    url: null,
    fileSize: size,
    fileSizeText: size ? formatFileSize(size) : '--',
    loadImageBlob
  }
}
