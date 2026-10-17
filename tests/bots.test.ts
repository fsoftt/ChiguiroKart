import { describe, expect, it } from 'vitest'
import { RacingBot } from '../src/ai/racingBot'
import { rubberBandFactor } from '../src/ai/rubberBand'
import { Route } from '../src/ai/route'
import {
  botDifficulties,
  defaultRubberBand,
  type BotDifficulty,
  type RubberBandConfig,
} from '../src/config/bots'
import { defaultDrift } from '../src/config/drift'
import { defaultKartPhysics } from '../src/config/kartPhysics'
import { cocoraTrack } from '../src/config/tracks/cocoraTrack'
import { NEUTRAL_INPUT } from '../src/input/kartInput'
import { BotManager } from '../src/sim/botManager'
import { createRacer } from '../src/sim/racer'
import { forwardOf, headingOf } from '../src/sim/math'
import { Track } from '../src/sim/track'
import { DT, makeWorld, rubberBandOff, runSolo, type SoloResult } from './helpers/botSim'

const track = new Track(cocoraTrack)
const IDEAL_LAP = track.loopLength / defaultKartPhysics.maxSpeed
const LEVELS: BotDifficulty[] = ['facil', 'normal', 'dificil']
const SEEDS = [1, 2]
/** Laps of the comparison runs: two are enough to tell the bots apart and keep the suite fast. */
const COMPARE_LAPS = 2
const RACE_LAPS = 3

type SoloOptions = NonNullable<Parameters<typeof runSolo>[0]>

const cache = new Map<string, SoloResult>()

/** Solo runs are deterministic, so tests that ask for the same run share it. */
function solo(options: SoloOptions = {}): SoloResult {
  const key = JSON.stringify(options)
  let result = cache.get(key)
  if (!result) {
    result = runSolo(options)
    cache.set(key, result)
  }
  return result
}

/** A short run, shared between the tests that compare bots. */
function compare(difficulty: BotDifficulty, seed: number, skill: SoloOptions['skill'] = {}) {
  return solo({ difficulty, seed, laps: COMPARE_LAPS, skill })
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}

/** Mean total race time of a difficulty over a few seeds. */
function meanTotalTime(
  difficulty: BotDifficulty,
  seeds: number[],
  skill: SoloOptions['skill'] = {},
): number {
  return sum(seeds.map((seed) => compare(difficulty, seed, skill).totalTime)) / seeds.length
}

describe('rubberBandFactor', () => {
  const config: RubberBandConfig = {
    enabled: true,
    deadZone: 20,
    fullGap: 120,
    maxBonus: 0.06,
    maxPenalty: 0.04,
    smoothing: 1,
  }

  it('speeds up bots behind and slows bots ahead, linearly up to the limits', () => {
    expect(rubberBandFactor(-70, config)).toBeCloseTo(1.03)
    expect(rubberBandFactor(-120, config)).toBeCloseTo(1.06)
    expect(rubberBandFactor(-500, config)).toBeCloseTo(1.06)
    expect(rubberBandFactor(70, config)).toBeCloseTo(0.98)
    expect(rubberBandFactor(500, config)).toBeCloseTo(0.96)
  })

  it('does nothing inside the dead zone or when disabled', () => {
    expect(rubberBandFactor(0, config)).toBe(1)
    expect(rubberBandFactor(-20, config)).toBe(1)
    expect(rubberBandFactor(15, config)).toBe(1)
    expect(rubberBandFactor(-500, { ...config, enabled: false })).toBe(1)
    expect(rubberBandFactor(500, { ...config, enabled: false })).toBe(1)
  })
})

describe('BotManager speed scale', () => {
  function settle(rubberBand: RubberBandConfig, playerCheckpoint: number, botCheckpoint: number) {
    const world = makeWorld(3, 0)
    const manager = new BotManager(world, defaultKartPhysics, defaultDrift, { rubberBand })
    manager.addBot(new RacingBot({ skill: botDifficulties.normal }))
    const bot = manager.getBotRacers()[0]
    if (!bot) throw new Error('missing bot')
    world.player.race.state.lastPassedCheckpoint = playerCheckpoint
    bot.race.state.lastPassedCheckpoint = botCheckpoint
    for (let i = 0; i < 60 * 8; i++) {
      manager.update(DT)
      // Keep the staged progress: the bot only drives a few meters in these seconds
      bot.race.state.lastPassedCheckpoint = botCheckpoint
    }
    return bot.speedScale
  }

  const base = botDifficulties.normal.speedFactor

  it('boosts a bot far behind the player and holds back one far ahead', () => {
    expect(settle(defaultRubberBand, 5, 0)).toBeGreaterThan(base)
    expect(settle(defaultRubberBand, 0, 5)).toBeLessThan(base)
    expect(settle(defaultRubberBand, 5, 0)).toBeLessThanOrEqual(
      base * (1 + defaultRubberBand.maxBonus),
    )
  })

  it('uses only the difficulty factor when the rubber band is off', () => {
    expect(settle(rubberBandOff, 5, 0)).toBeCloseTo(base)
    expect(settle(rubberBandOff, 0, 5)).toBeCloseTo(base)
  })
})

