import { describe, expect, it } from 'vitest'
import { listGamePlayPhotoAccounts, resolveX6GameAccountDirectory } from '../../src/utils/file-system/directoryAccess'
import { messages } from '../../src/i18n'
const msg = messages.zh.fileSystem
const dir = (name:string, path?:string[]) => ({ name, kind:'directory', resolve: async()=>path ?? null, queryPermission: async()=> 'granted', entries: async function*(){ } }) as any
describe('directoryAccess', () => {
  it('resolves a valid account path and rejects invalid roots', async () => { const album=dir('NikkiPhotos_HighQuality'); const game=dir('X6Game',['Saved','GamePlayPhotos','123',album.name]); expect(await resolveX6GameAccountDirectory(game,album,msg)).toBe('123'); await expect(resolveX6GameAccountDirectory(dir('Wrong'),album,msg)).rejects.toThrow(msg.invalidX6GameDirectory) })
  it('lists sorted account directories and ignores files', async () => { const entries=async function*(){yield ['b', {kind:'directory'}]; yield ['a',{kind:'directory'}]; yield ['x',{kind:'file'}]}; const gameplay={kind:'directory',entries}; const root={name:'X6Game',kind:'directory',getDirectoryHandle: async(n:string)=> n==='GamePlayPhotos'? gameplay : {getDirectoryHandle:async()=>gameplay}} as any; expect(await listGamePlayPhotoAccounts(root)).toEqual(['a','b']) })
})
