import { describe, expect, it } from 'vitest'
import { defaultDrift, type DriftConfig } from '../src/config/drift'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { NEUTRAL_INPUT, type KartInput } from '../src/input/kartInput'
import { forwardSpeed, stepKart } from '../src/sim/kart/kartPhysics'
import { createKartState, type KartState } from '../src/sim/kart/kartState'

const DT = 1 / 60
const flatGround = (): number => 0
const config = defaultKartPhysics
const drift = defaultDrift

function simulate(state: KartState, input: Partial<KartInput>, seconds: number): KartState {
  const fullInput = { ...NEUTRAL_INPUT, ...input }
  for (let t = 0; t < seconds; t += DT) {
    stepKart(state, fullInput, config, drift, flatGround, DT)
  }
  return state
}

/** Kart at speed, then hops while steering so it lands into a drift. */
function startDrift(direction: 1 | -1 = 1): KartState {
  const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
  kart.velocity.z = 20
  return simulate(kart, { throttle: 1, jump: true, steer: direction }, 0.5)
}

/** Runs a drifting kart until the charge bar reaches `target`, or gives up after `maxSteps`. */
function chargeTo(kart: KartState, target: number, maxSteps = 600): void {
  const input = { ...NEUTRAL_INPUT, throttle: 1, jump: true, steer: 1 }
  for (let i = 0; i < maxSteps && kart.drift.charge < target; i += 1) {
    stepKart(kart, input, config, drift, flatGround, DT)
  }
}

/** Fires one nitro press and returns the resulting boost level (0 if it did not fire). */
function pressBoost(kart: KartState): number {
  const before = kart.boost.level
  stepKart(
    kart,
    { ...NEUTRAL_INPUT, throttle: 1, jump: true, steer: 1, boost: true },
    config,
    drift,
    flatGround,
    DT,
  )
  return kart.boost.level > before ? kart.boost.level : 0
}

describe('hop', () => {
  it('lifts the kart off the ground when jump is pressed', () => {
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.velocity.z = 20
    expect(kart.onGround).toBe(true)
    const hopping = simulate(kart, { throttle: 1, jump: true }, DT * 3)
    expect(hopping.onGround).toBe(false)
  })

  it('does not hop again while already drifting', () => {
    const kart = startDrift()
    expect(kart.drift.direction).toBe(1)
    simulate(kart, { throttle: 1, jump: true, steer: 1 }, DT * 2)
    // A drifting kart stays grounded through the extra jump presses
    expect(kart.drift.direction).toBe(1)
    expect(kart.drift.charge).toBeGreaterThan(0)
  })
})

describe('drift start', () => {
  it('starts a drift on landing while holding jump and steering', () => {
    const kart = startDrift(1)
    expect(kart.drift.direction).toBe(1)
    expect(kart.drift.charge).toBeGreaterThanOrEqual(0)
  })

  it('drifts left when steering left at landing', () => {
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.velocity.z = 20
    const result = simulate(kart, { throttle: 1, jump: true, steer: -1 }, 0.5)
    expect(result.drift.direction).toBe(-1)
  })

  it('does not drift without steering', () => {
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.velocity.z = 20
    const result = simulate(kart, { throttle: 1, jump: true }, 0.5)
    expect(result.drift.direction).toBe(0)
  })

  it('does not drift below the minimum speed', () => {
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.velocity.z = drift.minDriftSpeed - 1
    const result = simulate(kart, { throttle: 1, jump: true, steer: 1 }, 0.5)
    expect(result.drift.direction).toBe(0)
  })

  it('ends when jump is released', () => {
    const kart = startDrift()
    simulate(kart, { throttle: 1, steer: 1 }, 0.2)
    expect(kart.drift.direction).toBe(0)
  })
})

describe('drift charge', () => {
  it('fills the bar while drifting and stops at 1', () => {
    const kart = startDrift()
    simulate(kart, { throttle: 1, jump: true, steer: 1 }, 2)
    expect(kart.drift.charge).toBe(1)
  })

  it('reaches the red zone after the configured charge time', () => {
    const kart = startDrift()
    simulate(
      kart,
      { throttle: 1, jump: true, steer: 1 },
      drift.redZoneStart / drift.chargeRate + 0.05,
    )
    expect(kart.drift.charge).toBeGreaterThanOrEqual(drift.redZoneStart)
  })
})

describe('nitro chain', () => {
  it('fires a level 1 nitro from the red zone', () => {
    const kart = startDrift()
    chargeTo(kart, drift.redZoneStart + 0.01)
    expect(pressBoost(kart)).toBe(1)
    expect(kart.drift.nitrosInChain).toBe(1)
  })

  it('chains three nitros of increasing level, then refuses a fourth', () => {
    const kart = startDrift()
    for (let level = 1; level <= 3; level++) {
      chargeTo(kart, drift.redZoneStart + 0.01)
      expect(pressBoost(kart)).toBe(level)
    }
    expect(kart.drift.nitrosInChain).toBe(3)
    chargeTo(kart, 1)
    expect(pressBoost(kart)).toBe(0)
  })

  it('gives each level its configured speed bonus', () => {
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.velocity.z = config.maxSpeed
    kart.boost.level = 2
    kart.boost.timeLeft = 1
    simulate(kart, { throttle: 1 }, 0.5)
    const boosted = forwardSpeed(kart)
    expect(boosted).toBeGreaterThan(config.maxSpeed * (1 + drift.levels[1].speedBonus) - 0.5)
  })

  it('breaks the chain when fired before the red zone', () => {
    const kart = startDrift()
    chargeTo(kart, drift.redZoneStart - 0.1)
    pressBoost(kart)
    expect(kart.drift.chainBroken).toBe(true)
    expect(kart.drift.nitrosInChain).toBe(0)
  })

  it('breaks the chain when the bar stays full past the grace period', () => {
    const kart = startDrift()
    simulate(kart, { throttle: 1, jump: true, steer: 1 }, 2 + drift.overchargeGrace + 0.1)
    expect(kart.drift.chainBroken).toBe(true)
  })

  it('resets the chain on the next drift', () => {
    const kart = startDrift()
    chargeTo(kart, drift.redZoneStart - 0.1)
    pressBoost(kart)
    expect(kart.drift.chainBroken).toBe(true)
    const restarted = simulate(kart, { throttle: 1 }, 0.5)
    expect(startDriftAgain(restarted).drift.chainBroken).toBe(false)
  })
})

