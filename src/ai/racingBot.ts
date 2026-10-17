import {
  botBehavior,
  botDifficulties,
  type BotBehaviorConfig,
  type BotDifficultyConfig,
} from '../config/bots'
import { defaultDrift, type DriftConfig } from '../config/drift'
import { NEUTRAL_INPUT, type KartInput } from '../input/kartInput'
import type { BotContext, BotInputProvider } from '../input/botInput'
import { insideLip } from '../sim/hazards/jumps'
import { forwardSpeed } from '../sim/kart/kartPhysics'
import type { KartState } from '../sim/kart/kartState'
import { clamp, damp, forwardOf, headingOf, lerp, rightOf, wrapAngle, type Vec2 } from '../sim/math'
import type { Racer } from '../sim/racer'
import type { Track } from '../sim/track'
import { branchBlocked } from './obstacles'
import { DriftControl } from './driftControl'
import { ItemControl } from './itemControl'
import { createRng, seedFor, type Rng } from './random'
import { Route, type RouteCursor } from './route'

export interface RacingBotOptions {
  skill?: BotDifficultyConfig
  behavior?: BotBehaviorConfig
  driftRules?: DriftConfig
  /** Base seed; combined with the racer's slot so every bot behaves differently. */
  seed?: number
}

/** Something to steer around: a kart (radius 0) or a track obstacle. */
interface Blocker {
  x: number
  z: number
  radius: number
}

type BranchState = 'pending' | 'decided'

/** Per-lap decision state for one branch. */
interface BranchPlan {
  state: BranchState
}

/** Slowly changing random sideways deviation from the line. */
interface Wander {
  value: number
  target: number
  timer: number
}

/**
 * AI driver. Follows the track line with a small sideways wander, slows for sharp turns,
 * drifts and chains nitros in marked curves, takes shortcuts, keeps off the walls and other
 * karts, and reverses out when stuck. Fully deterministic: every random choice comes from a
 * seeded generator.
 */
export class RacingBot implements BotInputProvider {
  readonly speedFactor: number
  private readonly skill: BotDifficultyConfig
  private readonly behavior: BotBehaviorConfig
  private readonly driftRules: DriftConfig
  private readonly seed: number

  private rng: Rng = createRng(0)
  private drift: DriftControl | null = null
  private items: ItemControl | null = null
  private itemRng: Rng = createRng(0)
  private trickRng: Rng = createRng(0)
  /** True while the kart is in a jump lip zone (the hop is decided on entering it). */
  private inLip = false
  private route: Route | null = null
  private routeTrack: Track | null = null
  private cursor: RouteCursor | null = null
  private plannedBranch = -1
  private branchPlans: BranchPlan[] = []
  private wander: Wander = { value: 0, target: 0, timer: 0 }
  private avoidOffset = 0
  private avoidSide: -1 | 0 | 1 = 0
  private avoidTimer = 0
  private avoidClearance = 0
  private steer = 0
  private stuckTimer = 0
  private reverseTimer = 0
  private wantsStartBoost = false
  private seeded = false

  constructor(options: RacingBotOptions = {}) {
    this.skill = options.skill ?? botDifficulties.normal
    this.behavior = options.behavior ?? botBehavior
    this.driftRules = options.driftRules ?? defaultDrift
    this.seed = options.seed ?? 0
    this.speedFactor = this.skill.speedFactor
  }

  /** Sideways shift (m) from the line right now: wander plus passing another kart. */
  get lineOffset(): number {
    return this.wander.value + this.avoidOffset
  }

  /** True while the bot is drifting. */
  get isDrifting(): boolean {
    return this.drift?.drifting ?? false
  }

  /** Branch the bot is heading for or driving on (-1 if none). */
  get plannedBranchIndex(): number {
    return this.plannedBranch
  }

  reset(): void {
    this.seeded = false
    this.cursor = null
  }

