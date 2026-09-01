import { describe, expect, it } from 'vitest'
import { normalizePhotoNote, readAlbumMetadata, savePhotoNote } from '../../src/utils/file-system/photoMetadata'

class FileHandle { constructor(public name: string, public contents = '') {} async getFile() { const f = new File([this.contents], this.name); Object.defineProperty(f, 'text', { value: async () => this.contents }); return f } async createWritable() { return { write: async (v: string) => { this.contents = v }, close: async () => undefined, abort: async () => undefined } as unknown as FileSystemWritableFileStream } }
class Dir { files = new Map<string, FileHandle>(); async getFileHandle(name: string, o?: {create?: boolean}) { let f = this.files.get(name); if (!f && o?.create) { f = new FileHandle(name); this.files.set(name, f) }; if (!f) throw new DOMException('missing', 'NotFoundError'); return f as unknown as FileSystemFileHandle } }
const asDir = (d: Dir) => d as unknown as FileSystemDirectoryHandle

describe('photoMetadata', () => {
  it('normalizes notes and truncates to fifteen characters', () => { expect(normalizePhotoNote(`  ${'a'.repeat(20)}  `)).toBe('a'.repeat(15)); expect(normalizePhotoNote(3)).toBe('') })
  it('reads valid notes and ignores invalid entries', async () => { const d = new Dir(); d.files.set('album-metadata.json', new FileHandle('album-metadata.json', JSON.stringify({ photos: { a: { note: ' ok ' }, b: { note: '' }, c: null } }))); expect(await readAlbumMetadata(asDir(d))).toEqual({ version: 1, photos: { a: { note: 'ok' } } }) })
  it('saves and removes a note', async () => { const d = new Dir(); await savePhotoNote(asDir(d), 'a.jpg', ' note '); expect((await readAlbumMetadata(asDir(d))).photos['a.jpg'].note).toBe('note'); await savePhotoNote(asDir(d), 'a.jpg', '   '); expect((await readAlbumMetadata(asDir(d))).photos).toEqual({}) })
})
