import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  normalizePhotoNote,
  readAlbumMetadata,
  savePhotoNote
} from '../../src/utils/file-system/photoMetadata'

class FileHandle {
  constructor(
    public name: string,
    public contents = ''
  ) {}
  async getFile() {
    const f = new File([this.contents], this.name)
    Object.defineProperty(f, 'text', { value: async () => this.contents })
    return f
  }
  async createWritable() {
    return {
      write: async (v: string) => {
        this.contents = v
      },
      close: async () => undefined,
      abort: async () => undefined
    } as unknown as FileSystemWritableFileStream
  }
}
class Dir {
  files = new Map<string, FileHandle>()
  async getFileHandle(name: string, o?: { create?: boolean }) {
    let f = this.files.get(name)
    if (!f && o?.create) {
      f = new FileHandle(name)
      this.files.set(name, f)
    }
    if (!f) throw new DOMException('missing', 'NotFoundError')
    return f as unknown as FileSystemFileHandle
  }
}
const asDir = (d: Dir) => d as unknown as FileSystemDirectoryHandle

describe('photoMetadata', () => {
  it('normalizes notes and truncates to fifteen characters', () => {
    expect(normalizePhotoNote(`  ${'a'.repeat(20)}  `)).toBe('a'.repeat(15))
    expect(normalizePhotoNote(3)).toBe('')
  })
  it('reads legacy valid notes without requiring a version field', async () => {
    const d = new Dir()
    d.files.set(
      'album-metadata.json',
      new FileHandle(
        'album-metadata.json',
        JSON.stringify({ photos: { a: { note: ' ok ' }, b: { note: '' } } })
      )
    )
    expect(await readAlbumMetadata(asDir(d))).toEqual({ version: 1, photos: { a: { note: 'ok' } } })
  })
  it('saves and removes a note', async () => {
    const d = new Dir()
    await savePhotoNote(asDir(d), 'a.jpg', ' note ')
    expect((await readAlbumMetadata(asDir(d))).photos['a.jpg'].note).toBe('note')
    await savePhotoNote(asDir(d), 'a.jpg', '   ')
    expect((await readAlbumMetadata(asDir(d))).photos).toEqual({})
  })
})

// 按锁名协调不同模块实例，模拟浏览器跨窗口锁，而非页面内共享队列。
beforeEach(() => {
  const tails = new Map<string, Promise<unknown>>()
  vi.stubGlobal('navigator', {
    locks: {
      request: vi.fn((name: string, action: () => Promise<unknown>) => {
        const next = (tails.get(name) ?? Promise.resolve()).then(action)
        tails.set(
          name,
          next.catch(() => undefined)
        )
        return next
      })
    }
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('preserves concurrent notes from separate window instances and distinct handles', async () => {
  vi.resetModules()
  const otherWindow = await import('../../src/utils/file-system/photoMetadata')
  const directory = new Dir()
  const alias = {
    getFileHandle: directory.getFileHandle.bind(directory)
  } as FileSystemDirectoryHandle
  await Promise.all([
    savePhotoNote(asDir(directory), 'a', 'first'),
    otherWindow.savePhotoNote(alias, 'b', 'second')
  ])
  expect((await readAlbumMetadata(asDir(directory))).photos).toEqual({
    a: { note: 'first' },
    b: { note: 'second' }
  })
  expect(new Set(vi.mocked(navigator.locks.request).mock.calls.map((call) => call[0])).size).toBe(1)
})
it.each([
  '{broken',
  'null',
  '[]',
  '{}',
  '{"photos":[]}',
  '{"version":2,"photos":{}}',
  '{"photos":{"a":null}}',
  '{"photos":{"a":{"note":42}}}'
])('preserves invalid metadata without opening a writer: %s', async (contents) => {
  const directory = new Dir(),
    file = new FileHandle('album-metadata.json', contents)
  directory.files.set(file.name, file)
  const writer = vi.spyOn(file, 'createWritable')
  await expect(savePhotoNote(asDir(directory), 'new', 'text')).rejects.toMatchObject({
    code: 'invalid'
  })
  expect(file.contents).toBe(contents)
  expect(writer).not.toHaveBeenCalled()
})
it('propagates read errors and preserves unrelated raw note content', async () => {
  const directory = new Dir(),
    file = new FileHandle(
      'album-metadata.json',
      JSON.stringify({ photos: { other: { note: '  original longer than fifteen  ' } } })
    )
  directory.files.set(file.name, file)
  vi.spyOn(file, 'getFile').mockRejectedValueOnce(new Error('read failed'))
  await expect(savePhotoNote(asDir(directory), 'new', 'text')).rejects.toThrow('read failed')
  await savePhotoNote(asDir(directory), 'new', 'text')
  expect(JSON.parse(file.contents).photos.other.note).toBe('  original longer than fifteen  ')
})
it('rejects a stale editor and accepts a refreshed editing baseline', async () => {
  const directory = asDir(new Dir())
  await savePhotoNote(directory, 'a', 'newer', '')
  await expect(savePhotoNote(directory, 'a', 'stale', '')).rejects.toMatchObject({
    code: 'changed'
  })
  expect((await readAlbumMetadata(directory)).photos.a.note).toBe('newer')
  await savePhotoNote(directory, 'a', 'refreshed', 'newer')
  expect((await readAlbumMetadata(directory)).photos.a.note).toBe('refreshed')
})
it('releases the lock after write failure and verifies actual saved content', async () => {
  const directory = new Dir(),
    file = new FileHandle('album-metadata.json', '{"photos":{}}')
  directory.files.set(file.name, file)
  vi.spyOn(file, 'createWritable').mockRejectedValueOnce(new Error('write denied'))
  await expect(savePhotoNote(asDir(directory), 'a', 'one')).rejects.toThrow('write denied')
  await savePhotoNote(asDir(directory), 'b', 'two')
  expect((await readAlbumMetadata(asDir(directory))).photos).toEqual({ b: { note: 'two' } })
  vi.spyOn(file, 'createWritable').mockResolvedValueOnce({
    write: async () => {},
    close: async () => {},
    abort: async () => {}
  } as unknown as FileSystemWritableFileStream)
  await expect(savePhotoNote(asDir(directory), 'c', 'three')).rejects.toMatchObject({
    code: 'verificationFailed'
  })
})
it('does not write without cross-window lock support', async () => {
  vi.stubGlobal('navigator', {})
  const directory = new Dir()
  await expect(savePhotoNote(asDir(directory), 'a', 'note')).rejects.toMatchObject({
    code: 'lockUnavailable'
  })
  expect(directory.files.size).toBe(0)
})
