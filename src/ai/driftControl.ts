import type { BotBehaviorConfig, BotDifficultyConfig } from '../config/bots'
import type { DriftConfig } from '../config/drift'
import type { KartState } from '../sim/kart/kartState'
import type { Rng } from './random'

/** What the drift controller needs to know about the current moment. */
export interface DriftSense {
  kart: KartState
  /** Forward speed (m/s). */
  speed: number
  /** Heading change of the route over the drift window (rad, positive = left turn). */
  turnNear: number
  /** Heading change over twice the drift window: tells whether the curve goes on. */
  turnFar: number
  /** Heading change over the shorter end window, same sign convention. */
  turnEnd: number
  /** True if the kart would hit a wall soon at its current velocity (only asked when needed). */
  wallDanger: () => boolean
}

export interface DriftCommand {
  jump: boolean
  boost: boolean
  /** Steer to use instead of the pursuit steer (during the hop), or null. */
  forcedSteer: number | null
}

type Phase = 'idle' | 'hop' | 'drifting'

const IDLE: DriftCommand = { jump: false, boost: false, forcedSteer: null }
/** Shortest time (s) to wait for the hop to leave the ground before judging it failed. */
const MIN_HOP_TIME = 0.1
/** Sampling range of how early a mistimed nitro is fired (charge). */
const EARLY_MIN = 0.05
const EARLY_SPAN = 0.2

/**
 * Decides when a bot hops into a drift, fires its nitros and releases the drift.
 * Works with the same rules as the player: jump starts the drift on landing, boost
 * presses in the red zone chain nitros, releasing jump ends it.
 */
export class DriftControl {
  private phase: Phase = 'idle'
  private cooldown = 0
  private hopTimer = 0
  private hopSteer = 0
  private nitrosSeen = 0
  private nitroTarget = 0

  constructor(
    private readonly skill: BotDifficultyConfig,
    private readonly behavior: BotBehaviorConfig,
    private readonly driftRules: DriftConfig,
    private readonly rng: Rng,
  ) {}

  get drifting(): boolean {
    return this.phase === 'drifting'
  }

  reset(): void {
    this.phase = 'idle'
    this.cooldown = 0
    this.hopTimer = 0
    this.nitrosSeen = 0
  }

  update(dt: number, sense: DriftSense): DriftCommand {
    this.cooldown = Math.max(0, this.cooldown - dt)
    if (this.phase === 'idle') return this.tryStart(sense)
    if (this.phase === 'hop') return this.hop(dt, sense)
    return this.drift(sense)
  }

  private tryStart(sense: DriftSense): DriftCommand {
    const { kart, speed, turnNear, turnFar, turnEnd } = sense
    if (this.skill.maxNitros <= 0 || this.cooldown > 0) return IDLE
    if (!kart.onGround || kart.drift.direction !== 0) return IDLE
    if (speed < this.driftRules.minDriftSpeed * this.behavior.driftSpeedMargin) return IDLE
    if (Math.abs(turnNear) < this.skill.driftTurnAngle) return IDLE
    // The curve must be underway in the same direction and last long enough to be worth it
    if (turnNear * turnEnd <= 0 || Math.abs(turnEnd) < this.behavior.driftStartTurn) return IDLE
    if (
      turnNear * turnFar <= 0 ||
      Math.abs(turnFar) < Math.abs(turnNear) * this.behavior.driftSustain
    ) {
      return IDLE
    }
    if (sense.wallDanger()) return IDLE
    this.phase = 'hop'
    this.hopTimer = 0
    // Positive steer turns right; a positive heading change is a left turn
    this.hopSteer = (turnNear > 0 ? -1 : 1) * this.behavior.hopSteer
    return { jump: true, boost: false, forcedSteer: this.hopSteer }
  }

  private hop(dt: number, sense: DriftSense): DriftCommand {
    this.hopTimer += dt
    if (sense.kart.drift.direction !== 0) {
      this.phase = 'drifting'
      this.nitrosSeen = 0
      this.nitroTarget = this.rollNitroTarget()
      return this.drift(sense)
    }
    const landedWithoutDrift = sense.kart.onGround && this.hopTimer > MIN_HOP_TIME
    if (landedWithoutDrift || this.hopTimer > this.behavior.hopTimeout) return this.release()
    return { jump: true, boost: false, forcedSteer: this.hopSteer }
  }

  private drift(sense: DriftSense): DriftCommand {
    const { kart, turnEnd } = sense
    const drift = kart.drift
    if (drift.direction === 0) return this.release()
    if (drift.nitrosInChain !== this.nitrosSeen) {
      this.nitrosSeen = drift.nitrosInChain
      this.nitroTarget = this.rollNitroTarget()
    }
    if (sense.wallDanger()) return this.release()

    const canFire = !drift.chainBroken && drift.nitrosInChain < this.skill.maxNitros
    // Remaining turn in the drift direction (a right drift follows a negative heading change)
    const turnLeft = -drift.direction * turnEnd
    if (turnLeft < this.behavior.driftEndAngle) {
      // Curve over: cash in a charged bar with a last nitro, then let go
      if (canFire && drift.charge >= this.driftRules.redZoneStart) {
        return { jump: true, boost: true, forcedSteer: null }
      }
      return this.release()
    }
    const fire = canFire && drift.charge >= this.nitroTarget
    return { jump: true, boost: fire, forcedSteer: null }
  }

  private release(): DriftCommand {
    this.phase = 'idle'
    this.cooldown = this.behavior.driftCooldown
    return IDLE
  }

  /** Charge at which the next nitro is pressed: just inside the red zone, or too early on a slip. */
  private rollNitroTarget(): number {
    const redZone = this.driftRules.redZoneStart
    if (this.rng() < this.skill.nitroMistakeChance) {
      return redZone - EARLY_MIN - this.rng() * EARLY_SPAN
    }
    return redZone + this.rng() * this.skill.nitroTimingError
  }
}
