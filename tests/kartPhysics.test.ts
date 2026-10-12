import { describe, expect, it } from 'vitest'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { NEUTRAL_INPUT, type KartInput } from '../src/input/kartInput'
import { forwardSpeed, stepKart } from '../src/sim/kart/kartPhysics'
import { createKartState, type KartState } from '../src/sim/kart/kartState'

const DT = 1 / 60
const flatGround = (): number => 0
const config = defaultKartPhysics

function simulate(state: KartState, input: Partial<KartInput>, seconds: number): KartState {
  const fullInput = { ...NEUTRAL_INPUT, ...input }
  for (let t = 0; t < seconds; t += DT) stepKart(state, fullInput, config, flatGround, DT)
  return state
}

function newKart(): KartState {
  return createKartState({ x: 0, y: 0, z: 0 }, 0)
}

function kartAtSpeed(speed: number): KartState {
  const kart = newKart()
  kart.velocity.z = speed
  return kart
}

describe('stepKart', () => {
  it('accelerates forward and caps at top speed', () => {
    const kart = simulate(newKart(), { throttle: 1 }, 10)
    expect(forwardSpeed(kart)).toBeCloseTo(config.maxSpeed)
    expect(kart.position.z).toBeGreaterThan(0)
  })

  it('brakes to a stop, then reverses up to the reverse limit', () => {
    const kart = simulate(kartAtSpeed(10), { brake: 1 }, 5)
    expect(forwardSpeed(kart)).toBeCloseTo(-config.maxReverseSpeed)
  })

  it('coasts to a stop with no pedals', () => {
    const kart = simulate(kartAtSpeed(10), {}, 5)
    expect(forwardSpeed(kart)).toBe(0)
  })

  it('does not turn while stopped', () => {
    const kart = simulate(newKart(), { steer: 1 }, 1)
    expect(kart.heading).toBe(0)
  })

  it('steering right moves the kart to its right (-x at heading 0)', () => {
    const kart = simulate(kartAtSpeed(15), { throttle: 1, steer: 1 }, 0.5)
    expect(kart.heading).toBeLessThan(0)
    expect(kart.position.x).toBeLessThan(0)
  })

  it('steering is inverted in reverse, like a car', () => {
    const kart = simulate(kartAtSpeed(-5), { brake: 1, steer: 1 }, 0.5)
    expect(kart.heading).toBeGreaterThan(0)
  })

  it('removes sideways sliding through lateral grip', () => {
    const kart = newKart()
    kart.velocity.x = 10
    simulate(kart, {}, 2)
    expect(Math.abs(kart.velocity.x)).toBeLessThan(0.01)
  })

  it('falls under gravity and lands on the ground', () => {
    const kart = createKartState({ x: 0, y: 5, z: 0 }, 0)
    kart.onGround = false
    simulate(kart, {}, 0.1)
    expect(kart.onGround).toBe(false)
    expect(kart.position.y).toBeLessThan(5)

    simulate(kart, {}, 2)
    expect(kart.onGround).toBe(true)
    expect(kart.position.y).toBe(0)
    expect(kart.velocity.y).toBe(0)
  })

  it('ignores the pedals while airborne', () => {
    const kart = createKartState({ x: 0, y: 50, z: 0 }, 0)
    kart.onGround = false
    simulate(kart, { throttle: 1 }, 0.5)
    expect(forwardSpeed(kart)).toBe(0)
  })
})
