import { describe, expect, it } from 'vitest'
import {
  damp,
  forwardOf,
  headingOf,
  lerpAngle,
  moveTowards,
  rightOf,
  wrapAngle,
} from '../src/sim/math'

describe('wrapAngle', () => {
  it.each([
    [0, 0],
    [Math.PI, Math.PI],
    [-Math.PI, Math.PI],
    [3 * Math.PI, Math.PI],
    [2 * Math.PI + 0.5, 0.5],
    [-2 * Math.PI - 0.5, -0.5],
  ])('wraps %f to %f', (input, expected) => {
    expect(wrapAngle(input)).toBeCloseTo(expected)
  })
})

describe('lerpAngle', () => {
  it('takes the short way across ±PI', () => {
    const from = Math.PI - 0.1
    const to = -Math.PI + 0.1
    expect(wrapAngle(lerpAngle(from, to, 0.5))).toBeCloseTo(Math.PI)
  })
})

describe('moveTowards', () => {
  it('stops at the target', () => {
    expect(moveTowards(1, 2, 5)).toBe(2)
  })

  it('moves at most maxDelta in either direction', () => {
    expect(moveTowards(0, 10, 3)).toBe(3)
    expect(moveTowards(0, -10, 3)).toBe(-3)
  })
})

describe('damp', () => {
  it('is frame-rate independent', () => {
    const oneStep = damp(0, 1, 4, 0.1)
    const twoSteps = damp(damp(0, 1, 4, 0.05), 1, 4, 0.05)
    expect(twoSteps).toBeCloseTo(oneStep)
  })
})

describe('heading vectors', () => {
  it('faces +z at heading 0 with the right side at -x', () => {
    expect(forwardOf(0)).toMatchObject({ x: 0, z: 1 })
    expect(rightOf(0).x).toBeCloseTo(-1)
    expect(rightOf(0).z).toBeCloseTo(0)
  })

  it('headingOf inverts forwardOf', () => {
    const heading = 1.2
    const forward = forwardOf(heading)
    expect(headingOf(forward.x, forward.z)).toBeCloseTo(heading)
  })
})
