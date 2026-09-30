import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { importHomeSchemeBackup } from '../../src/utils/homeBuild/homeSchemeBackup'

function archiveFile(entries: Record<string, Uint8Array>): File {
  const bytes = zipSync(entries)
  let consumed = false
  const file = new Blob([bytes]) as File
  Object.defineProperties(file, {
    name: { value: 'backup.zip' },
    stream: { value: () => ({ getReader: () => ({
      read: async () => {
        if (consumed) return { done: true, value: undefined }
        consumed = true
        return { done: false, value: bytes }
      },
      cancel: async () => { consumed = true },
      releaseLock: () => undefined
    }) }) }
  })
  return file
}

describe('home scheme ZIP backup validation', () => {
  it('rejects path traversal entries before accessing the album', async () => {
    const file = archiveFile({ '../manifest.json': strToU8('{}') })
    const album = {} as FileSystemDirectoryHandle

    await expect(importHomeSchemeBackup(album, file)).rejects.toThrow('home_scheme_backup_path_invalid')
  })

  it('does not accept an outfit backup manifest as a home scheme archive', async () => {
    const manifest = { format: 'infinity-nikki-outfit-backup', version: 1, tags: [], homeSchemes: [] }
    const file = archiveFile({ 'manifest.json': strToU8(JSON.stringify(manifest)) })
    const album = {} as FileSystemDirectoryHandle

    await expect(importHomeSchemeBackup(album, file)).rejects.toThrow('home_scheme_backup_format_unsupported')
  })
})
