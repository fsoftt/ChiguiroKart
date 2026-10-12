import { describe, expect, it } from 'vitest'
import { cloneKartState, createKartState, interpolateKart } from '../src/sim/kart/kartState'

describe('kart state', () => {
  it('clones deeply so the copy does not change with the original', () => {
    const original = createKartState({ x: 1, y: 0, z: 2 }, 0)
    const copy = cloneKartState(original)
    original.position.x = 99
    original.velocity.z = 5
    expect(copy.position.x).toBe(1)
    expect(copy.velocity.z).toBe(0)
  })

  it('interpolates position and takes the short arc for heading', () => {
    const previous = createKartState({ x: 0, y: 0, z: 0 }, Math.PI - 0.2)
    const current = createKartState({ x: 10, y: 0, z: 0 }, -Math.PI + 0.2)
    const middle = interpolateKart(previous, current, 0.5)
    expect(middle.position.x).toBeCloseTo(5)
    expect(Math.abs(middle.heading)).toBeCloseTo(Math.PI)
  })
})
