export const MAX_HOME_SCHEME_TAGS = 40
export const MAX_HOME_SCHEME_TAG_LENGTH = 5
export const MAX_HOME_SCHEME_NOTE_LENGTH = 15
export const MAX_HOME_SCHEME_CODE_LENGTH = 30

export type HomeSchemeType = 'home' | 'combo'

export interface HomeSchemeMetadata {
  version: string | null
  furnitureCount: number | null
  server: number | null
  lastModifyTime: number | null
  coverImageUrl: string | null
}

export interface HomeSchemeItem {
  id: string
  image: string | null
  imageUrl: string | null
  code: string
  name: string
  schemeType: HomeSchemeType
  tags: string[]
  note: string
  createdAt: string
  updatedAt: string
  metadata: HomeSchemeMetadata
  fileHandle: FileSystemFileHandle | null
  directoryHandle: FileSystemDirectoryHandle
}

export interface SaveHomeSchemeInput {
  item?: HomeSchemeItem
  id?: string
  createdAt?: string
  updatedAt?: string
  code: string
  name: string
  schemeType: HomeSchemeType
  tags: string[]
  note: string
  metadata: HomeSchemeMetadata
  imageFile?: File | null
  removeImage?: boolean
}

export function normalizeHomeSchemeCode(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s/g, '').trim() : ''
}

export function normalizeHomeSchemeTag(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function isValidHomeSchemeTag(value: string): boolean {
  return [...value].length > 0 && [...value].length <= MAX_HOME_SCHEME_TAG_LENGTH
}
