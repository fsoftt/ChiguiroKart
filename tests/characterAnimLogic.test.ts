import { describe, expect, it } from 'vitest'
import {
  actionWeight,
  AIR_DELAY,
  driverAnimWeights,
  smoothWeights,
  throwActionFor,
  zeroWeights,
  type DriverAnimInput,
} from '../src/render/characterAnimLogic'
import { loopClips } from '../src/render/characters/rig'

const base: DriverAnimInput = {
  steer: 0,
  driftDirection: 0,
  boostActive: false,
  airTime: 0,
  hit: false,
  result: null,
}

function total(weights: Record<string, number>): number {
  return Object.values(weights).reduce((sum, w) => sum + w, 0)
}

describe('driverAnimWeights', () => {
  it('idles when nothing is going on', () => {
    expect(driverAnimWeights(base).idle).toBe(1)
  })

  it('blends the steering clips by the steer amount', () => {
    const left = driverAnimWeights({ ...base, steer: -0.5 })
    expect(left.steerLeft).toBeCloseTo(0.5)
    expect(left.steerRight).toBe(0)
    expect(left.idle).toBeCloseTo(0.5)
    const right = driverAnimWeights({ ...base, steer: 1 })
    expect(right.steerRight).toBe(1)
    expect(right.idle).toBe(0)
  })

  it('always adds up to 1', () => {
    const inputs: DriverAnimInput[] = [
      base,
      { ...base, steer: 1, driftDirection: 1, boostActive: true },
      { ...base, steer: -0.3, boostActive: true },
      { ...base, airTime: 1 },
      { ...base, hit: true, steer: 1 },
      { ...base, result: 'defeat' },
    ]
    for (const input of inputs) expect(total(driverAnimWeights(input))).toBeCloseTo(1)
  })

  it('shows the drift pose while drifting and keeps part of the steering', () => {
    const weights = driverAnimWeights({ ...base, steer: 1, driftDirection: 1 })
    expect(weights.drift).toBeGreaterThan(0.5)
    expect(weights.steerRight).toBeGreaterThan(0)
    expect(weights.steerRight).toBeLessThan(weights.drift)
  })

  it('adds the boost pose', () => {
    expect(driverAnimWeights({ ...base, boostActive: true }).boost).toBeGreaterThan(0.5)
  })

  it('needs a moment in the air before showing the air pose', () => {
    expect(driverAnimWeights({ ...base, airTime: AIR_DELAY }).air).toBe(0)
    expect(driverAnimWeights({ ...base, airTime: AIR_DELAY + 0.01 }).air).toBe(1)
  })

  it('lets a hit override driving, and the result override everything', () => {
    const hit = driverAnimWeights({ ...base, hit: true, airTime: 2, boostActive: true })
    expect(hit.hit).toBe(1)
    const result = driverAnimWeights({ ...base, hit: true, result: 'victory' })
    expect(result.victory).toBe(1)
    expect(result.hit).toBe(0)
  })
})

describe('smoothWeights', () => {
  it('moves toward the target without overshooting', () => {
    const current = zeroWeights()
    const target = driverAnimWeights({ ...base, boostActive: true })
    smoothWeights(current, target, 0.05)
    expect(current.boost).toBeGreaterThan(0)
    expect(current.boost).toBeLessThan(1)
    for (let i = 0; i < 200; i++) smoothWeights(current, target, 0.05)
    expect(current.boost).toBeCloseTo(1)
  })

  it('keeps the weights when no time passes', () => {
    const current = zeroWeights()
    current.idle = 1
    smoothWeights(current, driverAnimWeights({ ...base, result: 'victory' }), 0)
    for (const clip of loopClips) expect(current[clip]).toBe(clip === 'idle' ? 1 : 0)
  })
})

describe('actionWeight', () => {
  it('fades in, holds and fades out', () => {
    expect(actionWeight(0, 1)).toBe(0)
    expect(actionWeight(0.5, 1)).toBe(1)
    expect(actionWeight(0.95, 1)).toBeLessThan(0.5)
    expect(actionWeight(1, 1)).toBe(0)
    expect(actionWeight(0.5, 0)).toBe(0)
  })
})

describe('throwActionFor', () => {
  it('throws backward when looking back or dropping a power behind', () => {
    expect(throwActionFor('coco', false)).toBe('throwForward')
    expect(throwActionFor('coco', true)).toBe('throwBack')
    expect(throwActionFor('mango', false)).toBe('throwBack')
  })
})
