import { describe, expect, it } from 'vitest'
import { RacingBot } from '../src/ai/racingBot'
import { botDifficulties } from '../src/config/bots'
import { defaultDrift } from '../src/config/drift'
import { defaultItems } from '../src/config/items'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { tracks, type TrackId } from '../src/config/tracks/catalog'
import { createRng } from '../src/ai/random'
import { NEUTRAL_INPUT } from '../src/input/kartInput'
import { BotManager } from '../src/sim/botManager'
import { ItemSystem } from '../src/sim/items/itemSystem'
import type { ItemEvent } from '../src/sim/items/itemTypes'
import { RaceWorld } from '../src/sim/world'
import { DT } from './helpers/botSim'

const MAX_SECONDS = 240
/** A kart that moves less than STUCK_METERS in STUCK_SECONDS while racing counts as stuck. */
const STUCK_SECONDS = 8
const STUCK_METERS = 3
const MAX_RESPAWNS_PER_KART = 2

interface Outcome {
  allFinished: boolean
  badPositions: number
  finishTimes: number[]
  respawns: number[]
  /** Longest time (s) a racing kart stayed within STUCK_METERS of a point. */
  longestStall: number
  /** Total path travelled by the farthest-moving obstacle (m). */
  obstacleTravel: number
  hits: number
  wallBroken: number
  /** Kart-steps spent touching an ice wall. */
  wallContacts: number
  /** Bot-steps on a shortcut branch. */
  branchSteps: number
  /** Per-lap flags: did a bot ever drive on a tidal branch while the tide was low/high. */
  tideBranchLow: number
  tideBranchHigh: number
  tideFlips: number
  events: Record<string, number>
}

/** Eight karts on a track (the player driven by a bot too) with powers and hazards running. */
function raceTrack(id: TrackId, laps: number, seed = 1): Outcome {
  const world = new RaceWorld(tracks[id].build(), defaultKartPhysics, defaultDrift, {
    totalLaps: laps,
    countdownSeconds: 3,
  })
  const track = world.track
  const manager = new BotManager(world, defaultKartPhysics, defaultDrift)
  for (let n = 0; n < 7; n++) {
    manager.addBot(new RacingBot({ skill: botDifficulties.normal, seed: 10 + n }))
  }
  const driver = new RacingBot({ skill: botDifficulties.facil, seed: 99 })
  const items = new ItemSystem(track, defaultItems, seed, defaultDrift, true, defaultKartPhysics)
  world.obstacles = () => items.hazards.obstacles
  const racers = manager.allRacers()
  const spam = createRng(seed + 1000)

  const outcome: Outcome = {
    allFinished: false,
    badPositions: 0,
    finishTimes: [],
    respawns: racers.map(() => 0),
    longestStall: 0,
    obstacleTravel: 0,
    hits: 0,
    wallBroken: 0,
    wallContacts: 0,
    branchSteps: 0,
    tideBranchLow: 0,
    tideBranchHigh: 0,
    tideFlips: 0,
    events: {},
  }
  const previous = racers.map((r) => ({ ...r.kart.position }))
  const anchor = racers.map((r) => ({ x: r.kart.position.x, z: r.kart.position.z, t: 0 }))
  const obstaclePrev = items.hazards.obstacles.map((o) => ({ x: o.position.x, z: o.position.z }))
  let lastTide = track.tideLow
  const maxSteps = Math.ceil(MAX_SECONDS / DT)
  for (let step = 0; step < maxSteps; step++) {
    const time = step * DT
    const playerInput = driver.nextInput(DT, { world, self: world.player, racers })
    world.step(playerInput, DT)
    manager.update(DT)
    manager.resolveCollisions()
    const inputs = [playerInput, ...manager.getBotInfos().map((info) => info.input)]
    items.update(
      racers.map((racer, i) => ({
        racer,
        input: { ...(inputs[i] ?? NEUTRAL_INPUT), useItem: spam() < 0.06 },
      })),
      DT,
    )
    const log: ItemEvent[] = items.drainEvents()
    for (const event of log) {
      outcome.events[event.type] = (outcome.events[event.type] ?? 0) + 1
    }
    outcome.hits = outcome.events.hit ?? 0
    outcome.wallBroken = outcome.events.iceWallBroken ?? 0
    if (track.tideLow !== lastTide) outcome.tideFlips++
    lastTide = track.tideLow

    items.hazards.obstacles.forEach((o, i) => {
      const p = obstaclePrev[i]
      if (!p) return
      outcome.obstacleTravel += Math.hypot(o.position.x - p.x, o.position.z - p.z)
      p.x = o.position.x
      p.z = o.position.z
    })

    racers.forEach((racer, i) => {
      const { x, y, z } = racer.kart.position
      if (![x, y, z].every(Number.isFinite)) outcome.badPositions++
      const prev = previous[i]
      if (prev && Math.hypot(x - prev.x, z - prev.z) > 3)
        outcome.respawns[i] = (outcome.respawns[i] ?? 0) + 1
      previous[i] = { x, y, z }
      const a = anchor[i]
      if (!a) return
      if (racer.race.state.phase !== 'racing') {
        a.x = x
        a.z = z
        a.t = time
        return
      }
      if (Math.hypot(x - a.x, z - a.z) > STUCK_METERS) {
        a.x = x
        a.z = z
        a.t = time
      } else {
        outcome.longestStall = Math.max(outcome.longestStall, time - a.t)
      }
      const reach = defaultKartPhysics.kartRadius
      for (const o of items.hazards.obstacles) {
        if (
          o.kind === 'iceWall' &&
          o.active &&
          Math.hypot(x - o.position.x, z - o.position.z) < o.radius + reach + 0.3
        ) {
          outcome.wallContacts++
        }
      }
      if (i > 0 && track.branches.length > 0) {
        const proj = track.project(x, z)
        if (proj.branch >= 0 && proj.distance <= proj.halfWidth) outcome.branchSteps++
      }
      if (i > 0 && track.branches.some((b) => b.tide)) {
        const proj = track.project(x, z)
        if (proj.branch >= 0 && proj.distance <= proj.halfWidth) {
          if (track.tideLow) outcome.tideBranchLow++
          else outcome.tideBranchHigh++
        }
      }
    })
    if (racers.every((racer) => racer.race.state.phase === 'finished')) {
      outcome.allFinished = true
      break
    }
  }
  outcome.finishTimes = racers.map((r) => r.race.state.totalRaceTime)
  return outcome
}

