import { describe, expect, it } from 'vitest'
import { createRng } from '../src/ai/random'
import { defaultItems } from '../src/config/items'
import { forwardSpeed } from '../src/sim/kart/kartPhysics'
import { createRacerItems } from '../src/sim/items/itemTypes'
import { statusModifiers } from '../src/sim/items/statusModifiers'
import { at, DT, makeItemWorld, type Inputs, type ItemWorld } from './helpers/itemWorld'

const modifiersOf = (change: (items: ReturnType<typeof createRacerItems>) => void) => {
  const items = createRacerItems()
  change(items)
  return statusModifiers(items, defaultItems)
}

describe('statusModifiers', () => {
  it('is neutral for a clean racer', () => {
    expect(modifiersOf(() => {})).toEqual({
      speedFactor: 1,
      gripFactor: 1,
      steerOffset: 0,
      noControl: false,
    })
  })

  it('adds speed per uchuva, the mask bonus and the dizzy and rain penalties', () => {
    const { speedBonusPerUchuva } = defaultItems.uchuvas
    expect(modifiersOf((i) => (i.uchuvas = 10)).speedFactor).toBeCloseTo(
      1 + 10 * speedBonusPerUchuva,
    )
    expect(modifiersOf((i) => (i.status.maskTime = 1)).speedFactor).toBeCloseTo(
      1 + defaultItems.powers.mascara.speedBonus,
    )
    expect(modifiersOf((i) => (i.status.dizzyTime = 1)).speedFactor).toBeCloseTo(
      defaultItems.hit.dizzySpeedFactor,
    )
    const rain = modifiersOf((i) => {
      i.status.rainTime = 1
    })
    expect(rain.speedFactor).toBe(1)
    expect(rain.gripFactor).toBeCloseTo(defaultItems.powers.aguacero.gripFactor)
    const slowed = modifiersOf((i) => {
      i.status.rainTime = 1
      i.status.slowed = true
    })
    expect(slowed.speedFactor).toBeCloseTo(defaultItems.powers.aguacero.chargedSpeedFactor)
  })

  it('weaves the steering only while blind and charged', () => {
    const weave = (blindTime: number, zigzag: boolean) =>
      modifiersOf((i) => {
        i.status.blindTime = blindTime
        i.status.zigzag = zigzag
      }).steerOffset
    expect(weave(1, false)).toBe(0)
    expect(weave(0, true)).toBe(0)
    const offsets = [0.1, 0.3, 0.5, 0.7, 0.9].map((t) => weave(t, true))
    expect(Math.max(...offsets)).toBeGreaterThan(0.2)
    expect(Math.min(...offsets)).toBeLessThan(-0.2)
    for (const offset of offsets) {
      expect(Math.abs(offset)).toBeLessThanOrEqual(defaultItems.powers.mosquitos.zigzagAmplitude)
    }
  })

  it('flags a hit kart as out of control', () => {
    expect(modifiersOf((i) => (i.status.hit = 'spin')).noControl).toBe(true)
  })
})

/** One kart alone at x = 50 driven with full throttle for `seconds`. */
function drive(
  setup: (world: ItemWorld) => void,
  seconds: number,
): { world: ItemWorld; top: number } {
  const world = makeItemWorld({ count: 1 })
  world.place(at(world, 0), 50)
  setup(world)
  const inputs: Inputs = new Map([[at(world, 0), { throttle: 1 }]])
  let top = 0
  for (let i = 0; i < Math.round(seconds / DT); i++) {
    world.tick(inputs, true)
    top = Math.max(top, forwardSpeed(at(world, 0).kart))
  }
  return { world, top }
}

describe('status effects on driving', () => {
  const base = drive(() => {}, 6).top

  it('lets uchuvas raise the top speed and the mask raise it more', () => {
    const rich = drive((w) => (at(w, 0).items.uchuvas = 10), 6).top
    expect(rich).toBeGreaterThan(base * 1.05)
    const masked = drive((w) => (at(w, 0).items.status.maskTime = 20), 6).top
    expect(masked).toBeGreaterThan(base * 1.15)
  })

  it('lowers the top speed while dizzy and under a charged rain', () => {
    expect(drive((w) => (at(w, 0).items.status.dizzyTime = 20), 6).top).toBeLessThan(base * 0.8)
    const slowed = drive((w) => {
      at(w, 0).items.status.rainTime = 20
      at(w, 0).items.status.slowed = true
    }, 6).top
    expect(slowed).toBeLessThan(base * 0.85)
    const plainRain = drive((w) => (at(w, 0).items.status.rainTime = 20), 6).top
    expect(plainRain).toBeCloseTo(base, 0)
  })

  it('cuts the grip under the rain, so sideways speed lingers', () => {
    const slide = (rain: boolean): number => {
      const world = makeItemWorld({ count: 1 })
      const kart = at(world, 0).kart
      world.place(at(world, 0), 50)
      kart.velocity = { x: 20, y: 0, z: 5 }
      if (rain) at(world, 0).items.status.rainTime = 5
      world.run(0.3, new Map([[at(world, 0), { throttle: 1 }]]), true)
      return Math.abs(kart.velocity.z)
    }
    expect(slide(true)).toBeGreaterThan(slide(false) * 3)
  })

  it('makes a charged-mosquito kart weave with no steering', () => {
    const headingSpread = (zigzag: boolean): number => {
      const { world } = drive((w) => {
        at(w, 0).items.status.blindTime = 20
        at(w, 0).items.status.zigzag = zigzag
      }, 0.1)
      const headings: number[] = []
      const inputs: Inputs = new Map([[at(world, 0), { throttle: 1 }]])
      for (let i = 0; i < 120; i++) {
        world.tick(inputs, true)
        headings.push(at(world, 0).kart.heading)
      }
      return Math.max(...headings) - Math.min(...headings)
    }
    expect(headingSpread(false)).toBeLessThan(0.001)
    expect(headingSpread(true)).toBeGreaterThan(0.05)
  })
})

