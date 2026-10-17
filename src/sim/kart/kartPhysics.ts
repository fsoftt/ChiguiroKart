import type { DriftConfig } from '../../config/drift'
import type { KartPhysicsConfig } from '../../config/kartPhysics'
import type { KartInput } from '../../input/kartInput'
import { clamp, dotXZ, forwardOf, lerp, moveTowards, rightOf, wrapAngle } from '../math'
import { applyLandingBoost, boostSpeedBonus, tickBoost } from './boost'
import { checkDriftEnd, driftSteer, readEdges, tryHop, tryStartDrift, updateDrift } from './drift'
import type { KartState } from './kartState'

/** Ground height lookup, so physics does not depend on a concrete track type. */
export type GroundHeight = (x: number, z: number) => number

/** Advances one kart by `dt` seconds. Mutates `state`. */
export function stepKart(
  state: KartState,
  input: KartInput,
  config: KartPhysicsConfig,
  driftConfig: DriftConfig,
  groundHeight: GroundHeight,
  dt: number,
): void {
  const edges = readEdges(state, input)

  if (state.onGround) {
    tryHop(state, edges.jumpPressed, driftConfig)
    updateDrift(state, edges.boostPressed, driftConfig, dt)
    checkDriftEnd(state, input, driftConfig)
    drive(state, input, config, driftConfig, dt)
  } else {
    state.airTime += dt
  }

  applyGravity(state, config, dt)
  integrate(state, dt)

  const wasAirborne = !state.onGround
  landOnGround(state, groundHeight, config.groundSnapDistance)
  if (state.onGround && wasAirborne) {
    applyLandingBoost(state, driftConfig)
    state.airTime = 0
    tryStartDrift(state, input, driftConfig)
  }

  tickBoost(state, dt)
}

/** Forward speed (m/s); negative when reversing. */
export function forwardSpeed(state: KartState): number {
  return dotXZ(state.velocity, forwardOf(state.heading))
}

function drive(
  state: KartState,
  input: KartInput,
  config: KartPhysicsConfig,
  driftConfig: DriftConfig,
  dt: number,
): void {
  const speed = dotXZ(state.velocity, forwardOf(state.heading))
  const sideways = dotXZ(state.velocity, rightOf(state.heading))
  const drifting = state.drift.direction !== 0

  const steer = drifting ? driftSteer(state, input.steer, driftConfig) : input.steer
  state.heading = wrapAngle(state.heading - turnRate(speed, steer, config) * dt)

  const bonus = boostSpeedBonus(state, driftConfig)
  const topSpeed = config.maxSpeed * (1 + bonus)
  const acceleration = bonus > 0 ? driftConfig.boostAcceleration : config.acceleration
  const newSpeed = applyPedals(
    speed,
    input.throttle - input.brake,
    config,
    topSpeed,
    acceleration,
    dt,
  )
  const grip = drifting ? driftConfig.driftLateralGrip : config.lateralGrip
  const newSideways = sideways * Math.exp(-grip * dt)

  // Rebuild velocity on the new heading so the kart carries its speed through the turn
  const forward = forwardOf(state.heading)
  const right = rightOf(state.heading)
  state.velocity.x = forward.x * newSpeed + right.x * newSideways
  state.velocity.z = forward.z * newSpeed + right.z * newSideways
}

/**
 * Yaw rate (rad/s); positive steer turns right, which lowers the heading.
 * No turning when stopped, gentler at top speed, inverted in reverse like a real car.
 */
function turnRate(speed: number, steer: number, config: KartPhysicsConfig): number {
  const absSpeed = Math.abs(speed)
  const lowSpeedFactor = clamp(absSpeed / config.turnSpeedReference, 0, 1)
  const highSpeedFactor = lerp(
    1,
    config.highSpeedTurnFactor,
    clamp(absSpeed / config.maxSpeed, 0, 1),
  )
  return steer * config.turnRate * lowSpeedFactor * highSpeedFactor * Math.sign(speed)
}

/**
 * `pedal` is throttle minus brake, in -1..1. Returns the new forward speed.
 * `topSpeed` and `acceleration` rise while a boost burns, so the kart pulls past its base cap.
 */
function applyPedals(
  speed: number,
  pedal: number,
  config: KartPhysicsConfig,
  topSpeed: number,
  acceleration: number,
  dt: number,
): number {
  if (pedal > 0) {
    if (speed < 0) return moveTowards(speed, 0, config.brakeDeceleration * pedal * dt)
    if (speed > topSpeed) {
      return moveTowards(speed, topSpeed, config.coastDeceleration * dt)
    }
    return Math.min(speed + acceleration * pedal * dt, topSpeed)
  }
  if (pedal < 0) {
    if (speed > 0) return moveTowards(speed, 0, config.brakeDeceleration * -pedal * dt)
    return Math.max(speed + config.reverseAcceleration * pedal * dt, -config.maxReverseSpeed)
  }
  return moveTowards(speed, 0, config.coastDeceleration * dt)
}

function applyGravity(state: KartState, config: KartPhysicsConfig, dt: number): void {
  state.velocity.y -= config.gravity * dt
}

function integrate(state: KartState, dt: number): void {
  state.position.x += state.velocity.x * dt
  state.position.y += state.velocity.y * dt
  state.position.z += state.velocity.z * dt
}

/**
 * Resolves ground contact. A kart that was grounded and is not rising (no hop in progress)
 * sticks to the surface when the ground drops away by at most `snapDistance`, so downhill
 * slopes do not flicker between ground and air. Bigger drops still make it airborne.
 */
function landOnGround(state: KartState, groundHeight: GroundHeight, snapDistance: number): void {
  const ground = groundHeight(state.position.x, state.position.z)
  const wasOnGround = state.onGround
  const snaps = wasOnGround && state.velocity.y <= 0 && state.position.y - ground <= snapDistance
  state.onGround = state.position.y <= ground || snaps
  if (!state.onGround) return
  state.position.y = ground
  state.velocity.y = Math.max(state.velocity.y, 0)
}
