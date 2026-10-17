import { describe, expect, it } from 'vitest'
import { defaultDrift } from '../src/config/drift'
import { defaultHazards } from '../src/config/hazards'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { NEUTRAL_INPUT } from '../src/input/kartInput'
import { ignoresSurface } from '../src/sim/characters'
import { buildPath, hazardMotion } from '../src/sim/hazards/hazardSystem'
import { applyBoostPads, insidePad } from '../src/sim/hazards/boostPads'
import { createKartState } from '../src/sim/kart/kartState'
import { createRacer, stepRacer } from '../src/sim/racer'
import type { HazardDefinition } from '../src/sim/track'
import { DT, makeHazardWorld, straightTrack } from './helpers/hazardWorld'

const PAD = { position: { x: 800, z: 0 }, heading: Math.PI / 2, length: 6, width: 4 }

function rock(x: number, radius = 2): HazardDefinition {
  return { kind: 'rock', path: [{ x, z: 0 }], motion: 'loop', speed: 0, count: 1, radius }
}

describe('boost pads', () => {
  it('detects points inside the oriented rectangle', () => {
    expect(insidePad(PAD, { x: 802.9, z: 1.9 })).toBe(true)
    expect(insidePad(PAD, { x: 803.1, z: 0 })).toBe(false)
    expect(insidePad(PAD, { x: 800, z: 2.1 })).toBe(false)
    // Rotated a quarter turn: length now runs along z
    const turned = { ...PAD, heading: 0 }
    expect(insidePad(turned, { x: 801.9, z: 2.9 })).toBe(true)
    expect(insidePad(turned, { x: 803, z: 0 })).toBe(false)
  })

  it('gives a short level 1 nitro to a kart on the ground, refreshing instead of stacking', () => {
    const track = straightTrack({ boostPads: [PAD] })
    const kart = createKartState({ x: 800, y: 0, z: 0 }, Math.PI / 2)
    expect(applyBoostPads(kart, track, defaultDrift, defaultHazards)).toBe(true)
    expect(kart.boost.level).toBe(1)
    expect(kart.boost.timeLeft).toBeCloseTo(defaultHazards.pad.boostDuration)
    kart.boost.timeLeft = 0.3
    applyBoostPads(kart, track, defaultDrift, defaultHazards)
    expect(kart.boost.timeLeft).toBeCloseTo(defaultHazards.pad.boostDuration)
    kart.boost.level = 3
    kart.boost.timeLeft = 0.1
    applyBoostPads(kart, track, defaultDrift, defaultHazards)
    expect(kart.boost.level).toBe(3)
  })

  it('skips karts in the air or off the pad', () => {
    const track = straightTrack({ boostPads: [PAD] })
    const air = createKartState({ x: 800, y: 3, z: 0 }, Math.PI / 2)
    air.onGround = false
    expect(applyBoostPads(air, track, defaultDrift, defaultHazards)).toBe(false)
    const off = createKartState({ x: 700, y: 0, z: 0 }, Math.PI / 2)
    expect(applyBoostPads(off, track, defaultDrift, defaultHazards)).toBe(false)
    expect(off.boost.level).toBe(0)
  })

  it('boosts through stepRacer, the same pipeline for player and bots', () => {
    const track = straightTrack({ boostPads: [PAD] })
    const world = makeHazardWorld(track, [800, 700])
    world.run(0.1, { throttle: 1 }, true)
    const [onPad, off] = world.racers
    expect(onPad?.kart.boost.level).toBe(1)
    expect(off?.kart.boost.level).toBe(0)
    // Parked on the grid during the countdown: no boost
    const racer = createRacer(track, { totalLaps: 3, countdownSeconds: 3 })
    racer.kart.position = { x: 800, y: 0, z: 0 }
    stepRacer(racer, NEUTRAL_INPUT, track, defaultKartPhysics, defaultDrift, DT)
    expect(racer.race.state.phase).toBe('countdown')
    expect(racer.kart.boost.level).toBe(0)
  })
})

