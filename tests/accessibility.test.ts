import { describe, expect, it } from 'vitest'
import {
  REDUCED_FOV_KICK,
  activeDriftPalette,
  colorblindNitroPalette,
  feedbackScales,
} from '../src/config/accessibility'
import { defaultDrift } from '../src/config/drift'
import { defaultEffects } from '../src/config/effects'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { QUALITY_LEVELS, qualityProfiles, resolveQuality } from '../src/config/quality'
import { KartFeedback } from '../src/render/effects/kartFeedback'
import type { BoostState } from '../src/sim/kart/driftState'
import { createKartState } from '../src/sim/kart/kartState'
import { buildHudModel } from '../src/ui/hudModel'

describe('activeDriftPalette', () => {
  it('returns the original config when color-blind mode is off', () => {
    expect(activeDriftPalette(defaultDrift, false)).toBe(defaultDrift)
  })

  it('swaps tier and smoke colors without mutating the config', () => {
    const before = defaultDrift.levels.map((level) => level.color)
    const safe = activeDriftPalette(defaultDrift, true)
    expect(safe.levels.map((level) => level.color)).toEqual(colorblindNitroPalette.levelColors)
    expect(safe.smokeColors).toEqual(colorblindNitroPalette.smokeColors)
    expect(defaultDrift.levels.map((level) => level.color)).toEqual(before)
    expect(safe.levels[0].duration).toBe(defaultDrift.levels[0].duration)
    expect(safe.redZoneStart).toBe(defaultDrift.redZoneStart)
    expect(activeDriftPalette(defaultDrift, true)).toBe(safe)
  })

  it('reaches the HUD model with the tier number', () => {
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.boost.level = 2
    kart.boost.timeLeft = 1
    const model = buildHudModel(kart, defaultKartPhysics, activeDriftPalette(defaultDrift, true))
    expect(model.nitroColor).toBe('#d55e00')
    expect(model.nitroTier).toBe(2)
  })
})

describe('feedbackScales', () => {
  it('turns shake off and softens the FOV kick', () => {
    expect(feedbackScales(false)).toEqual({ shake: 1, fovKick: 1 })
    expect(feedbackScales(true)).toEqual({ shake: 0, fovKick: REDUCED_FOV_KICK })
  })

  it('scales the kick a nitro start gives', () => {
    const idle: BoostState = { level: 0, timeLeft: 0, perfect: false }
    const nitro: BoostState = { level: 3, timeLeft: 1, perfect: false }
    const drift = createKartState({ x: 0, y: 0, z: 0 }, 0).drift
    const normal = new KartFeedback(defaultEffects.camera)
    normal.update(idle, drift, 0, 0)
    const full = normal.update(nitro, drift, 0, 0).fovKick
    const reduced = new KartFeedback(defaultEffects.camera)
    reduced.setScales(feedbackScales(true))
    reduced.update(idle, drift, 0, 0)
    expect(reduced.update(nitro, drift, 0, 0).fovKick).toBeCloseTo(full * REDUCED_FOV_KICK)
  })
})

describe('resolveQuality', () => {
  it('caps the pixel ratio per level', () => {
    expect(resolveQuality('low', 3).pixelRatio).toBe(1)
    expect(resolveQuality('medium', 3).pixelRatio).toBe(1.5)
    expect(resolveQuality('high', 3).pixelRatio).toBe(2)
    expect(resolveQuality('high', 1).pixelRatio).toBe(1)
  })

  it('scales particles and drops effects on low', () => {
    expect(resolveQuality('low', 2)).toMatchObject({
      bloom: false,
      particleScale: 0.5,
      speedLines: false,
    })
    expect(resolveQuality('medium', 2)).toMatchObject({ bloom: true, particleScale: 0.75 })
    expect(resolveQuality('high', 2)).toMatchObject({ bloom: true, particleScale: 1 })
  })

  it('lets ?bloom=0 force the bloom off at every level', () => {
    for (const level of QUALITY_LEVELS) expect(resolveQuality(level, 2, true).bloom).toBe(false)
  })

  it('has a profile for every level, getting lighter downwards', () => {
    expect(qualityProfiles.low.particleScale).toBeLessThan(qualityProfiles.medium.particleScale)
    expect(qualityProfiles.medium.particleScale).toBeLessThan(qualityProfiles.high.particleScale)
  })
})
