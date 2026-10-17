import { describe, expect, it } from 'vitest'
import { characterIds, characters } from '../src/config/characters'
import {
  CHARACTER_COLORS,
  STAT_SEGMENTS,
  characterInitial,
  statRows,
  statSegments,
} from '../src/ui/characterSelectModel'

describe('statSegments', () => {
  it('fills as many segments as the value', () => {
    expect(statSegments(3)).toEqual([true, true, true, false, false])
    expect(statSegments(5)).toEqual([true, true, true, true, true])
    expect(statSegments(1)).toHaveLength(STAT_SEGMENTS)
  })

  it('clamps out-of-range values', () => {
    expect(statSegments(0).some(Boolean)).toBe(false)
    expect(statSegments(-2).some(Boolean)).toBe(false)
    expect(statSegments(9).every(Boolean)).toBe(true)
  })
})

describe('statRows', () => {
  it('lists the four stats in order with the character values', () => {
    const rows = statRows('oso')
    expect(rows.map((row) => row.label)).toEqual(['Velocidad', 'Aceleración', 'Manejo', 'Peso'])
    expect(rows.map((row) => row.value)).toEqual([4, 2, 2, 5])
    expect(rows[3]?.segments.filter(Boolean)).toHaveLength(5)
  })
})

describe('character display data', () => {
  it('has a color and an initial for every character', () => {
    for (const id of characterIds) {
      expect(CHARACTER_COLORS[id]).toMatch(/^#[0-9a-f]{6}$/)
      expect(characterInitial(id)).toBe(characters[id].name.charAt(0))
    }
  })
})
