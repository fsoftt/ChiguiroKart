import { RacingBot } from '../../src/ai/racingBot'
import {
  botDifficulties,
  type BotDifficulty,
  type BotDifficultyConfig,
  type RubberBandConfig,
  defaultRubberBand,
} from '../../src/config/bots'
import { defaultDrift } from '../../src/config/drift'
import { defaultKartPhysics } from '../../src/config/kartPhysics'
import { cocoraTrack } from '../../src/config/tracks/cocoraTrack'
import { NEUTRAL_INPUT, type KartInput } from '../../src/input/kartInput'
import { BotManager } from '../../src/sim/botManager'
import { forwardSpeed } from '../../src/sim/kart/kartPhysics'
import type { Racer } from '../../src/sim/racer'
import { RaceWorld } from '../../src/sim/world'

export const DT = 1 / 60

export const rubberBandOff: RubberBandConfig = { ...defaultRubberBand, enabled: false }

export interface SoloOptions {
  difficulty?: BotDifficulty
  /** Overrides on top of the difficulty profile. */
  skill?: Partial<BotDifficultyConfig>
  seed?: number
  laps?: number
  maxSeconds?: number
  countdown?: number
  /** Point whose closest approach (m) is recorded in `closest`. */
  watch?: { x: number; z: number }
  /** Called after every step (debugging). */
  onStep?: (step: number, racer: Racer, bot: RacingBot, input: KartInput) => void
}

export interface SoloResult {
  finished: boolean
  lapTimes: number[]
  totalTime: number
  /** Steps in which the kart was pressed against a wall. */
  wallSteps: number
  /** Largest distance from the road centerline minus its half-width (m); <= 0 when inside. */
  maxOutside: number
  /** Teleports (fall respawns). */
  respawns: number
  driftStarts: number
  nitros: number
  perfectNitros: number
  /** Steps spent on the mud branch. */
  branchSteps: number
  /** Positions sampled every 0.5 s. */
  trail: { x: number; z: number }[]
  topSpeed: number
  /** Closest approach to `watch` (m); Infinity if none was given. */
  closest: number
}

export function makeWorld(laps: number, countdown: number): RaceWorld {
  return new RaceWorld(cocoraTrack, defaultKartPhysics, defaultDrift, {
    totalLaps: laps,
    countdownSeconds: countdown,
  })
}

/** One bot alone on Cocora (the player sits parked on the grid). */
export function runSolo(options: SoloOptions = {}): SoloResult {
  const laps = options.laps ?? 3
  const world = makeWorld(laps, options.countdown ?? 0.5)
  const manager = new BotManager(world, defaultKartPhysics, defaultDrift, {
    rubberBand: rubberBandOff,
  })
  const skill = { ...botDifficulties[options.difficulty ?? 'normal'], ...options.skill }
  const bot = new RacingBot({ skill, seed: options.seed ?? 1 })
  manager.addBot(bot)
  const racer = manager.getBotRacers()[0] as Racer

  const result: SoloResult = {
    finished: false,
    lapTimes: [],
    totalTime: 0,
    wallSteps: 0,
    maxOutside: -Infinity,
    respawns: 0,
    driftStarts: 0,
    nitros: 0,
    perfectNitros: 0,
    branchSteps: 0,
    trail: [],
    topSpeed: 0,
    closest: Infinity,
  }
  const limit = Math.ceil((options.maxSeconds ?? 300) / DT)
  let previous = { ...racer.kart.position }
  let prevDirection = 0
  let prevNitros = 0
  for (let step = 0; step < limit; step++) {
    manager.update(DT)
    options.onStep?.(step, racer, bot, manager.getBotInfos()[0]?.input ?? IDLE)
    const kart = racer.kart
    const projection = world.track.project(kart.position.x, kart.position.z)
    result.maxOutside = Math.max(result.maxOutside, projection.distance - projection.halfWidth)
    if (projection.distance >= projection.halfWidth - defaultKartPhysics.radius - 0.01) {
      result.wallSteps++
    }
    if (projection.branch >= 0 && projection.distance <= projection.halfWidth) result.branchSteps++
    if (Math.hypot(kart.position.x - previous.x, kart.position.z - previous.z) > 3) {
      result.respawns++
    }
    previous = { ...kart.position }
    if (kart.drift.direction !== 0 && prevDirection === 0) result.driftStarts++
    prevDirection = kart.drift.direction
    if (kart.drift.nitrosInChain > prevNitros) {
      result.nitros++
      if (kart.boost.perfect) result.perfectNitros++
    }
    prevNitros = kart.drift.nitrosInChain
    if (options.watch) {
      const { x, z } = options.watch
      result.closest = Math.min(
        result.closest,
        Math.hypot(kart.position.x - x, kart.position.z - z),
      )
    }
    result.topSpeed = Math.max(result.topSpeed, forwardSpeed(kart))
    if (step % 30 === 0) result.trail.push({ x: kart.position.x, z: kart.position.z })
    const state = racer.race.state
    if (state.phase === 'finished') {
      result.finished = true
      break
    }
  }
  result.lapTimes = [...racer.race.state.lapTimes]
  result.totalTime = racer.race.state.totalRaceTime
  return result
}

export const IDLE: KartInput = { ...NEUTRAL_INPUT }