const ids = Object.keys(tracks) as TrackId[]
const results = new Map<TrackId, Outcome>()

function result(id: TrackId): Outcome {
  let r = results.get(id)
  if (!r) {
    r = raceTrack(id, 1)
    results.set(id, r)
    const t = r.finishTimes
    console.log(
      `${id}: finish ${Math.min(...t).toFixed(1)}-${Math.max(...t).toFixed(1)}s respawns ${r.respawns.join(',')} stall ${r.longestStall.toFixed(1)}s obstacleTravel ${r.obstacleTravel.toFixed(0)} hits ${r.hits} branchSteps ${r.branchSteps} wallContacts ${r.wallContacts} wallBroken ${r.wallBroken} tide(low/high) ${r.tideBranchLow}/${r.tideBranchHigh}`,
    )
  }
  return r
}

describe.each(ids)('full race on %s', (id) => {
  it('finishes with all eight karts, no NaN, no stuck kart and few respawns', () => {
    const r = result(id)
    expect(r.allFinished).toBe(true)
    expect(r.badPositions).toBe(0)
    expect(r.longestStall).toBeLessThan(STUCK_SECONDS)
    for (const count of r.respawns) expect(count).toBeLessThanOrEqual(MAX_RESPAWNS_PER_KART)
  })
})

describe('hazards interact during races', () => {
  it('the Llanos herd moves', () => {
    expect(result('llanos').obstacleTravel).toBeGreaterThan(500)
  })

  it('the Barranquilla floats keep driving', () => {
    expect(result('barranquilla').obstacleTravel).toBeGreaterThan(500)
  })

  it('on Nevado the bots do not pile into the ice wall', () => {
    const r = result('nevado')
    // Either they avoid the closed tunnel or they break it with a level 3 nitro
    expect(r.wallContacts).toBeLessThan(60)
  })
})

describe('San Andrés tide', () => {
  it('flips on lap 2 and the bots use the sandbank only at low tide', () => {
    const r = raceTrack('sanAndres', 3)
    console.log(
      `sanAndres 3 laps: flips ${r.tideFlips} branch low/high ${r.tideBranchLow}/${r.tideBranchHigh} finish ${Math.max(...r.finishTimes).toFixed(1)} respawns ${r.respawns.join(',')}`,
    )
    expect(r.allFinished).toBe(true)
    expect(r.tideFlips).toBeGreaterThanOrEqual(2)
    expect(r.tideBranchLow).toBeGreaterThan(60)
    expect(r.tideBranchHigh).toBeLessThan(r.tideBranchLow / 4)
  })
})
