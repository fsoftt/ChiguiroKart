import type { KartPhysicsConfig } from '../../config/kartPhysics'
import type { KartInput } from '../../input/kartInput'
import { clamp, dotXZ, forwardOf, lerp, moveTowards, rightOf, wrapAngle } from '../math'
import type { KartState } from './kartState'

/** Ground height lookup, so physics does not depend on a concrete track type. */
export type GroundHeight = (x: number, z: number) => number

/** Advances one kart by `dt` seconds. Mutates `state`. */
export function stepKart(
  state: KartState,
  input: KartInput,
  config: KartPhysicsConfig,
  groundHeight: GroundHeight,
  dt: number,
): void {
  if (state.onGround) drive(state, input, config, dt)
  applyGravity(state, config, dt)
  integrate(state, dt)
  landOnGround(state, groundHeight)
}

/** Forward speed (m/s); negative when reversing. */
export function forwardSpeed(state: KartState): number {
  return dotXZ(state.velocity, forwardOf(state.heading))
}

function drive(state: KartState, input: KartInput, config: KartPhysicsConfig, dt: number): void {
  const speed = dotXZ(state.velocity, forwardOf(state.heading))
  const sideways = dotXZ(state.velocity, rightOf(state.heading))

  state.heading = wrapAngle(state.heading - turnRate(speed, input.steer, config) * dt)

  const newSpeed = applyPedals(speed, input.throttle - input.brake, config, dt)
  const newSideways = sideways * Math.exp(-config.lateralGrip * dt)

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

/** `pedal` is throttle minus brake, in -1..1. Returns the new forward speed. */
function applyPedals(speed: number, pedal: number, config: KartPhysicsConfig, dt: number): number {
  if (pedal > 0) {
    if (speed < 0) return moveTowards(speed, 0, config.brakeDeceleration * pedal * dt)
    if (speed > config.maxSpeed) {
      return moveTowards(speed, config.maxSpeed, config.coastDeceleration * dt)
    }
    return Math.min(speed + config.acceleration * pedal * dt, config.maxSpeed)
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

function landOnGround(state: KartState, groundHeight: GroundHeight): void {
  const ground = groundHeight(state.position.x, state.position.z)
  state.onGround = state.position.y <= ground
  if (!state.onGround) return
  state.position.y = ground
  state.velocity.y = Math.max(state.velocity.y, 0)
}
