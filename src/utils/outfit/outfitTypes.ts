// 搭配类型与校验：集中维护搭配数据结构、常量及标签和搭配码规范化规则。
import type { PhotoItem } from '../photoGrouping'

export const DEFAULT_OUTFIT_TAGS = ['甜美', '性感', '帅气', '典雅', '清新', '古典']
export const MAX_OUTFIT_TAGS = 40
export const MAX_OUTFIT_TAG_LENGTH = 5
export const MAX_OUTFIT_CODE_LENGTH = 30
export const MAX_OUTFIT_NOTE_LENGTH = 15

export interface OutfitItem extends PhotoItem { image: string; code: string; tags: string[]; createdAt: string; metadataName: string; note?: string; diyImageModifiedAt?: number }
export interface OutfitLibraryResult { outfits: OutfitItem[]; tags: string[]; importedExternalCount: number; importedSharedCount: number; failedCount: number; sharedFailureStage?: SharedOutfitImportResult['failureStage'] }
export interface SharedOutfitSource { x6GameDirectory: FileSystemDirectoryHandle }
export interface SharedOutfitImportResult { importedCount: number; duplicateCount: number; failedCount: number; failureStage?: 'duplicate' | 'missing-image' | 'image-not-updated' | 'image-write-failed' }
export interface SaveOutfitInput { outfit?: OutfitItem; imageFile?: File; code: string; tag: string | null; note?: string }
export interface OutfitImportResult { addedCount: number; duplicateCount: number; failedCount: number; rejectedTagCount: number; library: OutfitLibraryResult }
export interface OutfitDeleteResult { deleted: OutfitItem[]; failedNames: string[] }

export function normalizeOutfitCode(value: unknown): string { return (typeof value === 'string' ? value : '').replace(/\s/g, '').slice(0, MAX_OUTFIT_CODE_LENGTH) }
export function normalizeOutfitTag(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
export function isValidOutfitTag(value: string): boolean { return value.length > 0 && [...value].length <= MAX_OUTFIT_TAG_LENGTH }
export function isReservedOutfitTag(value: string): boolean { return new Set(['全部', '待填写', '未分类', 'all', 'pending', 'uncategorized']).has(value.toLowerCase()) }
