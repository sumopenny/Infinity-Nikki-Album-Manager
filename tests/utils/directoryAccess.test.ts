import { describe, expect, it } from 'vitest'
import { isProtectedAlbumDirectory, isSameOrNestedDirectory, listGamePlayPhotoAccounts, resolveX6GameAccountDirectory } from '../../src/utils/file-system/directoryAccess'
import { DirectoryAccessError, normalizeDirectoryError } from '../../src/utils/file-system/directoryErrors'
import { messages } from '../../src/i18n'
const msg = messages.zh.fileSystem
const dir = (name:string, path?:string[]) => ({ name, kind:'directory', resolve: async()=>path ?? null, queryPermission: async()=> 'granted', entries: async function*(){ } }) as any
describe('directoryAccess', () => {
  it('resolves a valid account path and rejects invalid roots', async () => { const album=dir('NikkiPhotos_HighQuality'); const game=dir('X6Game',['Saved','GamePlayPhotos','123',album.name]); expect(await resolveX6GameAccountDirectory(game,album,msg)).toBe('123'); await expect(resolveX6GameAccountDirectory(dir('Wrong'),album,msg)).rejects.toThrow(msg.invalidX6GameDirectory) })
  it('lists sorted account directories and ignores files', async () => { const entries=async function*(){yield ['b', {kind:'directory'}]; yield ['a',{kind:'directory'}]; yield ['x',{kind:'file'}]}; const gameplay={kind:'directory',entries}; const root={name:'X6Game',kind:'directory',getDirectoryHandle: async(n:string)=> n==='GamePlayPhotos'? gameplay : {getDirectoryHandle:async()=>gameplay}} as any; expect(await listGamePlayPhotoAccounts(root)).toEqual(['a','b']) })
  it('recognizes the album, nested folders and trash as protected targets', async () => {
    const candidate = dir('candidate')
    const nested = { ...dir('album'), resolve: async (handle: FileSystemHandle) => handle === candidate ? ['nested'] : null, getDirectoryHandle: async () => { throw new DOMException('missing', 'NotFoundError') } } as FileSystemDirectoryHandle
    expect(await isSameOrNestedDirectory(nested, candidate)).toBe(true)
    expect(await isProtectedAlbumDirectory(nested, candidate)).toBe(true)
    expect(await isProtectedAlbumDirectory(nested, dir('other'))).toBe(false)
  })
  it('normalizes picker cancellation to a structured error code', () => {
    const error = normalizeDirectoryError(new DOMException('cancelled', 'AbortError'), msg)
    expect(error).toBeInstanceOf(DirectoryAccessError)
    expect(error.code).toBe('cancelled')
    expect(error.message).toBe(msg.abortSelection)
  })
})