  nextInput(dt: number, ctx: BotContext): KartInput {
    const { world, self } = ctx
    this.prepare(ctx)
    const state = self.race.state
    if (state.phase === 'countdown') return this.countdownInput(state.countdown)

    const kart = self.kart
    const position: Vec2 = { x: kart.position.x, z: kart.position.z }
    const speed = forwardSpeed(kart)
    const route = this.route
    if (!route || !this.cursor) return { ...NEUTRAL_INPUT }

    this.planShortcuts(route, ctx)
    this.cursor = route.locate(
      this.cursor,
      position,
      this.plannedBranch,
      this.behavior.routeWindow,
      this.behavior.branchExitRadius,
    )
    const cursor = this.cursor
    this.updateOffsets(dt, ctx)

    // Aim at the line ahead, shifted sideways and pulled back toward the center near walls
    const blind = self.items.status.blindTime > 0
    const lookahead =
      (this.skill.lookaheadBase + this.skill.lookaheadTime * Math.max(speed, 0)) *
      (blind ? this.skill.blindLookaheadScale : 1)
    const ahead = route.walk(cursor, position, this.plannedBranch, lookahead)
    const projection = world.track.project(position.x, position.z)
    const edge = projection.distance / projection.halfWidth
    const wallBias = clamp(
      (edge - this.behavior.wallBiasStart) / (1 - this.behavior.wallBiasStart),
      0,
      1,
    )
    const maxOffset = Math.max(0, route.halfWidthAt(cursor) - this.behavior.wallMargin)
    const offset = clamp(this.lineOffset, -maxOffset, maxOffset) * (1 - wallBias)
    const side = rightOf(ahead.heading)
    const target: Vec2 = { x: ahead.point.x + side.x * offset, z: ahead.point.z + side.z * offset }

    const wanted = headingOf(target.x - position.x, target.z - position.z)
    // While sliding in a drift the velocity lags the heading, so aim the velocity too
    const course = headingOf(kart.velocity.x, kart.velocity.z)
    const slideShare = this.isDrifting && speed > 1 ? this.behavior.driftCourseWeight : 0
    const error = lerp(wrapAngle(wanted - kart.heading), wrapAngle(wanted - course), slideShare)
    // Mosquitos: the bot sees badly and weaves a little
    const noise = blind ? (this.itemRng() * 2 - 1) * this.skill.blindSteerNoise : 0
    const pursuit = clamp(-error * this.behavior.steerGain + noise, -1, 1)
    this.steer = damp(this.steer, pursuit, this.behavior.steerSmoothing, dt)

    // A spin-out is not being stuck
    const hit = self.items.status.hit !== null
    if (hit) {
      this.stuckTimer = 0
    } else if (state.phase === 'racing' && this.updateStuck(dt, speed, kart.boost.level)) {
      // Reverse with the opposite steer: turning is inverted when backing up
      return { ...NEUTRAL_INPUT, brake: 1, steer: -this.steer }
    }

    const topSpeed = world.physics.maxSpeed * self.speedScale
    const horizon = clamp(
      speed * this.behavior.turnHorizonTime,
      this.behavior.turnHorizonMin,
      this.behavior.turnHorizonMax,
    )
    const h0 = route.walk(cursor, position, this.plannedBranch, 0).heading
    const turn = (distance: number): number =>
      wrapAngle(route.walk(cursor, position, this.plannedBranch, distance).heading - h0)

    const drift = this.drift
    const command = hit
      ? undefined
      : drift?.update(dt, {
          kart,
          speed,
          turnNear: turn(this.behavior.driftWindow),
          turnFar: turn(this.behavior.driftWindow * 2),
          turnEnd: turn(this.behavior.driftEndWindow),
          wallDanger: () => this.hitsWallSoon(world.track, kart),
        })

    const severity = clamp(
      Math.max(Math.abs(turn(horizon / 2)), Math.abs(turn(horizon))) / this.behavior.sharpTurnAngle,
      0,
      1,
    )
    const cornerFactor = lerp(1, this.skill.cornerSpeedFactor, severity)
    const over = speed - topSpeed * cornerFactor
    const itemCommand = this.items?.update(dt, ctx, turn(this.behavior.turnHorizonMax))
    return {
      ...NEUTRAL_INPUT,
      useItem: itemCommand?.useItem ?? false,
      lookBack: itemCommand?.lookBack ?? false,
      throttle: over > 0 ? 0 : 1,
      brake: over > this.behavior.brakeMargin ? clamp(over / 10, 0.3, 1) : 0,
      steer: command?.forcedSteer ?? this.steer,
      jump: (command?.jump ?? false) || this.hopAtLip(ctx.world.track, kart),
      boost: command?.boost ?? false,
    }
  }