describe('Route', () => {
  const route = new Route(track)
  const junction = route.junctions[0]

  it('finds the mud branch junctions on the main loop', () => {
    expect(junction).toEqual({ startIndex: 96, endIndex: 134 })
  })

  it('walks the main loop, or the branch and back to the road when planned', () => {
    const start = track.point(90)
    const cursor = { branch: -1, index: 90 }
    const mainTarget = route.walk(cursor, start, -1, 80)
    const branchTarget = route.walk(cursor, start, 0, 80)
    const branchPoint = track.branches[0]?.points[3]
    expect(mainTarget.point).not.toEqual(branchTarget.point)
    expect(branchPoint).toBeDefined()

    // Far enough ahead, the branch walk has rejoined the road after its last point
    const far = route.walk(cursor, start, 0, 200)
    const onRoad = track.mainProjection(far.point.x, far.point.z)
    expect(onRoad.distance).toBeLessThan(0.5)
  })

  it('never jumps across the hairpin when tracking progress', () => {
    let cursor = { branch: -1, index: 100 }
    const p = track.point(100)
    cursor = route.locate(cursor, p, -1, 24, 5)
    expect(cursor.branch).toBe(-1)
    expect(Math.abs(cursor.index - 100)).toBeLessThanOrEqual(2)
  })
})

describe('RacingBot on Cocora', () => {
  const noShortcut = { shortcutChance: 0 }

  it('finishes three laps alone in a sane time, without respawns, inside the corridor', () => {
    const run = solo({ difficulty: 'normal', seed: 1 })
    expect(run.finished).toBe(true)
    expect(run.lapTimes).toHaveLength(3)
    expect(run.totalTime).toBeLessThan(3 * 3 * IDEAL_LAP)
    expect(run.respawns).toBe(0)
    expect(run.maxOutside).toBeLessThanOrEqual(0.05)
    // Scraping a wall for more than a few percent of the race means the line is bad
    expect(run.wallSteps).toBeLessThan((run.totalTime / DT) * 0.05)
  })

  it('stays inside the corridor and does not respawn at any difficulty or seed', () => {
    for (const difficulty of LEVELS) {
      for (const seed of SEEDS) {
        const run = compare(difficulty, seed)
        const label = `${difficulty} ${seed}`
        expect(run.finished, label).toBe(true)
        expect(run.respawns, label).toBe(0)
        expect(run.maxOutside, label).toBeLessThanOrEqual(0.05)
        expect(run.wallSteps, label).toBeLessThan((run.totalTime / DT) * 0.05)
      }
    }
  })

  it('is faster the harder the difficulty', () => {
    const [facil, normal, dificil] = LEVELS.map((level) => meanTotalTime(level, SEEDS)) as [
      number,
      number,
      number,
    ]
    expect(dificil).toBeLessThan(normal)
    expect(normal).toBeLessThan(facil)

    // Same order with shortcuts off, so it is the driving and not the route
    const [easy, mid, hard] = LEVELS.map((level) => meanTotalTime(level, [1, 2], noShortcut)) as [
      number,
      number,
      number,
    ]
    expect(hard).toBeLessThan(mid)
    expect(mid).toBeLessThan(easy)
  })

  it('reaches boosted speeds but never beats the physics by much', () => {
    // Full speed scale on purpose: this checks the physics ceiling, not the tuned difficulty
    const run = compare('dificil', 1, { ...noShortcut, speedFactor: 1 })
    // Nitros push the kart past its normal top speed
    expect(run.topSpeed).toBeGreaterThan(defaultKartPhysics.maxSpeed)
    expect(Math.min(...run.lapTimes)).toBeGreaterThan(IDEAL_LAP * 0.9)
  })

  it('drifts and fires nitros, and drifting beats not drifting', () => {
    const run = compare('dificil', 1, noShortcut)
    expect(run.driftStarts).toBeGreaterThan(5)
    expect(run.nitros).toBeGreaterThan(0)

    const without = meanTotalTime('dificil', [1, 2], { ...noShortcut, maxNitros: 0 })
    expect(meanTotalTime('dificil', [1, 2], noShortcut)).toBeLessThan(without)
  })

  it('fires more perfect nitros at difficult than at easy', () => {
    const count = (difficulty: BotDifficulty): number =>
      sum(SEEDS.map((seed) => compare(difficulty, seed).perfectNitros))
    expect(count('dificil')).toBeGreaterThan(count('facil'))
    expect(count('dificil')).toBeGreaterThanOrEqual(count('normal'))
  })

  it('never fires more nitros per drift than its difficulty allows', () => {
    for (const difficulty of LEVELS) {
      const run = compare(difficulty, 1)
      expect(run.nitros).toBeLessThanOrEqual(
        run.driftStarts * botDifficulties[difficulty].maxNitros,
      )
    }
  })

  describe('shortcut', () => {
    const middle = track.branches[0]?.points[3]
    if (!middle) throw new Error('Cocora has no branch')
    const run = (shortcutChance: number): SoloResult =>
      solo({
        difficulty: 'normal',
        seed: 1,
        laps: COMPARE_LAPS,
        skill: { shortcutChance, wanderAmplitude: 0 },
        watch: middle,
      })

    it('drives through the branch every lap with probability 1 and never with 0', () => {
      const taken = run(1)
      const skipped = run(0)
      expect(taken.finished).toBe(true)
      expect(taken.closest).toBeLessThan(3)
      expect(taken.branchSteps).toBeGreaterThan(200)
      expect(skipped.closest).toBeGreaterThan(15)
      expect(skipped.branchSteps).toBe(0)
    })

    it('is faster than the road around it', () => {
      expect(run(1).totalTime).toBeLessThan(run(0).totalTime)
    })
  })

  it('is deterministic: the same seed gives the same race, another seed a different one', () => {
    const a = runSolo({ difficulty: 'normal', seed: 5, laps: 1 })
    const b = runSolo({ difficulty: 'normal', seed: 5, laps: 1 })
    const c = runSolo({ difficulty: 'normal', seed: 6, laps: 1 })
    expect(b.trail).toEqual(a.trail)
    expect(b.lapTimes).toEqual(a.lapTimes)
    expect(c.trail).not.toEqual(a.trail)
  })

  it('replays the same race after a reset', () => {
    const world = makeWorld(1, 0.5)
    const manager = new BotManager(world, defaultKartPhysics, defaultDrift, {
      rubberBand: rubberBandOff,
    })
    manager.addBot(new RacingBot({ seed: 3 }))
    const bot = manager.getBotRacers()[0]
    const drive = (): { x: number; z: number } => {
      for (let i = 0; i < 60 * 12; i++) manager.update(DT)
      return { x: bot?.kart.position.x ?? 0, z: bot?.kart.position.z ?? 0 }
    }
    const first = drive()
    manager.reset()
    expect(drive()).toEqual(first)
  })
})