describe('a hit kart', () => {
  it('loses control, slides to a stop, and recovers its speed afterwards', () => {
    const world = makeItemWorld({ count: 2 })
    const victim = at(world, 0)
    victim.kart.velocity.x = 22
    victim.kart.drift.direction = 1
    const inputs: Inputs = new Map([[victim, { throttle: 1, steer: 1 }]])
    world.give(at(world, 1), 'rayo')
    world.press(at(world, 1))
    expect(victim.items.status.hit).toBe('spin')
    expect(victim.items.status.spinAngle).toBeGreaterThanOrEqual(0)
    const headingAtHit = victim.kart.heading

    world.run(0.8, inputs, true)
    expect(victim.kart.drift.direction).toBe(0)
    expect(forwardSpeed(victim.kart)).toBeLessThan(6)
    expect(victim.kart.heading).toBeCloseTo(headingAtHit, 5)
    expect(victim.items.status.hit).toBe('spin')

    // The spin ends, then it is dizzy for a while, then it is back to normal
    world.run(defaultItems.hit.spinTime - 0.8 + 0.1, inputs, true)
    expect(victim.items.status.hit).toBeNull()
    expect(victim.items.status.dizzyTime).toBeGreaterThan(0)
    world.run(defaultItems.hit.dizzyTime + 0.1, new Map([[victim, { throttle: 1 }]]), true)
    expect(victim.items.status.dizzyTime).toBe(0)
    world.run(3, new Map([[victim, { throttle: 1 }]]), true)
    expect(forwardSpeed(victim.kart)).toBeGreaterThan(15)
  })

  it('is thrown into the air by a flip and lands again', () => {
    const world = makeItemWorld({ count: 2 })
    const victim = at(world, 0)
    world.give(at(world, 1), 'colibri')
    world.press(at(world, 1))
    world.run(1, undefined, true)
    expect(victim.items.status.hit).toBe('flip')
    world.run(defaultItems.hit.flipTime + 0.5, undefined, true)
    expect(victim.kart.onGround).toBe(true)
    expect(victim.items.status.hit).toBeNull()
  })

  it('spins the view over spinTurns full turns', () => {
    const world = makeItemWorld({ count: 2 })
    world.give(at(world, 1), 'rayo')
    world.press(at(world, 1))
    const angles: number[] = []
    for (let i = 0; i < 60; i++) {
      world.tick()
      angles.push(at(world, 0).items.status.spinAngle)
    }
    expect(Math.max(...angles)).toBeGreaterThan(Math.PI * 2)
    expect(Math.max(...angles)).toBeLessThanOrEqual(Math.PI * 2 * defaultItems.hit.spinTurns)
    expect(angles.every((angle, i) => i === 0 || angle >= (angles[i - 1] ?? 0))).toBe(true)
  })

  it('somersaults the view once during a flip', () => {
    const world = makeItemWorld({ count: 2 })
    const victim = at(world, 0)
    world.tick()
    victim.items.status.hit = 'flip'
    victim.items.status.hitTime = defaultItems.hit.flipTime
    world.run(defaultItems.hit.flipTime / 2)
    expect(victim.items.status.spinAngle).toBeGreaterThan(Math.PI / 2)
    expect(victim.items.status.spinAngle).toBeLessThanOrEqual(Math.PI * 2)
  })
})

describe('determinism', () => {
  const snapshot = (seed: number): string => {
    const world = makeItemWorld({
      count: 6,
      seed,
      boxes: [
        { x: 900, z: -3 },
        { x: 900, z: 3 },
        { x: 1000, z: 0 },
        { x: 1100, z: -4 },
      ],
      uchuvas: [850, 870, 890, 1050].map((x) => ({ x, z: 0 })),
    })
    const rng = createRng(77)
    for (let i = 0; i < 60 * 20; i++) {
      const inputs: Inputs = new Map(
        world.racers.map((racer) => [
          racer,
          { throttle: 1, useItem: rng() < 0.08, lookBack: rng() < 0.2 },
        ]),
      )
      world.tick(inputs, true)
    }
    return JSON.stringify({
      log: world.log,
      entities: world.system.entities,
      items: world.racers.map((racer) => racer.items),
      positions: world.racers.map((racer) => racer.kart.position),
    })
  }

  it('gives the same result for the same seed', () => {
    const first = snapshot(5)
    expect(snapshot(5)).toBe(first)
    expect(JSON.parse(first).log.length).toBeGreaterThan(5)
  })

  it('gives another result for another seed', () => {
    expect(snapshot(6)).not.toBe(snapshot(5))
  })
})
