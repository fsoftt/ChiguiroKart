import { describe, expect, it } from 'vitest'
import { RacingBot } from '../src/ai/racingBot'
import { branchBlocked } from '../src/ai/obstacles'
import { botDifficulties } from '../src/config/bots'
import { defaultDrift } from '../src/config/drift'
import { defaultItems } from '../src/config/items'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { NEUTRAL_INPUT } from '../src/input/kartInput'
import { BotManager } from '../src/sim/botManager'
import type { HazardObstacle } from '../src/sim/hazards/hazardTypes'
import { ItemSystem } from '../src/sim/items/itemSystem'
import type { HazardDefinition, TideRule } from '../src/sim/track'
import { buildTrackDefinition, type TrackData } from '../src/sim/trackData'
import { RaceWorld } from '../src/sim/world'
import { DT, rubberBandOff } from './helpers/botSim'

/** A 300 x 150 m rounded rectangle with a detour branch on its bottom side. */
function ovalData(hazards: HazardDefinition[], tide?: TideRule): TrackData {
  return {
    version: 1,
    name: 'Óvalo de prueba',
    halfWidth: 10,
    samplesPerSegment: 12,
    points: [
      { x: 60, z: 0, y: 0 },
      { x: 240, z: 0, y: 0 },
      { x: 300, z: 40, y: 0 },
      { x: 300, z: 110, y: 0 },
      { x: 240, z: 150, y: 0 },
      { x: 60, z: 150, y: 0 },
      { x: 0, z: 110, y: 0 },
      { x: 0, z: 40, y: 0 },
    ],
    branches: [
      {
        name: 'Atajo',
        points: [
          { x: 100, z: 0 },
          { x: 130, z: -22 },
          { x: 170, z: -22 },
          { x: 200, z: 0 },
        ],
        halfWidth: 8,
        surface: 'sand',
        ...(tide ? { tide } : {}),
      },
    ],
    checkpoints: { count: 8, optional: [] },
    itemBoxRows: [],
    uchuvaLines: [],
    hazards,
  }
}

const WALL: HazardDefinition = {
  kind: 'iceWall',
  path: [{ x: 150, z: -22 }],
  motion: 'loop',
  speed: 0,
  count: 1,
  radius: 4,
}

const HERD: HazardDefinition = {
  kind: 'herd',
  path: [
    { x: 150, z: 130 },
    { x: 150, z: 170 },
  ],
  motion: 'pingPong',
  speed: 8,
  count: 3,
  radius: 2,
  pause: 1,
}

interface RunResult {
  finished: boolean
  lapTimes: number[]
  hits: number
  branchSteps: number
  respawns: number
  totalTime: number
}

/** One bot alone on the oval with the hazards running (the player sits parked on the grid). */
function drive(
  hazards: HazardDefinition[],
  options: {
    tide?: TideRule
    laps?: number
    chance?: number
    holdNitro?: boolean
  } = {},
): RunResult {
  const laps = options.laps ?? 2
  const world = new RaceWorld(
    buildTrackDefinition(ovalData(hazards, options.tide)),
    defaultKartPhysics,
    defaultDrift,
    { totalLaps: laps, countdownSeconds: 0.5 },
  )
  const items = new ItemSystem(
    world.track,
    defaultItems,
    1,
    defaultDrift,
    false,
    defaultKartPhysics,
  )
  world.obstacles = () => items.hazards.obstacles
  const manager = new BotManager(world, defaultKartPhysics, defaultDrift, {
    rubberBand: rubberBandOff,
  })
  const skill = { ...botDifficulties.normal, shortcutChance: options.chance ?? 1 }
  manager.addBot(new RacingBot({ skill, seed: 3 }), 'jaguar')
  const racer = manager.getBotRacers()[0]
  if (!racer) throw new Error('no bot')

  const result: RunResult = {
    finished: false,
    lapTimes: [],
    hits: 0,
    branchSteps: 0,
    respawns: 0,
    totalTime: 0,
  }
  let previous = { ...racer.kart.position }
  for (let step = 0; step < Math.ceil(400 / DT); step++) {
    if (options.holdNitro) {
      racer.kart.boost.level = 3
      racer.kart.boost.timeLeft = 2
    }
    world.step({ ...NEUTRAL_INPUT }, DT)
    manager.update(DT)
    manager.resolveCollisions()
    items.update(
      manager.allRacers().map((r) => ({ racer: r, input: { ...NEUTRAL_INPUT } })),
      DT,
    )
    for (const event of items.drainEvents()) {
      if (event.type === 'hit' && event.slot === racer.slot) result.hits++
    }
    const { x, z } = racer.kart.position
    const projection = world.track.project(x, z)
    if (projection.branch >= 0 && projection.distance <= projection.halfWidth) result.branchSteps++
    if (Math.hypot(x - previous.x, z - previous.z) > 3) result.respawns++
    previous = { x, y: 0, z }
    if (racer.race.state.phase === 'finished') {
      result.finished = true
      break
    }
  }
  result.lapTimes = [...racer.race.state.lapTimes]
  result.totalTime = racer.race.state.totalRaceTime
  return result
}

