import { describe, expect, it } from 'vitest'
import { createRng } from '../src/ai/random'
import { defaultItems } from '../src/config/items'
import { cocoraTrack } from '../src/config/tracks/cocoraTrack'
import { testTrack } from '../src/config/tracks/testTrack'
import { bandFor, pickPower, usesFor } from '../src/sim/items/distribution'
import { POWER_IDS, type PowerId } from '../src/sim/items/itemTypes'
import { Track } from '../src/sim/track'
import { at, DT, makeItemWorld, withItems } from './helpers/itemWorld'

const box = { x: 300, z: 0 }
const uchuva = { x: 320, z: 0 }

describe('track pickup data', () => {
  it('puts every Cocora box and uchuva on drivable road, away from the jump ramp', () => {
    const track = new Track(cocoraTrack)
    expect(track.itemBoxes.length).toBeGreaterThanOrEqual(12)
    expect(track.uchuvas.length).toBeGreaterThanOrEqual(25)
    for (const spot of [...track.itemBoxes, ...track.uchuvas]) {
      const projection = track.project(spot.x, spot.z)
      expect(projection.distance).toBeLessThan(projection.halfWidth - 1.5)
      expect(projection.branch).toBe(-1)
    }
  })

  it('keeps Cocora pickups apart and off the wax palm ramp', () => {
    const track = new Track(cocoraTrack)
    const spots = [...track.itemBoxes, ...track.uchuvas]
    spots.forEach((a, i) => {
      for (const b of spots.slice(i + 1))
        expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThan(2)
      const ramp = track.point(154)
      expect(Math.hypot(a.x - ramp.x, a.z - ramp.z)).toBeGreaterThan(20)
    })
  })

  it('exposes pickups on the test track and none by default', () => {
    expect(new Track(testTrack).itemBoxes.length).toBeGreaterThanOrEqual(4)
    expect(new Track(testTrack).uchuvas.length).toBeGreaterThan(0)
    const bare = new Track({
      name: testTrack.name,
      centerline: testTrack.centerline,
      halfWidth: testTrack.halfWidth,
    })
    expect(bare.itemBoxes).toEqual([])
    expect(bare.uchuvas).toEqual([])
  })

  it('lifts pickups above the ground', () => {
    const world = makeItemWorld({ boxes: [box], uchuvas: [uchuva] })
    expect(world.system.boxes[0]?.position.y).toBeCloseTo(defaultItems.boxes.lift)
    expect(world.system.uchuvas[0]?.position.y).toBeCloseTo(defaultItems.uchuvas.lift)
  })
})

