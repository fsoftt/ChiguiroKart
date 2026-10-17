import type { DriftConfig } from '../../config/drift'
import type { KartInput } from '../../input/kartInput'
import { clamp, dotXZ, forwardOf } from '../math'
import { addBoost } from './boost'
import { NEUTRAL_KART_PERKS, type KartPerks } from './kartPerks'
import { createDriftState, MAX_NITROS_PER_DRIFT, type NitroLevel } from './driftState'
import type { KartState } from './kartState'

/** Button rising edges of one step. */
export interface InputEdges {
  jumpPressed: boolean
  boostPressed: boolean
}

/** Detects rising edges against the previous step and records the current button state. */
export function readEdges(state: KartState, input: KartInput): InputEdges {
  const edges = {
    jumpPressed: input.jump && !state.jumpHeld,
    boostPressed: input.boost && !state.boostHeld,
  }
  state.jumpHeld = input.jump
  state.boostHeld = input.boost
  return edges
}

function speedAlongHeading(state: KartState): number {
  return dotXZ(state.velocity, forwardOf(state.heading))
}

/** Gives the kart its hop velocity when jump was just pressed on the ground. */
export function tryHop(state: KartState, jumpPressed: boolean, config: DriftConfig): void {
  if (!jumpPressed || !state.onGround || state.drift.direction !== 0) return
  // Never cancels a launch that happened in the same step (a hop at a jump lip)
  state.velocity.y = Math.max(state.velocity.y, config.hopSpeed)
}

/** Starts a drift if the kart just landed holding jump while steering fast enough. */
export function tryStartDrift(state: KartState, input: KartInput, config: DriftConfig): void {
  const fast = speedAlongHeading(state) >= config.minDriftSpeed
  const steering = Math.abs(input.steer) >= config.driftSteerThreshold
  if (!input.jump || !steering || !fast) return
  // A landing in the middle of a drift continues it instead of resetting charge and chain
  if (state.drift.direction !== 0) return
  state.drift = createDriftState()
  state.drift.direction = input.steer > 0 ? 1 : -1
}

/** Ends the drift and clears its charge and chain. Gives no boost by itself. */
export function endDrift(state: KartState): void {
  state.drift = createDriftState()
}

/** Ends the drift when jump is released or speed is too low. */
export function checkDriftEnd(state: KartState, input: KartInput, config: DriftConfig): void {
  if (state.drift.direction === 0) return
  if (!input.jump || speedAlongHeading(state) < config.minDriftSpeed) endDrift(state)
}

/**
 * Steer value that drives the turn while drifting: always toward the drift side,
 * tighter when steering with it, wider against it, never reversed.
 */
export function driftSteer(state: KartState, steer: number, config: DriftConfig): number {
  const direction = state.drift.direction
  const turn = config.driftBaseTurn + direction * steer * config.driftSteerInfluence
  return direction * clamp(turn, config.driftMinTurn, 1)
}

/** Advances the charge bar, overcharge timer and nitro presses of an active drift. */
export function updateDrift(
  state: KartState,
  boostPressed: boolean,
  config: DriftConfig,
  dt: number,
  perks: KartPerks = NEUTRAL_KART_PERKS,
): void {
  const drift = state.drift
  if (drift.direction === 0) return
  if (boostPressed) pressBoost(state, config, perks)
  if (drift.chainBroken || drift.nitrosInChain >= MAX_NITROS_PER_DRIFT) return

  drift.charge = Math.min(drift.charge + config.chargeRate * perks.driftChargeFactor * dt, 1)
  if (drift.charge < 1) return
  drift.overchargeTime += dt
  if (drift.overchargeTime > config.overchargeGrace) drift.chainBroken = true
}

function pressBoost(state: KartState, config: DriftConfig, perks: KartPerks): void {
  const drift = state.drift
  if (drift.chainBroken || drift.nitrosInChain >= MAX_NITROS_PER_DRIFT) return
  if (drift.charge < config.redZoneStart) {
    drift.chainBroken = true
    return
  }
  const level = (drift.nitrosInChain + 1) as Exclude<NitroLevel, 0>
  const perfect = drift.charge - config.redZoneStart <= config.perfectWindow
  const base = config.levels[level - 1]?.duration ?? 0
  const factor = perks.nitroDurationFactor * (level === 3 ? perks.thirdNitroDurationFactor : 1)
  addBoost(state, level, base * factor, perfect, config)
  drift.nitrosInChain++
  drift.charge = 0
  drift.overchargeTime = 0
}
