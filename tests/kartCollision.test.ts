import { describe, expect, it } from 'vitest'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { createKartState, type KartState } from '../src/sim/kart/kartState'
import { resolveKartCollisions } from '../src/sim/kart/kartCollision'

const physics = defaultKartPhysics

function kartAt(x: number, z: number, y = 0): KartState {
  return createKartState({ x, y, z }, 0)
}

describe('resolveKartCollisions', () => {
  it('separates overlapping karts equally', () => {
    const a = kartAt(0, 0)
    const b = kartAt(1, 0)
    expect(resolveKartCollisions([a, b], physics)).toBe(true)

    expect(b.position.x - a.position.x).toBeCloseTo(physics.kartRadius * 2)
    expect(a.position.x).toBeCloseTo(-(physics.kartRadius * 2 - 1) / 2)
    expect(b.position.x).toBeCloseTo(1 + (physics.kartRadius * 2 - 1) / 2)
  })

  it('bounces karts that approach head-on', () => {
    const a = kartAt(0, 0)
    const b = kartAt(1, 0)
    a.velocity.x = 10
    b.velocity.x = -10
    resolveKartCollisions([a, b], physics)

    expect(a.velocity.x).toBeCloseTo(-10 * physics.kartRestitution)
    expect(b.velocity.x).toBeCloseTo(10 * physics.kartRestitution)
  })

  it('transfers momentum from a moving kart to a parked one', () => {
    const a = kartAt(0, 0)
    const b = kartAt(1, 0)
    a.velocity.x = 10
    resolveKartCollisions([a, b], physics)

    expect(b.velocity.x).toBeGreaterThan(0)
    expect(a.velocity.x + b.velocity.x).toBeCloseTo(10)
  })

  it('does not change velocity of overlapping karts that are separating', () => {
    const a = kartAt(0, 0)
    const b = kartAt(1, 0)
    a.velocity.x = -3
    b.velocity.x = 3
    resolveKartCollisions([a, b], physics)

    expect(a.velocity.x).toBe(-3)
    expect(b.velocity.x).toBe(3)
  })

  it('leaves karts that do not overlap untouched', () => {
    const a = kartAt(0, 0)
    const b = kartAt(physics.kartRadius * 2 + 0.5, 0)
    a.velocity.x = 10
    expect(resolveKartCollisions([a, b], physics)).toBe(false)
    expect(a.position.x).toBe(0)
    expect(a.velocity.x).toBe(10)
  })

  it('skips pairs separated vertically by more than a kart height', () => {
    const a = kartAt(0, 0)
    const b = kartAt(0.5, 0, physics.kartHeight + 0.5)
    a.velocity.x = 10
    expect(resolveKartCollisions([a, b], physics)).toBe(false)
    expect(a.position.x).toBe(0)
    expect(b.position.x).toBe(0.5)
  })

  it('handles exactly coincident karts without NaN', () => {
    const a = kartAt(2, 2)
    const b = kartAt(2, 2)
    resolveKartCollisions([a, b], physics)
    expect(Number.isFinite(a.position.x)).toBe(true)
    expect(a.position.x).not.toBe(b.position.x)
  })
})