describe('power distribution by position', () => {
  const total = 8
  const draw = (rank: number, samples: number, seed = 3): Map<PowerId, number> => {
    const rng = createRng(seed)
    const counts = new Map<PowerId, number>()
    for (let i = 0; i < samples; i++) {
      const power = pickPower(defaultItems, rank, total, rng)
      counts.set(power, (counts.get(power) ?? 0) + 1)
    }
    return counts
  }

  it('never gives the leader a back-of-the-pack power, and gives the last place only those', () => {
    const [front, , back] = defaultItems.distribution
    const frontPowers = Object.keys(front?.weights ?? {})
    const backPowers = Object.keys(back?.weights ?? {})
    const leader = draw(1, 4000)
    for (const power of leader.keys()) expect(frontPowers).toContain(power)
    for (const power of backPowers.filter((p) => !frontPowers.includes(p))) {
      expect(leader.has(power as PowerId)).toBe(false)
    }
    const last = draw(8, 4000)
    for (const power of last.keys()) expect(backPowers).toContain(power)
    expect(last.has('colibri')).toBe(true)
    expect(last.has('rayo')).toBe(true)
  })

  it('uses the band that matches the rank fraction', () => {
    expect(bandFor(defaultItems, 1, 8)).toBe(defaultItems.distribution[0])
    expect(bandFor(defaultItems, 2, 8)).toBe(defaultItems.distribution[0])
    expect(bandFor(defaultItems, 3, 8)).toBe(defaultItems.distribution[1])
    expect(bandFor(defaultItems, 5, 8)).toBe(defaultItems.distribution[1])
    expect(bandFor(defaultItems, 6, 8)).toBe(defaultItems.distribution[2])
    expect(bandFor(defaultItems, 8, 8)).toBe(defaultItems.distribution[2])
    expect(bandFor(defaultItems, 1, 1)).toBe(defaultItems.distribution[0])
  })

  it('follows the weights statistically with a seeded RNG', () => {
    const samples = 30000
    for (const [rank, bandIndex] of [
      [1, 0],
      [4, 1],
      [7, 2],
    ] as const) {
      const weights = defaultItems.distribution[bandIndex]?.weights ?? {}
      const sum = Object.values(weights).reduce((a, b) => a + b, 0)
      const counts = draw(rank, samples)
      for (const power of POWER_IDS) {
        const expected = (weights[power] ?? 0) / sum
        expect((counts.get(power) ?? 0) / samples).toBeCloseTo(expected, 1)
        expect(Math.abs((counts.get(power) ?? 0) / samples - expected)).toBeLessThan(0.015)
      }
    }
  })

  it('replays the same sequence from the same seed', () => {
    expect([...draw(5, 200, 9)]).toEqual([...draw(5, 200, 9)])
  })

  it('gives 3 mangos and 2 tejos when charged, one use otherwise', () => {
    expect(usesFor(defaultItems, 'mango', true)).toBe(3)
    expect(usesFor(defaultItems, 'mango', false)).toBe(1)
    expect(usesFor(defaultItems, 'tejo', true)).toBe(2)
    expect(usesFor(defaultItems, 'tejo', false)).toBe(1)
    expect(usesFor(defaultItems, 'coco', true)).toBe(1)
  })
})

