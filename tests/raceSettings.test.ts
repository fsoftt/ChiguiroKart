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
  withTrack,
  withCup,
  shiftTrack,
  shiftCup,
  RACE_MODES,
} from '../src/game/raceSettings'

describe('parseRaceSettings', () => {
  it('defaults to normal with the rubber band on', () => {
    expect(parseRaceSettings('')).toEqual({
      mode: 'carrera',
      difficulty: 'normal',
      rubberBandEnabled: true,
      character: 'chiguiro',
      track: 'cocora',
      cup: 'andina',
    })
  })

  it('reads the difficulty and the rubber band from the URL', () => {
    expect(parseRaceSettings('?dificultad=dificil&remontada=0')).toEqual({
      mode: 'carrera',
      difficulty: 'dificil',
      rubberBandEnabled: false,
      character: 'chiguiro',
      track: 'cocora',
      cup: 'andina',
    })
    expect(parseRaceSettings('?dificultad=facil').difficulty).toBe('facil')
  })

  it('ignores unknown values and unrelated params', () => {
    expect(parseRaceSettings('?dificultad=imposible&debug&pista=test')).toEqual({
      mode: 'carrera',
      difficulty: 'normal',
      rubberBandEnabled: true,
      character: 'chiguiro',
      track: 'cocora',
      cup: 'andina',
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
      track: 'cocora',
      cup: 'andina',
    })
    expect(off).toEqual({
      mode: 'carrera',
      difficulty: 'dificil',
      rubberBandEnabled: false,
      character: 'chiguiro',
      track: 'cocora',
      cup: 'andina',
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
    expect(shiftMode(base, 1).mode).toBe('copa')
    expect(shiftMode(shiftMode(base, 1), 1).mode).toBe('contrarreloj')
    expect(shiftMode(trial, 1).mode).toBe('contrarreloj')
    expect(shiftMode(trial, -1).mode).toBe('copa')
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

describe('cup mode', () => {
  it('lists the modes in menu order', () => {
    expect(RACE_MODES).toEqual(['carrera', 'copa', 'contrarreloj'])
  })

  it('reads ?modo=copa and ?copa=, and ?copa alone starts the cup mode', () => {
    expect(parseRaceSettings('?modo=copa')).toMatchObject({ mode: 'copa', cup: 'andina' })
    expect(parseRaceSettings('?copa=caribe')).toMatchObject({ mode: 'copa', cup: 'caribe' })
    expect(parseRaceSettings('?copa=selva&modo=carrera')).toMatchObject({
      mode: 'carrera',
      cup: 'selva',
    })
    expect(parseRaceSettings('?copa=nope')).toMatchObject({ mode: 'carrera', cup: 'andina' })
  })

  it('shifts the cup and clamps at both ends', () => {
    const base = parseRaceSettings('')
    expect(shiftCup(base, 1).cup).toBe('caribe')
    expect(shiftCup(shiftCup(base, 1), 1).cup).toBe('selva')
    expect(shiftCup(shiftCup(shiftCup(base, 1), 1), 1).cup).toBe('selva')
    expect(shiftCup(base, -1).cup).toBe('andina')
    expect(withCup(base, 'selva').cup).toBe('selva')
    expect(base.cup).toBe('andina')
  })
})

describe('track', () => {
  it('reads ?pista= for catalog tracks and ignores test, custom and unknown names', () => {
    expect(parseRaceSettings('?pista=nevado').track).toBe('nevado')
    expect(parseRaceSettings('?pista=tatacoa').track).toBe('tatacoa')
    expect(parseRaceSettings('?pista=test').track).toBe('cocora')
    expect(parseRaceSettings('?pista=custom').track).toBe('cocora')
    expect(parseRaceSettings('?pista=narnia').track).toBe('cocora')
  })

  it('sets the track without mutating the input', () => {
    const base = parseRaceSettings('')
    expect(withTrack(base, 'bogota').track).toBe('bogota')
    expect(base.track).toBe('cocora')
  })

  it('shifts the track through the 12 tracks and wraps around both ends', () => {
    const first = parseRaceSettings('')
    expect(shiftTrack(first, 1).track).toBe('nevado')
    expect(shiftTrack(first, -1).track).toBe('tatacoa')
    expect(shiftTrack(withTrack(first, 'tatacoa'), 1).track).toBe('cocora')
    expect(shiftTrack(first, 12).track).toBe('cocora')
    expect(shiftTrack(first, 4).track).toBe('cartagena')
  })
})
