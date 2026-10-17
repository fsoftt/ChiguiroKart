import { describe, expect, it } from 'vitest'
import {
  parseRaceSettings,
  rubberBandFor,
  shiftDifficulty,
  withDifficulty,
  withRubberBand,
} from '../src/game/raceSettings'

describe('parseRaceSettings', () => {
  it('defaults to normal with the rubber band on', () => {
    expect(parseRaceSettings('')).toEqual({ difficulty: 'normal', rubberBandEnabled: true })
  })

  it('reads the difficulty and the rubber band from the URL', () => {
    expect(parseRaceSettings('?dificultad=dificil&remontada=0')).toEqual({
      difficulty: 'dificil',
      rubberBandEnabled: false,
    })
    expect(parseRaceSettings('?dificultad=facil').difficulty).toBe('facil')
  })

  it('ignores unknown values and unrelated params', () => {
    expect(parseRaceSettings('?dificultad=imposible&debug&pista=test')).toEqual({
      difficulty: 'normal',
      rubberBandEnabled: true,
    })
    expect(parseRaceSettings('?remontada=1').rubberBandEnabled).toBe(true)
  })
})

describe('applying a selection', () => {
  const normal = parseRaceSettings('')

  it('shifts the difficulty and clamps at the ends', () => {
    expect(shiftDifficulty(normal, 1).difficulty).toBe('dificil')
    expect(shiftDifficulty(normal, -1).difficulty).toBe('facil')
    expect(shiftDifficulty(shiftDifficulty(normal, 1), 1).difficulty).toBe('dificil')
    expect(shiftDifficulty(shiftDifficulty(normal, -1), -1).difficulty).toBe('facil')
  })

  it('sets difficulty and rubber band without mutating the input', () => {
    const hard = withDifficulty(normal, 'dificil')
    const off = withRubberBand(hard, false)
    expect(normal).toEqual({ difficulty: 'normal', rubberBandEnabled: true })
    expect(off).toEqual({ difficulty: 'dificil', rubberBandEnabled: false })
  })

  it('builds the rubber band config from the choice', () => {
    expect(rubberBandFor(normal).enabled).toBe(true)
    expect(rubberBandFor(withRubberBand(normal, false)).enabled).toBe(false)
    expect(rubberBandFor(normal).maxBonus).toBeGreaterThan(0)
  })
})