describe('RacingBot start and recovery', () => {
  function stage(skill: Partial<typeof botDifficulties.normal> = {}, countdown = 3) {
    const world = makeWorld(3, countdown)
    const self = createRacer(world.track, world.raceOptions, 1)
    const bot = new RacingBot({ skill: { ...botDifficulties.normal, ...skill }, seed: 1 })
    const racers = [world.player, self]
    return { world, self, bot, racers }
  }

  it('keeps off the throttle in the countdown, except for the start boost', () => {
    const never = stage({ startBoostChance: 0 })
    const always = stage({ startBoostChance: 1 })
    const early = always.bot.nextInput(DT, { ...always, world: always.world })
    expect(early.throttle).toBe(0)

    for (const scene of [never, always]) scene.self.race.state.countdown = 0.2
    expect(never.bot.nextInput(DT, never).throttle).toBe(0)
    expect(always.bot.nextInput(DT, always).throttle).toBe(1)
    // Still too early at 0.34 s: holding throttle then would stall the engine
    always.self.race.state.countdown = 0.34
    expect(always.bot.nextInput(DT, always).throttle).toBe(0)
  })

  it('gets the start boost when it rolls it and none when it does not', () => {
    const level = (startBoostChance: number): number => {
      const { world, self, bot, racers } = stage({ startBoostChance }, 1)
      for (let i = 0; i < 90; i++) {
        const input = bot.nextInput(DT, { world, self, racers })
        // Step only this racer through the race rules and physics
        world.step(NEUTRAL_INPUT, DT)
        self.race.update(self.kart, input, defaultDrift, () => 0, DT)
        if (self.race.state.phase === 'racing') break
      }
      return self.kart.boost.level
    }
    expect(level(1)).toBe(2)
    expect(level(0)).toBe(0)
  })

  it('reverses out when stuck against a wall, then drives on', () => {
    const world = makeWorld(3, 0)
    const manager = new BotManager(world, defaultKartPhysics, defaultDrift, {
      rubberBand: rubberBandOff,
    })
    manager.addBot(new RacingBot({ skill: { ...botDifficulties.normal, wanderAmplitude: 0 } }))
    const bot = manager.getBotRacers()[0]
    if (!bot) throw new Error('missing bot')
    for (let i = 0; i < 60 * 10; i++) manager.update(DT)

    // Turn the kart around and wedge it nose-first into the outer wall
    const wall = track.point(30)
    const projection = track.project(wall.x, wall.z)
    const nx = projection.normal.x || 1
    bot.kart.velocity = { x: 0, y: 0, z: 0 }
    bot.kart.position.x = wall.x + nx * (track.halfWidth - 1)
    bot.kart.position.z = wall.z
    bot.kart.heading = headingOf(nx, 0)
    bot.race.state.lastPassedCheckpoint = 1
    const before = { ...bot.kart.position }
    let moved = 0
    for (let i = 0; i < 60 * 8; i++) {
      manager.update(DT)
      moved = Math.max(
        moved,
        Math.hypot(bot.kart.position.x - before.x, bot.kart.position.z - before.z),
      )
    }
    expect(moved).toBeGreaterThan(15)
  })
})

