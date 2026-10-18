import { describe, expect, it } from 'vitest'
import { defaultEffects } from '../src/config/effects'
import { SkidBuffer } from '../src/render/effects/skidBuffer'
import {
  isMarking,
  landingBurstCount,
  skidFade,
  skidProfileFor,
  surfaceEffectKind,
  surfaceEmissionRate,
  withinEffectRange,
  type SlipInput,
} from '../src/render/effects/surfaceFxLogic'
import type { SurfaceType } from '../src/sim/race/surface'

const particles = defaultEffects.surfaceParticles
const marks = defaultEffects.skidMarks
const WHITE = { r: 1, g: 1, b: 1 }

const slip = (patch: Partial<SlipInput> = {}): SlipInput => ({
  onGround: true,
  drifting: false,
  braking: false,
  speedRatio: 0.8,
  lateralSpeed: 0,
  steer: 0,
  ...patch,
})

describe('surfaceEffectKind', () => {
  it('maps each surface to its particle family', () => {
    expect(surfaceEffectKind('dirt')).toBe('dust')
    expect(surfaceEffectKind('grass')).toBe('dust')
    expect(surfaceEffectKind('mud')).toBe('splash')
    expect(surfaceEffectKind('water')).toBe('splash')
    expect(surfaceEffectKind('ice')).toBe('snow')
    expect(surfaceEffectKind('sand')).toBe('sand')
  })

  it('has a particle and a mark profile for every surface', () => {
    const surfaces = Object.keys(particles.profiles) as SurfaceType[]
    expect(surfaces).toHaveLength(8)
    for (const surface of surfaces) {
      expect(surfaceEffectKind(surface)).not.toBe('none')
      expect(marks.profiles[surface]).toBeDefined()
    }
  })
})

describe('surfaceEmissionRate', () => {
  it('is zero in the air', () => {
    expect(surfaceEmissionRate(particles.profiles.dirt, 1, true, false)).toBe(0)
  })

  it('emits nothing on asphalt while rolling but some while sliding', () => {
    const asphalt = particles.profiles.asphalt
    expect(surfaceEmissionRate(asphalt, 1, false, true)).toBe(0)
    expect(surfaceEmissionRate(asphalt, 0.9, true, true)).toBeGreaterThan(0)
  })

  it('grows with speed and is stronger while drifting', () => {
    const dirt = particles.profiles.dirt
    expect(surfaceEmissionRate(dirt, 1, false, true)).toBeGreaterThan(
      surfaceEmissionRate(dirt, 0.4, false, true),
    )
    expect(surfaceEmissionRate(dirt, 0.6, true, true)).toBeGreaterThan(
      surfaceEmissionRate(dirt, 0.6, false, true),
    )
  })

  it('stays quiet below the minimum speed unless drifting', () => {
    const sand = particles.profiles.sand
    expect(surfaceEmissionRate(sand, 0.05, false, true)).toBe(0)
    expect(surfaceEmissionRate(sand, 0.05, true, true)).toBeGreaterThan(0)
  })

  it('treats reverse speed like forward speed', () => {
    const dirt = particles.profiles.dirt
    expect(surfaceEmissionRate(dirt, -0.8, false, true)).toBe(
      surfaceEmissionRate(dirt, 0.8, false, true),
    )
  })
})

describe('landingBurstCount', () => {
  it('ignores hops and scales with air time up to a cap', () => {
    const dirt = particles.profiles.dirt
    expect(landingBurstCount(dirt, 0.1, particles)).toBe(0)
    const medium = landingBurstCount(dirt, 0.5, particles)
    const long = landingBurstCount(dirt, 1, particles)
    expect(medium).toBeGreaterThan(0)
    expect(long).toBeGreaterThan(medium)
    expect(landingBurstCount(dirt, 5, particles)).toBe(long)
  })
})

describe('isMarking', () => {
  it('marks while drifting, sliding sideways or hard braking', () => {
    expect(isMarking(slip({ drifting: true }), 'asphalt', marks)).toBe(true)
    expect(isMarking(slip({ lateralSpeed: 6 }), 'dirt', marks)).toBe(true)
    expect(isMarking(slip({ braking: true }), 'asphalt', marks)).toBe(true)
  })

  it('does not mark when driving straight, braking slowly or airborne', () => {
    expect(isMarking(slip(), 'asphalt', marks)).toBe(false)
    expect(isMarking(slip({ braking: true, speedRatio: 0.1 }), 'asphalt', marks)).toBe(false)
    expect(isMarking(slip({ drifting: true, onGround: false }), 'asphalt', marks)).toBe(false)
  })

  it('marks sharp fast turns only on grippy ground', () => {
    const sharp = slip({ steer: 1, speedRatio: 0.95 })
    expect(isMarking(sharp, 'asphalt', marks)).toBe(true)
    expect(isMarking(sharp, 'dirt', marks)).toBe(false)
  })
})

