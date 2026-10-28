import { zipSync, strToU8 } from 'fflate'
import { createWardrobeBackup } from '../wardrobe/wardrobeStorage'
import { createResonanceExport } from '../resonance/resonanceFile'
import { backupBaseName } from '../backup/backupName'
import { downloadBackupBlob } from '../backup/zipBackup'
import { takeDownloadFiles } from '../backup/downloadFallback'
import type { ArchiveLocal, ArchiveModule } from './archiveSchema'

/** 联合备份只包含标准模块 JSON，可解压后从各模块现有导入入口恢复。 */
export function exportArchiveBackup(local: Partial<ArchiveLocal>, selected: ArchiveModule[]) {
  if (selected.some((module) => local[module] === undefined)) throw new Error('LOCAL_READ_FAILED')
  const files: Record<string, Uint8Array> = {}
  if (selected.includes('resonance'))
    files['resonance.json'] = strToU8(
      JSON.stringify(createResonanceExport(local.resonance!), null, 2)
    )
  if (selected.includes('wardrobe'))
    files['wardrobe.json'] = strToU8(createWardrobeBackup(local.wardrobe!))
  if (!Object.keys(files).length) throw new Error('INVALID_DATA')
  try {
    if (selected.length === 1) {
      const bytes = Object.values(files)[0]
      downloadBackupBlob(
        backupBaseName(selected[0] === 'resonance' ? '共鸣记录' : '个人衣橱') + '.json',
        new Blob([bytes], { type: 'application/json' }),
        'archive'
      )
    } else {
      downloadBackupBlob(
        backupBaseName('暖暖档案') + '.zip',
        new Blob([zipSync(files)], { type: 'application/zip' }),
        'archive'
      )
    }
    return takeDownloadFiles('archive')
  } catch (error) {
    takeDownloadFiles('archive')
    throw error
  }
}
