import { describe, expect, it } from 'vitest'
import {
  degreeToMidi,
  distanceGain,
  engineTarget,
  midiToFrequency,
  stepSeconds,
  volumesFromSearch,
  type EngineInput,
} from '../src/audio/audioMath'
import {
  desiredMusic,
  detectCues,
  isDriftSqueal,
  type AudioFrame,
} from '../src/audio/raceAudioLogic'
import { sfxRecipes, voiceFor } from '../src/audio/sfxRecipes'
import { StepSequencer } from '../src/audio/sequencer'
import { VoiceLimiter } from '../src/audio/voiceLimiter'
import { defaultVolumes, engineProfiles, powerSounds, voiceProfiles } from '../src/config/audio'
import { characterIds } from '../src/config/characters'
import { FALLBACK_THEME, musicThemes, rhythmStyles } from '../src/config/music'
import { trackIds } from '../src/config/tracks/catalog'
import { POWER_IDS } from '../src/sim/items/itemTypes'

function frame(overrides: Partial<AudioFrame> = {}): AudioFrame {
  return {
    racing: true,
    phase: 'racing',
    countdown: 0,
    currentLap: 1,
    totalLaps: 3,
    lapsDone: 0,
    rank: 4,
    onGround: true,
    airTime: 0,
    speedRatio: 0.8,
    throttle: 1,
    driftDirection: 0,
    driftCharge: 0,
    chainBroken: false,
    boostLevel: 0,
    boostTimeLeft: 0,
    ...overrides,
  }
}

describe('notes and scales', () => {
  it('maps MIDI notes to frequencies', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440)
    expect(midiToFrequency(57)).toBeCloseTo(220)
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 1)
  })

  it('maps scale degrees, wrapping by octaves', () => {
    expect(degreeToMidi(60, 'major', 0)).toBe(60)
    expect(degreeToMidi(60, 'major', 2)).toBe(64)
    expect(degreeToMidi(60, 'minor', 2)).toBe(63)
    expect(degreeToMidi(60, 'major', 7)).toBe(72)
    expect(degreeToMidi(60, 'major', -1)).toBe(59)
    expect(degreeToMidi(60, 'major', 9)).toBe(76)
  })
})

describe('step sequencer', () => {
  it('computes the length of a step from the tempo', () => {
    expect(stepSeconds(120)).toBeCloseTo(0.125)
    expect(stepSeconds(120, 1.08)).toBeCloseTo(0.125 / 1.08)
  })

  it('schedules the steps inside the lookahead window at exact times', () => {
    const calls: [number, number][] = []
    const sequencer = new StepSequencer(
      (step, time) => calls.push([step, time]),
      () => 0.125,
      0.1,
    )
    sequencer.start(1)
    expect(sequencer.tick(1)).toBe(1)
    expect(calls).toEqual([[0, 1]])
    expect(sequencer.tick(1.03)).toBe(1)
    expect(calls[1]?.[0]).toBe(1)
    expect(calls[1]?.[1]).toBeCloseTo(1.125)
    // Nothing new until the next step falls inside the window
    expect(sequencer.tick(1.04)).toBe(0)
  })

  it('follows tempo changes on later steps and skips stale steps after a stall', () => {
    let length = 0.125
    const times: number[] = []
    const sequencer = new StepSequencer(
      (_step, time) => times.push(time),
      () => length,
      0.1,
    )
    sequencer.start(0)
    sequencer.tick(0)
    length = 0.0625
    sequencer.tick(0.2)
    expect(times[1]).toBeCloseTo(0.125)
    expect(times[2]).toBeCloseTo(0.1875)
    times.length = 0
    sequencer.tick(60)
    expect(times[0]).toBeCloseTo(60)
  })
})

describe('music config', () => {
  it('has a theme for every track and the menu', () => {
    for (const id of trackIds) expect(musicThemes[id], id).toBeDefined()
    expect(musicThemes.menu).toBeDefined()
    expect(musicThemes[FALLBACK_THEME]).toBeDefined()
  })

  it('has consistent pattern lengths', () => {
    for (const [name, style] of Object.entries(rhythmStyles)) {
      const n = style.stepsPerBar
      for (const pattern of [
        style.kick,
        style.snare,
        style.hat,
        style.perc,
        style.bass,
        style.stab,
      ]) {
        expect(pattern.length, name).toBe(n)
      }
    }
  })

  it('keeps lead notes and chords valid', () => {
    for (const [name, theme] of Object.entries(musicThemes)) {
      const style = rhythmStyles[theme.style]
      const total = theme.leadBars * style.stepsPerBar
      expect(theme.tempo, name).toBeGreaterThan(60)
      expect(theme.chords.length, name).toBeGreaterThan(0)
      expect(theme.lead.length, name).toBeGreaterThan(0)
      for (const [step, , length] of theme.lead) {
        expect(step, name).toBeGreaterThanOrEqual(0)
        expect(length, name).toBeGreaterThan(0)
        expect(step + length, name).toBeLessThanOrEqual(total)
      }
    }
  })
})