  /**
   * Presses jump on the first step in a jump lip zone, with the skill's chance, to earn the
   * landing nitro. Rolled once per pass on its own random stream.
   */
  private hopAtLip(track: Track, kart: KartState): boolean {
    const inLip =
      kart.onGround && track.jumps.some((j) => insideLip(j, kart.position.x, kart.position.z))
    const entering = inLip && !this.inLip
    this.inLip = inLip
    return entering && this.trickRng() < this.skill.jumpTrickChance
  }

  /** Sets up route and random state on first use and after a reset. */
  private prepare(ctx: BotContext): void {
    const track = ctx.world.track
    if (this.routeTrack !== track || !this.route) {
      this.route = new Route(track)
      this.routeTrack = track
      this.seeded = false
    }
    if (this.seeded && this.cursor) return
    this.seeded = true
    this.rng = createRng(seedFor(this.seed, ctx.self.slot))
    this.drift = new DriftControl(this.skill, this.behavior, this.driftRules, this.rng)
    // Separate generator so item use never changes the driving random sequence
    this.itemRng = createRng(seedFor(this.seed ^ 0x51ed270b, ctx.self.slot))
    this.items = new ItemControl(this.skill, this.behavior, this.itemRng)
    this.trickRng = createRng(seedFor(this.seed ^ 0x7a1c4e93, ctx.self.slot))
    this.inLip = false
    this.cursor = {
      branch: -1,
      index: this.route.nearestMainIndex({
        x: ctx.self.kart.position.x,
        z: ctx.self.kart.position.z,
      }),
    }
    this.plannedBranch = -1
    this.branchPlans = track.branches.map(() => ({ state: 'pending' }))
    this.wander = { value: 0, target: 0, timer: 0 }
    this.avoidOffset = 0
    this.avoidSide = 0
    this.avoidTimer = 0
    this.avoidClearance = 0
    this.steer = 0
    this.stuckTimer = 0
    this.reverseTimer = 0
    this.wantsStartBoost = this.rng() < this.skill.startBoostChance
  }

  /** Throttle stays off in the countdown, except the start boost pressed in its last moment. */
  private countdownInput(secondsLeft: number): KartInput {
    const press = this.wantsStartBoost && secondsLeft <= this.behavior.startPressWindow
    return { ...NEUTRAL_INPUT, throttle: press ? 1 : 0 }
  }

  /** Rolls once per approach whether to take each shortcut, and clears the plan after it. */
  private planShortcuts(route: Route, ctx: BotContext): void {
    const cursor = this.cursor
    if (!cursor || cursor.branch >= 0) return
    const index = cursor.index
    route.junctions.forEach((junction, branch) => {
      const plan = this.branchPlans[branch]
      if (!plan) return
      const ahead = route.mainDistanceAhead(index, junction.startIndex)
      if (ahead > route.loopLength / 2) {
        // Passed the branch start (or far from it): arm the next approach
        plan.state = 'pending'
        if (this.plannedBranch === branch) this.plannedBranch = -1
      } else if (plan.state === 'pending' && ahead <= this.behavior.shortcutDecisionDistance) {
        plan.state = 'decided'
        // Always roll, so blocked branches do not shift the random sequence
        const wants = this.rng() < this.skill.shortcutChance
        if (wants && this.branchOpen(ctx, branch)) this.plannedBranch = branch
      }
    })
  }

  /**
   * A tidal branch is only worth it at low tide; one closed by an ice wall only with a level 3
   * nitro burning, which breaks the wall.
   */
  private branchOpen(ctx: BotContext, branch: number): boolean {
    const track = ctx.world.track
    const definition = track.branches[branch]
    if (!definition) return false
    if (definition.tide && !track.tideLow) return false
    const boost = ctx.self.kart.boost
    if (boost.level >= 3 && boost.timeLeft > 0) return true
    return !branchBlocked(definition, ctx.world.obstacles())
  }