describe('skidProfileFor', () => {
  it('is darkest on asphalt and absent on water and grass', () => {
    const asphalt = skidProfileFor('asphalt', marks)
    const dirt = skidProfileFor('dirt', marks)
    expect(asphalt?.alpha).toBeGreaterThan(dirt?.alpha ?? 1)
    expect(skidProfileFor('water', marks)).toBeNull()
    expect(skidProfileFor('grass', marks)).toBeNull()
    expect(skidProfileFor('ice', marks)).not.toBeNull()
  })
})

describe('skidFade', () => {
  it('holds, then fades linearly to zero', () => {
    expect(skidFade(0, 10, 0.4)).toBe(1)
    expect(skidFade(4, 10, 0.4)).toBe(1)
    expect(skidFade(7, 10, 0.4)).toBeCloseTo(0.5)
    expect(skidFade(10, 10, 0.4)).toBe(0)
    expect(skidFade(20, 10, 0.4)).toBe(0)
  })
})

describe('withinEffectRange', () => {
  it('compares the planar distance', () => {
    expect(withinEffectRange(3, 4, 0, 0, 5)).toBe(true)
    expect(withinEffectRange(3, 4.1, 0, 0, 5)).toBe(false)
  })
})

describe('SkidBuffer', () => {
  function extend(buffer: SkidBuffer, z: number, trail = 0): number {
    return buffer.extend(trail, 0, 0, z, 0, 1, 0.4, 0.5, WHITE, 0.5, 3)
  }

  it('needs two points before the first quad and spaces quads by segment length', () => {
    const buffer = new SkidBuffer(8, 2, 10, 0.4)
    expect(extend(buffer, 0)).toBe(-1)
    expect(extend(buffer, 0.2)).toBe(-1)
    expect(extend(buffer, 0.6)).toBe(0)
    expect(extend(buffer, 1.2)).toBe(1)
    expect(buffer.visibleCount).toBe(2)
  })

  it('joins quads edge to edge', () => {
    const buffer = new SkidBuffer(8, 1, 10, 0.4)
    extend(buffer, 0)
    extend(buffer, 1)
    extend(buffer, 2)
    const first = Array.from(buffer.positions.slice(0, 12))
    const second = Array.from(buffer.positions.slice(12, 24))
    // The second quad's starting edge is the first quad's finishing edge
    expect(second[0]).toBeCloseTo(first[9] ?? NaN)
    expect(second[2]).toBeCloseTo(first[11] ?? NaN)
    expect(second[3]).toBeCloseTo(first[6] ?? NaN)
    expect(second[5]).toBeCloseTo(first[8] ?? NaN)
  })

  it('wraps and overwrites the oldest quad when full', () => {
    const buffer = new SkidBuffer(3, 1, 100, 0.4)
    extend(buffer, 0)
    const written = [1, 2, 3, 4, 5].map((z) => extend(buffer, z))
    expect(written).toEqual([0, 1, 2, 0, 1])
    expect(buffer.nextIndex).toBe(2)
    expect(buffer.visibleCount).toBe(3)
  })

  it('breaks the trail on a long gap or an explicit break', () => {
    const buffer = new SkidBuffer(8, 1, 10, 0.4)
    extend(buffer, 0)
    expect(extend(buffer, 1)).toBe(0)
    expect(extend(buffer, 50)).toBe(-1)
    expect(extend(buffer, 51)).toBe(1)
    buffer.breakTrail(0)
    expect(extend(buffer, 52)).toBe(-1)
  })

  it('keeps wheel trails independent', () => {
    const buffer = new SkidBuffer(8, 2, 10, 0.4)
    extend(buffer, 0, 0)
    expect(extend(buffer, 1, 1)).toBe(-1)
    expect(extend(buffer, 1, 0)).toBe(0)
  })

  it('fades marks out and frees them', () => {
    const buffer = new SkidBuffer(4, 1, 10, 0.4)
    extend(buffer, 0)
    extend(buffer, 1)
    expect(buffer.alphaOf(0)).toBeCloseTo(0.5)
    buffer.update(3)
    expect(buffer.alphaOf(0)).toBeCloseTo(0.5)
    buffer.update(4)
    expect(buffer.alphaOf(0)).toBeCloseTo(0.25)
    buffer.update(4)
    expect(buffer.alphaOf(0)).toBe(0)
    expect(buffer.visibleCount).toBe(0)
  })

  it('scales its capacity and clears', () => {
    const buffer = new SkidBuffer(10, 1, 10, 0.4)
    buffer.setScale(0.3, 10)
    extend(buffer, 0)
    const quads = [1, 2, 3, 4].map((z) => extend(buffer, z))
    expect(quads).toEqual([0, 1, 2, 0])
    buffer.clear()
    expect(buffer.visibleCount).toBe(0)
    expect(buffer.nextIndex).toBe(0)
  })
})