describe('race audio transitions', () => {
  it('beeps on entering the countdown and each second, then GO', () => {
    const start = frame({ phase: 'countdown', countdown: 3 })
    expect(detectCues(null, start)).toEqual([{ type: 'countdown', count: 3 }])
    const still = frame({ phase: 'countdown', countdown: 2.5 })
    expect(detectCues(start, still)).toEqual([])
    const two = frame({ phase: 'countdown', countdown: 1.99 })
    expect(detectCues(still, two)).toEqual([{ type: 'countdown', count: 2 }])
    const one = frame({ phase: 'countdown', countdown: 0.99 })
    expect(detectCues(two, one)).toEqual([{ type: 'countdown', count: 1 }])
    expect(detectCues(one, frame({ phase: 'racing' }))).toEqual([{ type: 'go' }])
  })

  it('beeps again when the race restarts from the results', () => {
    const finished = frame({ phase: 'finished' })
    const restart = frame({ phase: 'countdown', countdown: 3 })
    expect(detectCues(finished, restart)).toEqual([{ type: 'countdown', count: 3 }])
  })

  it('stays silent in the menu', () => {
    expect(detectCues(frame(), frame({ racing: false, onGround: false }))).toEqual([])
  })

  it('detects laps, the final lap and the finish', () => {
    const base = frame({ currentLap: 1, lapsDone: 0 })
    expect(detectCues(base, frame({ currentLap: 2, lapsDone: 1 }))).toEqual([{ type: 'lap' }])
    const second = frame({ currentLap: 2, lapsDone: 1 })
    expect(detectCues(second, frame({ currentLap: 3, lapsDone: 2 }))).toEqual([
      { type: 'finalLap' },
    ])
    const last = frame({ currentLap: 3, lapsDone: 2 })
    expect(detectCues(last, frame({ phase: 'finished', lapsDone: 3, rank: 2 }))).toEqual([
      { type: 'finish', win: true },
    ])
    expect(detectCues(last, frame({ phase: 'finished', lapsDone: 3, rank: 6 }))).toEqual([
      { type: 'finish', win: false },
    ])
  })

  it('detects nitro starts and chain breaks', () => {
    const idle = frame()
    const nitro = frame({ boostLevel: 2, boostTimeLeft: 1 })
    expect(detectCues(idle, nitro)).toEqual([{ type: 'nitro', level: 2 }])
    expect(detectCues(nitro, frame({ boostLevel: 2, boostTimeLeft: 0.9 }))).toEqual([])
    expect(detectCues(idle, frame({ chainBroken: true }))).toEqual([{ type: 'chainBreak' }])
  })

  it('detects jumps, landings scaled by air time, and bumps', () => {
    const flying = detectCues(frame(), frame({ onGround: false }))
    expect(flying).toEqual([{ type: 'jump' }])
    const short = detectCues(frame({ onGround: false, airTime: 0.05 }), frame())
    expect(short).toEqual([])
    const [soft] = detectCues(frame({ onGround: false, airTime: 0.3 }), frame())
    const [hard] = detectCues(frame({ onGround: false, airTime: 1.5 }), frame())
    expect(soft?.type).toBe('landing')
    expect(hard).toEqual({ type: 'landing', strength: 1 })
    if (soft?.type === 'landing') expect(soft.strength).toBeLessThan(1)
    const bump = detectCues(frame({ speedRatio: 0.9 }), frame({ speedRatio: 0.3 }))
    expect(bump[0]?.type).toBe('bump')
    expect(detectCues(frame({ speedRatio: 0.9 }), frame({ speedRatio: 0.88 }))).toEqual([])
  })

  it('picks the music: menu, silence in the countdown, track theme, faster on the last lap', () => {
    expect(desiredMusic(frame({ racing: false }), 'cocora')).toEqual({
      theme: 'menu',
      tempoScale: 1,
    })
    expect(desiredMusic(frame({ phase: 'countdown' }), 'cocora').theme).toBeNull()
    expect(desiredMusic(frame(), 'llanos')).toEqual({ theme: 'llanos', tempoScale: 1 })
    expect(desiredMusic(frame(), null).theme).toBe(FALLBACK_THEME)
    expect(desiredMusic(frame({ currentLap: 3 }), 'llanos').tempoScale).toBeCloseTo(1.08)
    expect(desiredMusic(frame({ phase: 'finished' }), 'llanos').theme).toBeNull()
  })

  it('squeals only while drifting on the ground', () => {
    expect(isDriftSqueal(frame({ driftDirection: 1 }))).toBe(true)
    expect(isDriftSqueal(frame({ driftDirection: 1, onGround: false }))).toBe(false)
    expect(isDriftSqueal(frame())).toBe(false)
  })
})

