import type { DriftConfig } from '../../config/drift'
import type { KartInput } from '../../input/kartInput'
import { headingOf, type Vec2 } from '../math'
import { addBoost } from '../kart/boost'
import { createBoostState, createDriftState } from '../kart/driftState'
import type { KartState } from '../kart/kartState'
import { checkGateCrossing, type Checkpoint } from './checkpoint'
import { createRaceState, type RaceState } from './raceState'

export interface RaceManagerOptions {
  totalLaps?: number
  countdownSeconds?: number
  fallThreshold?: number
}

export class RaceManager {
  state: RaceState
  readonly checkpoints: readonly Checkpoint[]
  readonly mandatoryCheckpoints: Set<number>
  readonly fallThreshold: number
  private readonly initialCountdown: number

  private earlyThrottleHeld = false
  private prevPosition: Vec2

  constructor(checkpoints: readonly Checkpoint[], options: RaceManagerOptions = {}) {
    this.checkpoints = checkpoints
    this.fallThreshold = options.fallThreshold ?? -5.0
    this.initialCountdown = options.countdownSeconds ?? 3.0
    this.state = createRaceState(options.totalLaps ?? 3)
    this.state.countdown = this.initialCountdown

    this.mandatoryCheckpoints = new Set(
      checkpoints.filter((cp) => cp.mandatory).map((cp) => cp.index),
    )

    const firstPos = checkpoints[0]?.position ?? { x: 0, z: 0 }
    this.prevPosition = { x: firstPos.x, z: firstPos.z }
  }

  reset(): void {
    const totalLaps = this.state.totalLaps
    this.state = createRaceState(totalLaps)
    this.state.countdown = this.initialCountdown
    this.earlyThrottleHeld = false
    const firstPos = this.checkpoints[0]?.position ?? { x: 0, z: 0 }
    this.prevPosition = { x: firstPos.x, z: firstPos.z }
  }

  /**
   * Updates race logic: countdown, start boost, checkpoints, lap progression, and fall respawn.
   */
  update(
    kart: KartState,
    input: KartInput,
    driftConfig: DriftConfig,
    groundHeight: (x: number, z: number) => number,
    dt: number,
  ): void {
    if (this.state.phase === 'countdown') {
      this.updateCountdown(kart, input, driftConfig, dt)
      this.prevPosition = { x: kart.position.x, z: kart.position.z }
      return
    }

    if (this.state.phase === 'racing') {
      this.state.totalRaceTime += dt
      this.state.currentLapTime += dt

      if (this.state.engineStallRemaining > 0) {
        this.state.engineStallRemaining = Math.max(0, this.state.engineStallRemaining - dt)
        // Stalled engine severely impedes speed
        kart.velocity.x *= Math.exp(-4 * dt)
        kart.velocity.z *= Math.exp(-4 * dt)
      }

      this.checkCheckpoints(kart)
      this.checkFallAndRespawn(kart, groundHeight)
    }

    this.prevPosition = { x: kart.position.x, z: kart.position.z }
  }

  private updateCountdown(
    kart: KartState,
    input: KartInput,
    driftConfig: DriftConfig,
    dt: number,
  ): void {
    this.state.countdown -= dt

    // Lock position during countdown
    kart.velocity.x = 0
    kart.velocity.y = 0
    kart.velocity.z = 0

    // Holding throttle too early causes the engine to stall at the green light
    if (this.state.countdown > 0.35 && input.throttle > 0.5) {
      this.earlyThrottleHeld = true
    }

    if (this.state.countdown <= 0) {
      this.state.phase = 'racing'
      if (!this.state.startBoostEvaluated) {
        this.state.startBoostEvaluated = true
        if (this.earlyThrottleHeld) {
          this.state.engineStallRemaining = 1.0
        } else if (input.throttle > 0.5) {
          // Perfectly timed start boost!
          addBoost(kart, 2, 1.2, true, driftConfig)
        }
      }
    }
  }

  private checkCheckpoints(kart: KartState): void {
    const currPos: Vec2 = { x: kart.position.x, z: kart.position.z }

    for (const cp of this.checkpoints) {
      const crossing = checkGateCrossing(cp, this.prevPosition, currPos)
      if (crossing === 'forward') {
        this.state.lastPassedCheckpoint = cp.index
        this.state.wrongWay = false

        if (cp.mandatory) {
          this.state.passedMandatoryCheckpoints.add(cp.index)
        }

        // Crossed start/finish line (checkpoint 0)
        if (cp.index === 0) {
          const hasVisitedAllMandatory = this.checkAllMandatoryVisited()
          if (hasVisitedAllMandatory) {
            this.completeLap()
          }
        }
      } else if (crossing === 'backward') {
        this.state.wrongWay = true
      }
    }
  }

  private checkAllMandatoryVisited(): boolean {
    if (this.mandatoryCheckpoints.size === 0) return true
    for (const mandatoryId of this.mandatoryCheckpoints) {
      if (!this.state.passedMandatoryCheckpoints.has(mandatoryId)) {
        return false
      }
    }
    return true
  }

  private completeLap(): void {
    this.state.lapTimes.push(this.state.currentLapTime)
    if (this.state.bestLapTime === null || this.state.currentLapTime < this.state.bestLapTime) {
      this.state.bestLapTime = this.state.currentLapTime
    }

    if (this.state.currentLap >= this.state.totalLaps) {
      this.state.phase = 'finished'
    } else {
      this.state.currentLap++
      this.state.currentLapTime = 0
      this.state.passedMandatoryCheckpoints.clear()
      this.state.passedMandatoryCheckpoints.add(0)
    }
  }

  private checkFallAndRespawn(
    kart: KartState,
    groundHeight: (x: number, z: number) => number,
  ): void {
    if (kart.position.y >= this.fallThreshold) return

    // Respawn at the last passed checkpoint
    const cp =
      this.checkpoints.find((c) => c.index === this.state.lastPassedCheckpoint) ??
      this.checkpoints[0]
    const respawnPos = cp?.position ?? { x: 0, z: 0 }
    const ground = groundHeight(respawnPos.x, respawnPos.z)

    kart.position.x = respawnPos.x
    kart.position.y = ground + 0.2
    kart.position.z = respawnPos.z

    if (cp) {
      kart.heading = headingOf(cp.forward.x, cp.forward.z)
    }

    kart.velocity = { x: 0, y: 0, z: 0 }
    kart.airTime = 0
    kart.drift = createDriftState()
    kart.boost = createBoostState()
  }
}