describe('boxes and the roulette', () => {
  it('breaks the box, spins the roulette and then gives a power', () => {
    const world = makeItemWorld({ boxes: [box] })
    const racer = at(world, 3)
    world.place(racer, box.x)
    world.tick()
    expect(world.system.boxes[0]?.active).toBe(false)
    expect(world.eventsOf('boxTaken')).toHaveLength(1)
    expect(racer.items.slot.power).toBeNull()
    expect(racer.items.slot.rouletteTime).toBeGreaterThan(0)

    const seen = new Set<PowerId | null>()
    const steps = Math.ceil(defaultItems.boxes.rouletteTime / DT) - 3
    for (let i = 0; i < steps; i++) {
      world.tick()
      seen.add(racer.items.slot.rouletteShowing)
    }
    expect(racer.items.slot.power).toBeNull()
    expect(seen.size).toBeGreaterThan(3)

    world.run(0.2)
    expect(racer.items.slot.power).not.toBeNull()
    expect(racer.items.slot.uses).toBeGreaterThan(0)
    expect(racer.items.slot.rouletteTime).toBe(0)
    expect(racer.items.slot.charged).toBe(false)
  })

  it('changes the displayed power once per tick period', () => {
    const world = makeItemWorld({
      boxes: [box],
      config: withItems({ boxes: { rouletteTick: 0.5 } }),
    })
    const racer = at(world, 3)
    world.place(racer, box.x)
    world.tick()
    const shown: (PowerId | null)[] = []
    for (let i = 0; i < 60; i++) {
      world.tick()
      shown.push(racer.items.slot.rouletteShowing)
    }
    // At 0.5 s per tick, a second of spinning shows at most 3 distinct runs
    const runs = shown.filter((power, i) => i === 0 || power !== shown[i - 1]).length
    expect(runs).toBeLessThanOrEqual(3)
  })

  it('rolls the power by the position of the racer when the roulette ends', () => {
    const leaderPowers = new Set<PowerId>()
    const lastPowers = new Set<PowerId>()
    for (let seed = 1; seed <= 40; seed++) {
      // One box ahead of the field for the leader, one far behind it for the last kart
      const world = makeItemWorld({
        boxes: [
          { x: 900, z: 0 },
          { x: 100, z: 0 },
        ],
        seed,
        count: 8,
      })
      const leader = at(world, 0)
      const last = at(world, 7)
      world.place(leader, 900)
      world.place(last, 100)
      world.run(2)
      if (leader.items.slot.power) leaderPowers.add(leader.items.slot.power)
      if (last.items.slot.power) lastPowers.add(last.items.slot.power)
    }
    expect(leaderPowers.has('colibri')).toBe(false)
    expect(leaderPowers.has('rayo')).toBe(false)
    expect(
      [...lastPowers].some((p) => ['colibri', 'rayo', 'aguacero', 'mosquitos'].includes(p)),
    ).toBe(true)
  })

  it('marks the power as charged with the full uchuva count at roll time', () => {
    const world = makeItemWorld({ boxes: [box] })
    const racer = at(world, 3)
    racer.items.uchuvas = defaultItems.uchuvas.max - 1
    world.place(racer, box.x)
    world.run(2)
    expect(racer.items.uchuvas).toBe(defaultItems.uchuvas.max)
    expect(racer.items.slot.charged).toBe(true)
  })

  it('breaks the box but keeps the held power when the slot is full', () => {
    const world = makeItemWorld({ boxes: [box] })
    const racer = at(world, 3)
    world.give(racer, 'panela')
    world.place(racer, box.x)
    world.tick()
    expect(world.system.boxes[0]?.active).toBe(false)
    expect(racer.items.slot.power).toBe('panela')
    expect(racer.items.slot.rouletteTime).toBe(0)
    expect(racer.items.uchuvas).toBe(defaultItems.uchuvas.perBox)
  })

  it('brings the box back after its respawn time', () => {
    const world = makeItemWorld({ boxes: [box] })
    const racer = at(world, 3)
    world.place(racer, box.x)
    world.tick()
    world.place(racer, 700)
    world.run(defaultItems.boxes.respawnTime - 0.2)
    expect(world.system.boxes[0]?.active).toBe(false)
    world.run(0.4)
    expect(world.system.boxes[0]?.active).toBe(true)
    expect(world.system.boxes[0]?.respawnTime).toBe(0)
  })

  it('does not give boxes to karts that are not racing', () => {
    const world = makeItemWorld({ boxes: [box], uchuvas: [uchuva] })
    const racer = at(world, 3)
    racer.race.state.phase = 'countdown'
    world.place(racer, box.x)
    world.tick()
    world.place(racer, uchuva.x)
    world.tick()
    expect(world.system.boxes[0]?.active).toBe(true)
    expect(world.system.uchuvas[0]?.active).toBe(true)
    expect(racer.items.uchuvas).toBe(0)
  })
})

describe('uchuvas', () => {
  it('are picked up, respawn, and stop at the cap', () => {
    const world = makeItemWorld({ uchuvas: [uchuva, { x: 330, z: 0 }] })
    const racer = at(world, 3)
    world.place(racer, uchuva.x)
    world.tick()
    expect(racer.items.uchuvas).toBe(1)
    expect(world.eventsOf('uchuvaTaken')).toHaveLength(1)
    expect(world.system.uchuvas[0]?.active).toBe(false)

    world.place(racer, 700)
    world.run(defaultItems.uchuvas.respawnTime + 0.2)
    expect(world.system.uchuvas[0]?.active).toBe(true)

    racer.items.uchuvas = defaultItems.uchuvas.max
    world.place(racer, 330)
    world.tick()
    expect(racer.items.uchuvas).toBe(defaultItems.uchuvas.max)
    expect(world.system.uchuvas[1]?.active).toBe(true)
  })

  it('reset brings every pickup back and clears events', () => {
    const world = makeItemWorld({ boxes: [box], uchuvas: [uchuva] })
    const racer = at(world, 3)
    world.place(racer, box.x)
    world.tick()
    world.place(racer, uchuva.x)
    world.tick()
    world.system.reset()
    expect(world.system.boxes.every((pickup) => pickup.active)).toBe(true)
    expect(world.system.uchuvas.every((pickup) => pickup.active)).toBe(true)
    expect(world.system.drainEvents()).toEqual([])
  })
})