describe('tide', () => {
  const tidal = straightTrack({
    branches: [
      {
        name: 'Banco',
        points: [
          { x: 500, z: 30 },
          { x: 900, z: 30 },
        ],
        halfWidth: 5,
        surface: 'sand',
        tide: { lowLaps: [2], lowSurface: 'sand', highSurface: 'water' },
      },
    ],
  })

  it("follows the leader's lap and the surface follows the tide", () => {
    const world = makeHazardWorld(tidal, [800, 700])
    const [leader, second] = world.racers
    if (!leader || !second) throw new Error('fixture')
    world.tick()
    expect(tidal.tideLow).toBe(false)
    expect(tidal.surfaceAt(700, 30)).toBe('water')
    // Only the leader reaches lap 2: the tide follows it
    leader.race.state.currentLap = 2
    world.tick()
    expect(tidal.tideLow).toBe(true)
    expect(tidal.surfaceAt(700, 30)).toBe('sand')
    leader.race.state.currentLap = 3
    world.tick()
    expect(tidal.surfaceAt(700, 30)).toBe('water')
    // The main road is not tidal
    expect(tidal.surfaceAt(700, 0)).toBe('asphalt')
  })

  it('ignores racers that are not racing and resets to lap 1', () => {
    const world = makeHazardWorld(tidal, [800])
    const racer = world.racers[0]
    if (!racer) throw new Error('fixture')
    racer.race.state.currentLap = 2
    racer.race.state.phase = 'finished'
    world.tick()
    expect(tidal.tideLow).toBe(false)
    racer.race.state.phase = 'racing'
    world.tick()
    expect(tidal.tideLow).toBe(true)
    world.system.reset()
    expect(tidal.tideLow).toBe(false)
  })

  it('lets the Delfín ignore water', () => {
    expect(ignoresSurface('delfin', 'water')).toBe(true)
    expect(ignoresSurface('delfin', 'mud')).toBe(true)
    expect(ignoresSurface('delfin', 'ice')).toBe(false)
    expect(ignoresSurface('jaguar', 'water')).toBe(false)
  })
})

describe('hazard motion', () => {
  const square: HazardDefinition = {
    kind: 'float',
    path: [
      { x: 0, z: 0 },
      { x: 100, z: 0 },
      { x: 100, z: 100 },
      { x: 0, z: 100 },
    ],
    motion: 'loop',
    speed: 10,
    count: 2,
    radius: 3,
  }

  it('runs a loop around the closed path, evenly spaced, and comes back after one lap', () => {
    const path = buildPath(square)
    expect(path.total).toBeCloseTo(400)
    const a = hazardMotion(square, path, 0, 5)
    expect(a.x).toBeCloseTo(50)
    expect(a.z).toBeCloseTo(0)
    expect(a.moving).toBe(true)
    // The second one is half a lap ahead
    const b = hazardMotion(square, path, 1, 5)
    expect(b.x).toBeCloseTo(50)
    expect(b.z).toBeCloseTo(100)
    // Back to the start after 40 s, and the closing segment is walked back to the first point
    expect(hazardMotion(square, path, 0, 40).x).toBeCloseTo(0)
    const closing = hazardMotion(square, path, 0, 35)
    expect(closing.x).toBeCloseTo(0)
    expect(closing.z).toBeCloseTo(50)
  })

  const ping: HazardDefinition = {
    kind: 'herd',
    path: [
      { x: 0, z: 0 },
      { x: 0, z: 40 },
    ],
    motion: 'pingPong',
    speed: 10,
    count: 1,
    radius: 1,
    pause: 2,
  }

  it('goes back and forth, waiting at each end', () => {
    const path = buildPath(ping)
    const at = (t: number) => hazardMotion(ping, path, 0, t)
    expect(at(3).z).toBeCloseTo(30)
    expect(at(3).moving).toBe(true)
    // Paused at the far end from 4 s to 6 s
    expect(at(5).z).toBeCloseTo(40)
    expect(at(5).moving).toBe(false)
    // Coming back, facing the other way
    expect(at(7).z).toBeCloseTo(30)
    expect(at(7).heading).toBeCloseTo(at(3).heading + Math.PI)
    // Paused at the start from 10 s to 12 s, then off again
    expect(at(11).z).toBeCloseTo(0)
    expect(at(11).moving).toBe(false)
    expect(at(13).z).toBeCloseTo(10)
  })

  it('keeps the obstacles still until the race leaves the countdown', () => {
    const track = straightTrack({
      hazards: [
        {
          ...ping,
          path: [
            { x: 800, z: -20 },
            { x: 800, z: 20 },
          ],
        },
      ],
    })
    const world = makeHazardWorld(track, [500])
    const racer = world.racers[0]
    if (!racer) throw new Error('fixture')
    racer.race.state.phase = 'countdown'
    world.run(1)
    const obstacle = world.system.hazards.obstacles[0]
    expect(obstacle?.position.z).toBeCloseTo(-20)
    expect(obstacle?.moving).toBe(false)
    racer.race.state.phase = 'racing'
    world.run(1)
    expect(obstacle?.position.z).toBeCloseTo(-10, 0)
    expect(obstacle?.moving).toBe(true)
    expect(obstacle?.position.y).toBe(0)
    world.system.reset()
    expect(world.system.hazards.time).toBe(0)
    expect(obstacle?.position.z).toBeCloseTo(-20)
  })
})

