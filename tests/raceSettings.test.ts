import { describe, expect, it } from 'vitest'
import {
  parseRaceSettings,
  shiftMode,
  withMode,
  rubberBandFor,
  shiftDifficulty,
  withDifficulty,
  withRubberBand,
  shiftCharacter,
  withCharacter,
} from '../src/game/raceSettings'

describe('parseRaceSettings', () => {
  it('defaults to normal with the rubber band on', () => {
    expect(parseRaceSettings('')).toEqual({
      mode: 'carrera',
      difficulty: 'normal',
      rubberBandEnabled: true,
      character: 'chiguiro',
    })
  })

  it('reads the difficulty and the rubber band from the URL', () => {
    expect(parseRaceSettings('?dificultad=dificil&remontada=0')).toEqual({
      mode: 'carrera',
      difficulty: 'dificil',
      rubberBandEnabled: false,
      character: 'chiguiro',
    })
    expect(parseRaceSettings('?dificultad=facil').difficulty).toBe('facil')
  })

  it('ignores unknown values and unrelated params', () => {
    expect(parseRaceSettings('?dificultad=imposible&debug&pista=test')).toEqual({
      mode: 'carrera',
      difficulty: 'normal',
      rubberBandEnabled: true,
      character: 'chiguiro',
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
      character: 'chiguiro',
    })
    expect(off).toEqual({
      mode: 'carrera',
      difficulty: 'dificil',
      rubberBandEnabled: false,
      character: 'chiguiro',
    })
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

describe('character', () => {
  it('reads ?personaje= and ignores unknown ids', () => {
    expect(parseRaceSettings('?personaje=jaguar').character).toBe('jaguar')
    expect(parseRaceSettings('?personaje=dragon').character).toBe('chiguiro')
    expect(parseRaceSettings('').character).toBe('chiguiro')
  })

  it('sets the character without mutating the input', () => {
    const base = parseRaceSettings('')
    expect(withCharacter(base, 'titi').character).toBe('titi')
    expect(base.character).toBe('chiguiro')
  })

  it('shifts the character and wraps around both ends', () => {
    const first = parseRaceSettings('')
    expect(shiftCharacter(first, 1).character).toBe('oso')
    expect(shiftCharacter(first, -1).character).toBe('perezoso')
    expect(shiftCharacter(withCharacter(first, 'perezoso'), 1).character).toBe('chiguiro')
    expect(shiftCharacter(first, 8).character).toBe('chiguiro')
  })
})