describe('RacingBot avoids karts', () => {
  function pass(side: 1 | -1): number {
    const world = makeWorld(3, 0)
    const spot = track.point(10)
    const heading = headingOf(track.point(11).x - spot.x, track.point(11).z - spot.z)
    const self = createRacer(world.track, world.raceOptions, 1)
    const blocker = createRacer(world.track, world.raceOptions, 2)
    self.race.state.phase = 'racing'
    self.kart.position = { x: spot.x, y: 0, z: spot.z }
    self.kart.heading = heading
    self.kart.velocity = { x: Math.sin(heading) * 20, y: 0, z: Math.cos(heading) * 20 }

    // A slow kart 9 m ahead, a little to the chosen side (positive = to our right)
    const forward = forwardOf(heading)
    const right = { x: -Math.cos(heading), z: Math.sin(heading) }
    blocker.kart.position = {
      x: spot.x + forward.x * 9 + right.x * side * 0.8,
      y: 0,
      z: spot.z + forward.z * 9 + right.z * side * 0.8,
    }
    const bot = new RacingBot({ skill: { ...botDifficulties.normal, wanderAmplitude: 0 } })
    for (let i = 0; i < 60; i++) bot.nextInput(DT, { world, self, racers: [self, blocker] })
    return bot.lineOffset
  }

  it('shifts away from a kart right ahead, to the freer side', () => {
    expect(pass(1)).toBeLessThan(-1)
    expect(pass(-1)).toBeGreaterThan(1)
  })

  it('does not shift when nobody is ahead', () => {
    const world = makeWorld(3, 0)
    const self = createRacer(world.track, world.raceOptions, 1)
    self.race.state.phase = 'racing'
    const bot = new RacingBot({ skill: { ...botDifficulties.normal, wanderAmplitude: 0 } })
    for (let i = 0; i < 30; i++) bot.nextInput(DT, { world, self, racers: [self] })
    expect(bot.lineOffset).toBe(0)
  })
})

describe('full race', () => {
  it('lets seven bots finish the race with a slow player and collisions on', () => {
    const world = makeWorld(RACE_LAPS, 3)
    const manager = new BotManager(world, defaultKartPhysics, defaultDrift)
    LEVELS.forEach((difficulty, i) => {
      for (let n = 0; n < (i === 2 ? 3 : 2); n++) {
        manager.addBot(new RacingBot({ skill: botDifficulties[difficulty], seed: 10 + n }))
      }
    })
    expect(manager.count()).toBe(7)

    // The player is a slow driver, so bots must overtake it
    const driver = new RacingBot({ skill: botDifficulties.facil, seed: 99 })
    world.player.speedScale = 0.6
    const racers = manager.allRacers()
    const bots = manager.getBotRacers()
    const limit = 60 * 200
    let step = 0
    for (; step < limit; step++) {
      world.step(driver.nextInput(DT, { world, self: world.player, racers }), DT)
      manager.update(DT)
      manager.resolveCollisions()
      if (bots.every((bot) => bot.race.state.phase === 'finished')) break
    }
    expect(bots.every((bot) => bot.race.state.phase === 'finished')).toBe(true)
    for (const bot of bots) {
      expect(bot.race.state.lapTimes).toHaveLength(RACE_LAPS)
      expect(bot.race.state.totalRaceTime).toBeLessThan(200)
    }
  })
})