function wallObstacle(active: boolean): HazardObstacle {
  return {
    hazard: 0,
    kind: 'iceWall',
    position: { x: 150, y: 0, z: -22 },
    heading: 0,
    radius: 4,
    active,
    moving: false,
  }
}

describe('branchBlocked', () => {
  const branch = buildTrackDefinition(ovalData([])).branches?.[0]
  if (!branch) throw new Error('fixture')

  it('is blocked only by an active ice wall on the branch', () => {
    expect(branchBlocked(branch, [wallObstacle(true)])).toBe(true)
    expect(branchBlocked(branch, [wallObstacle(false)])).toBe(false)
    expect(branchBlocked(branch, [])).toBe(false)
    expect(branchBlocked(branch, [{ ...wallObstacle(true), kind: 'rock' }])).toBe(false)
    const far: HazardObstacle = { ...wallObstacle(true), position: { x: 150, y: 0, z: 100 } }
    expect(branchBlocked(branch, [far])).toBe(false)
  })

  it('counts a wall at the entrance of the branch', () => {
    const entrance: HazardObstacle = { ...wallObstacle(true), position: { x: 100, y: 0, z: 6 } }
    expect(branchBlocked(branch, [entrance])).toBe(true)
  })
})

describe('bots with track hazards', () => {
  it('completes laps through a crossing herd without getting stuck', () => {
    const result = drive([HERD], { chance: 0 })
    expect(result.finished).toBe(true)
    expect(result.lapTimes).toHaveLength(2)
    expect(result.respawns).toBe(0)
    // Ideal lap is about 12 s per 100 m at top speed; a stuck bot would take far longer
    expect(result.totalTime).toBeLessThan(120)
  })

  it('is deterministic with hazards running', () => {
    const a = drive([HERD], { chance: 0, laps: 1 })
    const b = drive([HERD], { chance: 0, laps: 1 })
    expect(a).toEqual(b)
  })

  it('takes the shortcut when it is open', () => {
    const result = drive([], { laps: 1 })
    expect(result.finished).toBe(true)
    expect(result.branchSteps).toBeGreaterThan(30)
  })

  it('skips a branch closed by an ice wall', () => {
    const result = drive([WALL], { laps: 1 })
    expect(result.finished).toBe(true)
    expect(result.branchSteps).toBe(0)
    expect(result.respawns).toBe(0)
  })

  it('goes through the ice wall branch with a level 3 nitro burning', () => {
    const result = drive([WALL], {
      laps: 1,
      holdNitro: true,
    })
    expect(result.branchSteps).toBeGreaterThan(30)
  })

  it('takes a tidal branch only at low tide', () => {
    const rule = (lowLaps: number[]): TideRule => ({
      lowLaps,
      lowSurface: 'sand',
      highSurface: 'water',
    })
    expect(drive([], { laps: 1, tide: rule([1]) }).branchSteps).toBeGreaterThan(30)
    expect(drive([], { laps: 1, tide: rule([2]) }).branchSteps).toBe(0)
  })
})
