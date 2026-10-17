import { describe, expect, it } from 'vitest'
import {
  parseRaceSettings,
  shiftMode,
  withMode,
  rubberBandFor,
  shiftDifficulty,
  withDifficulty,
  withRubberBand,
} from '../src/game/raceSettings'

describe('parseRaceSettings', () => {
  it('defaults to normal with the rubber band on', () => {
    expect(parseRaceSettings('')).toEqual({
      mode: 'carrera',
      difficulty: 'normal',
      rubberBandEnabled: true,
    })
  })

  it('reads the difficulty and the rubber band from the URL', () => {
    expect(parseRaceSettings('?dificultad=dificil&remontada=0')).toEqual({
      mode: 'carrera',
      difficulty: 'dificil',
      rubberBandEnabled: false,
    })
    expect(parseRaceSettings('?dificultad=facil').difficulty).toBe('facil')
  })

  it('ignores unknown values and unrelated params', () => {
    expect(parseRaceSettings('?dificultad=imposible&debug&pista=test')).toEqual({
      mode: 'carrera',
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
    expect(normal).toEqual({
      mode: 'carrera',
      difficulty: 'normal',
      rubberBandEnabled: true,
    })
    expect(off).toEqual({ mode: 'carrera', difficulty: 'dificil', rubberBandEnabled: false })
  })

  it('builds the rubber band config from the choice', () => {
    expect(rubberBandFor(normal).enabled).toBe(true)
    expect(rubberBandFor(withRubberBand(normal, false)).enabled).toBe(false)
    expect(rubberBandFor(normal).maxBonus).toBeGreaterThan(0)
  })
})

describe('game mode', () => {
  it('reads ?modo=contrarreloj and ignores unknown modes', () => {
    expect(parseRaceSettings('?modo=contrarreloj&dificultad=facil')).toMatchObject({
      mode: 'contrarreloj',
      difficulty: 'facil',
    })
    expect(parseRaceSettings('?modo=otro').mode).toBe('carrera')
  })

  it('changes and shifts the mode, clamped at both ends', () => {
    const base = parseRaceSettings('')
    const trial = withMode(base, 'contrarreloj')
    expect(trial.mode).toBe('contrarreloj')
    expect(shiftMode(base, 1).mode).toBe('contrarreloj')
    expect(shiftMode(trial, 1).mode).toBe('contrarreloj')
    expect(shiftMode(trial, -1).mode).toBe('carrera')
    expect(shiftMode(base, -1).mode).toBe('carrera')
  })
})
