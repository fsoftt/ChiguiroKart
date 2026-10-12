import { describe, expect, it } from 'vitest'
import {
  createShake,
  shakeAmplitude,
  shakeOffset,
  startShake,
  stepShake,
} from '../src/render/effects/cameraFeedback'
import { ParticleRing } from '../src/render/effects/particleRing'

const BLACK = { r: 0, g: 0, b: 0 }

function newRing(capacity = 4): ParticleRing {
  return new ParticleRing(capacity, 2)
}

function spawn(ring: ParticleRing, life = 1): number {
  return ring.spawn({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, life, 1, 2, BLACK, 0.5)
}

describe('ParticleRing', () => {
  it('starts with no live particles', () => {
    expect(newRing().aliveCount).toBe(0)
  })

  it('keeps a spawned particle alive until it ages out', () => {
    const ring = newRing()
    const slot = spawn(ring, 0.5)
    expect(ring.isAlive(slot)).toBe(true)
    ring.update(0.25)
    expect(ring.isAlive(slot)).toBe(true)
    ring.update(0.3)
    expect(ring.isAlive(slot)).toBe(false)
  })

  it('collapses a dead particle to zero size so it stops drawing', () => {
    const ring = newRing()
    const slot = spawn(ring, 0.2)
    ring.update(0.3)
    expect(ring.params[slot * 2]).toBe(0)
    expect(ring.params[slot * 2 + 1]).toBe(0)
  })

  it('recycles the oldest slot once the pool is full', () => {
    const ring = newRing(2)
    const first = spawn(ring)
    const second = spawn(ring)
    expect(ring.aliveCount).toBe(2)
    const third = spawn(ring)
    expect(third).toBe(first)
    expect(ring.aliveCount).toBe(2)
    expect(ring.isAlive(second)).toBe(true)
  })

  it('grows the particle between its start and end sizes', () => {
    const ring = newRing()
    const slot = ring.spawn({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1, 1, 3, BLACK, 0.5)
    ring.update(0.5)
    const size = ring.params[slot * 2] ?? 0
    expect(size).toBeGreaterThan(1)
    expect(size).toBeLessThan(3)
  })

  it('fades opacity toward zero over the lifetime', () => {
    const ring = newRing()
    const slot = ring.spawn({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1, 1, 1, BLACK, 0.8)
    ring.update(0.5)
    expect(ring.params[slot * 2 + 1]).toBeCloseTo(0.4)
  })

  it('damps inherited velocity over time', () => {
    const ring = newRing()
    const slot = ring.spawn({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 10, 1, 1, BLACK, 0.5)
    const before = ring.offsets[slot * 3] ?? 0
    // A step shorter than 1 / drag leaves some velocity to travel with
    ring.update(0.1)
    expect(ring.offsets[slot * 3]).toBeGreaterThan(before)
  })
})

describe('camera shake', () => {
  it('starts at zero amplitude', () => {
    expect(shakeAmplitude(createShake())).toBe(0)
  })

  it('fades linearly to zero over the shake duration', () => {
    const shake = createShake()
    startShake(shake, 0.4, 0.4)
    expect(shakeAmplitude(shake)).toBeCloseTo(0.4)
    stepShake(shake, 0.2)
    expect(shakeAmplitude(shake)).toBeCloseTo(0.2)
    stepShake(shake, 0.25)
    expect(shakeAmplitude(shake)).toBe(0)
  })

  it('never replaces a stronger running shake with a weaker one', () => {
    const shake = createShake()
    startShake(shake, 0.5, 0.5)
    stepShake(shake, 0.1)
    startShake(shake, 0.1, 0.5)
    expect(shakeAmplitude(shake)).toBeCloseTo(0.4)
  })

  it('ignores a zero-length shake', () => {
    const shake = createShake()
    startShake(shake, 0.5, 0)
    expect(shakeAmplitude(shake)).toBe(0)
  })

  it('produces an offset that scales with the amplitude', () => {
    const strong = createShake()
    const weak = createShake()
    startShake(strong, 0.6, 1)
    startShake(weak, 0.2, 1)
    const strongOffset = { x: 0, y: 0 }
    const weakOffset = { x: 0, y: 0 }
    shakeOffset(strong, 0.05, 30, strongOffset)
    shakeOffset(weak, 0.05, 30, weakOffset)
    expect(Math.abs(strongOffset.x)).toBeGreaterThan(Math.abs(weakOffset.x))
  })

  it('returns a zero offset once the shake has ended', () => {
    const shake = createShake()
    startShake(shake, 0.5, 0.2)
    stepShake(shake, 0.3)
    const offset = { x: 1, y: 1 }
    shakeOffset(shake, 0.5, 30, offset)
    // sin(θ) * 0 can be -0, so compare by proximity rather than identity
    expect(offset.x).toBeCloseTo(0)
    expect(offset.y).toBeCloseTo(0)
  })
})
