import { describe, expect, it } from 'vitest'
import { createResonanceExport, parseResonanceFile, RESONANCE_FILE_EMPTY } from '../../src/utils/resonance/resonanceFile'

const HAIR = '1020100347'

describe('resonance JSON files', () => {
  it('imports a legacy pull map and skips an unknown pool', () => {
    const result = parseResonanceFile({ 77: [['2026-01-01', HAIR]], 99999: [['2026-01-01', HAIR]] })
    expect(result.records.map((record) => record.id)).toContain('77:10347')
    expect(result.skippedPools).toBe(1)
  })

  it('uses Pearpal only when it has more real pulls than game data', () => {
    const base = { pulls: { 77: [['2026-01-01', HAIR]] }, edits: { 77: [['2026-01-02', HAIR]] },
      pearpal: { 77: [{ result: HAIR, pool_cnt: 2, rarity: '5', times_from_last_five_stars: 15 }] } }
    const pearpal = parseResonanceFile(base).records.find((record) => record.id === '77:10347')!
    expect(pearpal.sets[0].parts.find((part) => part.id === HAIR)?.pullNumber).toBe(16)
    expect(pearpal.sets[0].parts.find((part) => part.id === HAIR)?.manual).toBeUndefined()

    const game = parseResonanceFile({ ...base, pearpal: { 77: [{ result: HAIR, pool_cnt: 0, rarity: '5' }] } })
      .records.find((record) => record.id === '77:10347')!
    expect(game.sets[0].parts.find((part) => part.id === HAIR)?.manual).toBe(true)
    expect(game.sets[1].parts.find((part) => part.id === HAIR)?.pullNumber).toBe(1)
  })

  it('round trips manual records through a versioned backup', () => {
    const records = parseResonanceFile({ pulls: {}, edits: { 77: [['2026-01-01', HAIR]] } }).records
    expect(parseResonanceFile(createResonanceExport(records)).records).toEqual(records)
  })

  it('rejects a file with no usable records', () => {
    expect(() => parseResonanceFile({ 99999: [['2026-01-01', HAIR]] })).toThrow( RESONANCE_FILE_EMPTY)
    expect(() => parseResonanceFile({ pulls: { 77: 'invalid' } })).toThrow( RESONANCE_FILE_EMPTY)
  })
})