  /** Smooth random wander and the shift to pass karts ahead. */
  private updateOffsets(dt: number, ctx: BotContext): void {
    const wander = this.wander
    wander.timer -= dt
    if (wander.timer <= 0) {
      wander.target = (this.rng() * 2 - 1) * this.skill.wanderAmplitude
      wander.timer = 0.8 + this.rng() * 1.7
    }
    wander.value = damp(wander.value, wander.target, this.skill.wanderRate, dt)

    this.avoidTimer -= dt
    const blocker = this.findBlocker(ctx)
    if (blocker && this.avoidTimer <= 0) {
      this.avoidSide = this.pickSide(ctx.self, blocker)
      this.avoidTimer = this.behavior.avoidHold
    } else if (!blocker && this.avoidTimer <= 0) {
      this.avoidSide = 0
    }
    // Big obstacles need a wider berth than a kart
    if (blocker)
      this.avoidClearance = blocker.radius > 0 ? blocker.radius + this.behavior.obstacleMargin : 0
    const wanted = this.avoidSide * (this.behavior.avoidOffset + this.avoidClearance)
    this.avoidOffset = damp(this.avoidOffset, wanted, this.behavior.avoidSmoothing, dt)
  }

  /** Nearest kart or track obstacle ahead inside the avoidance cone, if any. */
  private findBlocker(ctx: BotContext): Blocker | null {
    const kart = ctx.self.kart
    const forward = forwardOf(kart.heading)
    const right = rightOf(kart.heading)
    let nearest: Blocker | null = null
    let nearestAhead = Infinity
    const consider = (x: number, z: number, radius: number, range: number): void => {
      const dx = x - kart.position.x
      const dz = z - kart.position.z
      const ahead = dx * forward.x + dz * forward.z
      const lateral = dx * right.x + dz * right.z
      if (ahead <= 0 || ahead - radius >= range || ahead >= nearestAhead) return
      if (Math.atan2(Math.max(Math.abs(lateral) - radius, 0), ahead) > this.behavior.avoidConeAngle)
        return
      nearest = { x, z, radius }
      nearestAhead = ahead
    }
    for (const other of ctx.racers) {
      if (other === ctx.self) continue
      consider(other.kart.position.x, other.kart.position.z, 0, this.behavior.avoidDistance)
    }
    for (const obstacle of ctx.world.obstacles()) {
      if (!obstacle.active) continue
      const { x, z } = obstacle.position
      consider(x, z, obstacle.radius, this.behavior.obstacleAvoidDistance)
    }
    return nearest
  }

  /** Side to pass on (+1 right, -1 left): away from the blocker, or toward the freer side. */
  private pickSide(self: Racer, blocker: Blocker): -1 | 1 {
    const right = rightOf(self.kart.heading)
    const dx = blocker.x - self.kart.position.x
    const dz = blocker.z - self.kart.position.z
    const lateral = dx * right.x + dz * right.z
    if (Math.abs(lateral) > 0.3) return lateral > 0 ? -1 : 1
    // Dead ahead: pass on the side that brings us back toward the line
    return this.lineOffset > 0 ? -1 : 1
  }

  /** True once the bot has been nearly still long enough to need reversing out. */
  private updateStuck(dt: number, speed: number, boostLevel: number): boolean {
    if (this.reverseTimer > 0) {
      this.reverseTimer -= dt
      return true
    }
    const still = Math.abs(speed) < this.behavior.stuckSpeed && boostLevel === 0
    this.stuckTimer = still ? this.stuckTimer + dt : 0
    if (this.stuckTimer < this.behavior.stuckTime) return false
    this.stuckTimer = 0
    this.reverseTimer = this.behavior.reverseTime
    return true
  }

  /** Predicts where the kart will be shortly and checks it against the corridor edge. */
  private hitsWallSoon(track: Track, kart: Racer['kart']): boolean {
    const t = this.behavior.wallLookahead
    const projection = track.project(
      kart.position.x + kart.velocity.x * t,
      kart.position.z + kart.velocity.z * t,
    )
    return projection.distance > projection.halfWidth - this.behavior.driftWallMargin
  }
}
