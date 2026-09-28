import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { clearSavedAlbumDirectoryHandle, clearSavedOutfitParseResults, clearSavedX6GameDirectoryHandle, getSavedAlbumDirectoryHandle, getSavedOutfitParseResult, getSavedX6GameDirectoryHandle, saveAlbumDirectoryHandle, saveOutfitParseResult, saveX6GameDirectoryHandle } from '../../src/utils/file-system/directoryStorage'

afterEach(async () => { await clearSavedAlbumDirectoryHandle().catch(() => undefined); await clearSavedX6GameDirectoryHandle().catch(() => undefined); await clearSavedOutfitParseResults().catch(() => undefined) })
const handle = (name: string) => ({ name }) as unknown as FileSystemDirectoryHandle

describe('directoryStorage', () => {
  it('stores album and X6Game handles independently', async () => {
    const album = handle('album'); const game = handle('X6Game')
    await saveAlbumDirectoryHandle(album); await saveX6GameDirectoryHandle(game)
    expect((await getSavedAlbumDirectoryHandle())?.name).toBe('album')
    expect((await getSavedX6GameDirectoryHandle())?.name).toBe('X6Game')
  })
  it('clears only the requested handle', async () => {
    const album = handle('album'); const game = handle('X6Game')
    await saveAlbumDirectoryHandle(album); await saveX6GameDirectoryHandle(game)
    await clearSavedAlbumDirectoryHandle()
    expect(await getSavedAlbumDirectoryHandle()).toBeUndefined(); expect((await getSavedX6GameDirectoryHandle())?.name).toBe('X6Game')
  })

  it('stores and clears outfit-code parse results independently', async () => {
    const result = { code: 'a1B2c3D4e5F#', wearingClothes: [], dyeItems: [] }
    await saveOutfitParseResult(result.code, result)
    expect(await getSavedOutfitParseResult(result.code)).toEqual(result)

    await clearSavedOutfitParseResults()
    expect(await getSavedOutfitParseResult(result.code)).toBeUndefined()
  })
})