describe('hazard contacts', () => {
  it('spins a kart that touches the herd through the single hit rule', () => {
    const track = straightTrack({ hazards: [{ ...rock(800), kind: 'herd' }] })
    const world = makeHazardWorld(track, [800])
    world.tick()
    const racer = world.racers[0]
    expect(racer?.items.status.hit).toBe('spin')
    expect(world.eventsOf('hit')).toHaveLength(1)
    // Invulnerability keeps the same herd from hitting again at once
    world.run(0.5)
    expect(world.eventsOf('hit')).toHaveLength(1)
  })

  it('lets a shield absorb the herd like any other hit', () => {
    const track = straightTrack({ hazards: [{ ...rock(800), kind: 'herd' }] })
    const world = makeHazardWorld(track, [800])
    const racer = world.racers[0]
    if (!racer) throw new Error('fixture')
    racer.items.status.shieldHits = 1
    racer.items.status.shieldTime = 5
    world.tick()
    expect(racer.items.status.hit).toBeNull()
    expect(world.eventsOf('blocked')).toHaveLength(1)
  })

  it('bumps a kart out of a rock and bounces its speed', () => {
    const track = straightTrack({ hazards: [rock(805)] })
    const world = makeHazardWorld(track, [802.5])
    const racer = world.racers[0]
    if (!racer) throw new Error('fixture')
    racer.kart.velocity.x = 20
    world.tick()
    const reach = 2 + defaultKartPhysics.kartRadius
    expect(805 - racer.kart.position.x).toBeGreaterThanOrEqual(reach - 1e-6)
    expect(racer.kart.velocity.x).toBeCloseTo(-20 * defaultKartPhysics.wallBounce)
    expect(world.eventsOf('hazardBump')).toHaveLength(1)
    expect(racer.items.status.hit).toBeNull()
  })

  it('does not touch a kart that jumps over the obstacle', () => {
    const track = straightTrack({ hazards: [rock(805)] })
    const world = makeHazardWorld(track, [805])
    const racer = world.racers[0]
    if (!racer) throw new Error('fixture')
    racer.kart.position.y = 10
    world.tick()
    expect(racer.kart.position.x).toBe(805)
  })

  const wall: HazardDefinition = { ...rock(805, 3), kind: 'iceWall' }

  it('breaks the ice wall with a level 3 nitro and closes it again after a while', () => {
    const track = straightTrack({ hazards: [wall] })
    const world = makeHazardWorld(track, [802])
    const racer = world.racers[0]
    if (!racer) throw new Error('fixture')
    const obstacle = world.system.hazards.obstacles[0]
    racer.kart.boost.level = 3
    racer.kart.boost.timeLeft = 2
    racer.kart.velocity.x = 20
    world.tick()
    expect(obstacle?.active).toBe(false)
    expect(world.eventsOf('iceWallBroken')).toHaveLength(1)
    // No bump: the kart goes through
    expect(racer.kart.velocity.x).toBe(20)
    racer.kart.position.x = 900
    world.run(defaultHazards.obstacle.iceWallRespawn - 0.5)
    expect(obstacle?.active).toBe(false)
    world.run(1)
    expect(obstacle?.active).toBe(true)
    expect(world.eventsOf('iceWallRestored')).toHaveLength(1)
  })

  it('waits to close while a kart stands where the wall was', () => {
    const track = straightTrack({ hazards: [wall] })
    const world = makeHazardWorld(track, [805])
    const racer = world.racers[0]
    if (!racer) throw new Error('fixture')
    const obstacle = world.system.hazards.obstacles[0]
    racer.kart.boost.level = 3
    racer.kart.boost.timeLeft = 0.01
    world.tick()
    expect(obstacle?.active).toBe(false)
    racer.kart.boost.level = 0
    world.run(defaultHazards.obstacle.iceWallRespawn + 1)
    expect(obstacle?.active).toBe(false)
    racer.kart.position.x = 900
    world.tick()
    expect(obstacle?.active).toBe(true)
  })

  it('bumps instead of breaking with a lower nitro or an expired one', () => {
    const track = straightTrack({ hazards: [wall] })
    for (const [level, timeLeft] of [
      [2, 2],
      [3, 0],
    ] as const) {
      const world = makeHazardWorld(track, [802])
      const racer = world.racers[0]
      if (!racer) throw new Error('fixture')
      racer.kart.boost.level = level
      racer.kart.boost.timeLeft = timeLeft
      racer.kart.velocity.x = 20
      world.tick()
      expect(world.system.hazards.obstacles[0]?.active).toBe(true)
      expect(racer.kart.velocity.x).toBeLessThan(0)
    }
  })
})
