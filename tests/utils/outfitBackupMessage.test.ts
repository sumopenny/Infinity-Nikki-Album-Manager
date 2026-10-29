import { expect, it } from 'vitest'
import { outfitBackupMessage } from '../../src/utils/outfit/outfitBackupMessage'

it('maps outfit archive failures to understandable Chinese messages', () => {
  expect(outfitBackupMessage(new Error('Unsupported backup format'), 'zh')).toContain('不是受支持的搭配码备份')
  expect(outfitBackupMessage(new Error('Backup contains an unsafe path'), 'zh')).toContain('结构不完整')
  expect(outfitBackupMessage(new Error('Backup is missing an outfit image'), 'zh')).toContain('图片缺失')
  expect(outfitBackupMessage(new Error('Backup image is too large'), 'zh')).toContain('过大')
})