describe('voice limiter', () => {
  it('caps the total and per-kind polyphony and frees voices over time', () => {
    const limiter = new VoiceLimiter(3, 2)
    expect(limiter.tryAcquire('a', 0, 1)).toBe(true)
    expect(limiter.tryAcquire('a', 0, 1)).toBe(true)
    expect(limiter.tryAcquire('a', 0, 1)).toBe(false)
    expect(limiter.tryAcquire('b', 0, 2)).toBe(true)
    expect(limiter.tryAcquire('c', 0, 1)).toBe(false)
    expect(limiter.active(0.5)).toBe(3)
    expect(limiter.tryAcquire('c', 1.5, 1)).toBe(true)
    expect(limiter.active(1.5)).toBe(2)
  })
})

describe('engine mapping', () => {
  const profile = engineProfiles.chiguiro
  const base: EngineInput = {
    speedRatio: 0,
    throttle: 0,
    airborne: false,
    nitroLevel: 0,
    active: true,
    finished: false,
  }

  it('rises with speed and throttle', () => {
    const idle = engineTarget(base, profile)
    const half = engineTarget({ ...base, speedRatio: 0.5 }, profile)
    const full = engineTarget({ ...base, speedRatio: 1 }, profile)
    expect(half.frequency).toBeGreaterThan(idle.frequency)
    expect(full.frequency).toBeGreaterThan(half.frequency)
    expect(full.cutoff).toBeGreaterThan(idle.cutoff)
    expect(engineTarget({ ...base, throttle: 1 }, profile).frequency).toBeGreaterThan(
      idle.frequency,
    )
  })

  it('gets brighter with nitro tiers and drops in the air', () => {
    const cruise = { ...base, speedRatio: 0.8, throttle: 1 }
    const levels = [0, 1, 2, 3].map((nitroLevel) =>
      engineTarget({ ...cruise, nitroLevel }, profile),
    )
    for (let i = 1; i < levels.length; i++) {
      expect(levels[i]?.cutoff).toBeGreaterThan(levels[i - 1]?.cutoff ?? 0)
      expect(levels[i]?.frequency).toBeGreaterThan(levels[i - 1]?.frequency ?? 0)
    }
    const air = engineTarget({ ...cruise, airborne: true }, profile)
    expect(air.frequency).toBeLessThan(levels[0]?.frequency ?? 0)
    expect(air.gain).toBeLessThan(levels[0]?.gain ?? 0)
  })

  it('is silent outside the race and differs per character', () => {
    expect(engineTarget({ ...base, active: false }, profile).gain).toBe(0)
    const bear = engineTarget(base, engineProfiles.oso).frequency
    const monkey = engineTarget(base, engineProfiles.titi).frequency
    expect(monkey).toBeGreaterThan(bear)
  })
})

describe('audio tables', () => {
  it('covers every character and power', () => {
    for (const id of characterIds) {
      expect(engineProfiles[id]).toBeDefined()
      expect(voiceProfiles[id]).toBeDefined()
      for (const mood of ['hit', 'win', 'lose'] as const) {
        expect(voiceFor(id, mood).length).toBeGreaterThan(0)
      }
    }
    for (const power of POWER_IDS) {
      expect(sfxRecipes[`power-${powerSounds[power]}`], power).toBeDefined()
    }
  })

  it('gives every character a distinct voice pitch and shape', () => {
    const keys = characterIds.map((id) => {
      const v = voiceProfiles[id]
      return `${v.pitch}/${v.wave}/${v.syllables}`
    })
    expect(new Set(keys).size).toBe(characterIds.length)
  })

  it('fades sounds with distance', () => {
    expect(distanceGain(2)).toBe(1)
    expect(distanceGain(1000)).toBe(0)
    expect(distanceGain(30)).toBeLessThan(distanceGain(15))
  })

  it('reads the volume from the URL', () => {
    expect(volumesFromSearch('')).toEqual(defaultVolumes)
    expect(volumesFromSearch('?volumen=0').master).toBe(0)
    expect(volumesFromSearch('?volumen=0.5').master).toBeCloseTo(defaultVolumes.master * 0.5)
    expect(volumesFromSearch('?volumen=abc')).toEqual(defaultVolumes)
  })
})