/** Ends any drift, then hops and steers to start a fresh one. */
function startDriftAgain(kart: KartState): KartState {
  simulate(kart, { throttle: 1 }, 0.5)
  return simulate(kart, { throttle: 1, jump: true, steer: 1 }, 0.5)
}

describe('boost', () => {
  it('raises the top speed above the base cap while burning', () => {
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.velocity.z = config.maxSpeed
    kart.boost.level = 1
    kart.boost.timeLeft = drift.levels[0].duration
    const before = forwardSpeed(kart)
    simulate(kart, { throttle: 1 }, 0.5)
    expect(forwardSpeed(kart)).toBeGreaterThan(before)
  })

  it('adds the perfect bonus on top of the level bonus', () => {
    const perfect = createKartState({ x: 0, y: 0, z: 0 }, 0)
    const normal = createKartState({ x: 0, y: 0, z: 0 }, 0)
    for (const [kart, perfectNitro] of [
      [perfect, true],
      [normal, false],
    ] as const) {
      kart.velocity.z = config.maxSpeed
      kart.boost.level = 1
      kart.boost.timeLeft = drift.levels[0].duration
      kart.boost.perfect = perfectNitro
      simulate(kart, { throttle: 1 }, 0.5)
    }
    expect(forwardSpeed(perfect)).toBeGreaterThan(forwardSpeed(normal))
  })

  it('counts the boost down and returns to level 0', () => {
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.boost.level = 1
    kart.boost.timeLeft = 0.3
    simulate(kart, {}, 0.5)
    expect(kart.boost.level).toBe(0)
    expect(kart.boost.timeLeft).toBe(0)
  })

  it('caps stored boost at the reserve limit', () => {
    const configOverReserve: DriftConfig = { ...drift, maxReserve: 1 }
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.boost.level = 1
    kart.boost.timeLeft = 0.9
    stepKart(
      kart,
      { ...NEUTRAL_INPUT, throttle: 1, jump: true, steer: 1, boost: true },
      config,
      configOverReserve,
      flatGround,
      DT,
    )
    expect(kart.boost.timeLeft).toBeLessThanOrEqual(configOverReserve.maxReserve)
  })
})

describe('landing boost', () => {
  it('gives a boost after a long airtime', () => {
    const kart = createKartState({ x: 0, y: 5, z: 0 }, 0)
    kart.velocity.z = 20
    kart.velocity.y = 12
    kart.onGround = false
    // Land at ~1.1 s and stop shortly after, while the boost is still burning
    simulate(kart, { throttle: 1 }, 1.2)
    expect(kart.onGround).toBe(true)
    expect(kart.boost.level).toBeGreaterThanOrEqual(1)
    expect(kart.boost.timeLeft).toBeGreaterThan(0)
  })

  it('gives no boost for a short hop', () => {
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.velocity.z = 20
    simulate(kart, { throttle: 1, jump: true }, 0.4)
    expect(kart.boost.level).toBe(0)
  })

  it('never downgrades a stronger nitro that is still burning', () => {
    const kart = createKartState({ x: 0, y: 5, z: 0 }, 0)
    kart.velocity.z = 20
    kart.velocity.y = 12
    kart.onGround = false
    kart.boost.level = 3
    kart.boost.timeLeft = drift.maxReserve
    simulate(kart, { throttle: 1 }, 1.2)
    expect(kart.boost.level).toBe(3)
  })
})

describe('drift on slopes and landings', () => {
  const slope = (x: number, z: number): number => -0.15 * z + 0 * x
  const driftInput = { ...NEUTRAL_INPUT, throttle: 1, jump: true, steer: 1 }

  it('keeps charging on a downhill slope instead of resetting', () => {
    const kart = createKartState({ x: 0, y: 0, z: 0 }, 0)
    kart.velocity.z = 20
    for (let i = 0; i < 40; i += 1) stepKart(kart, driftInput, config, drift, slope, DT)
    expect(kart.drift.direction).toBe(1)
    let previous = kart.drift.charge
    expect(previous).toBeGreaterThan(0)
    for (let i = 0; i < 40; i += 1) {
      stepKart(kart, driftInput, config, drift, slope, DT)
      expect(kart.onGround).toBe(true)
      expect(kart.drift.charge).toBeGreaterThanOrEqual(previous)
      previous = kart.drift.charge
    }
  })

  it('keeps the drift direction and charge when landing during a drift', () => {
    const kart = startDrift()
    chargeTo(kart, 0.3)
    const charge = kart.drift.charge
    kart.onGround = false
    kart.position.y = 0.01
    kart.velocity.y = -1
    stepKart(kart, driftInput, config, drift, flatGround, DT)
    expect(kart.onGround).toBe(true)
    expect(kart.drift.direction).toBe(1)
    expect(kart.drift.charge).toBe(charge)
  })
})
