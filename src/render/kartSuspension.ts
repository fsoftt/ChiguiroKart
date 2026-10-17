/**
 * Procedural kart animation (docs/diseno.md §2.3) as pure logic: a spring-damper on the
 * chassis driven by landings, acceleration and wall hits, plus roll in turns and wheel angles.
 * `CharacterView` copies the resulting pose onto the model's bones.
 */
import { clamp, damp } from '../sim/math'
import { WHEEL_RADIUS } from './characters/rig'

export const suspensionConfig = {
  /** Spring stiffness (1/s^2) and damping (1/s) of the vertical bounce: ~2 Hz, a bit bouncy. */
  stiffness: 180,
  damping: 9,
  /** Same for the pitch spring. */
  pitchStiffness: 120,
  pitchDamping: 8,
  /** Vertical speed on touchdown to initial spring speed. */
  landingGain: 0.12,
  /** Longest compression and rebound of the chassis (m). */
  maxOffset: 0.2,
  /** Pitch (rad) per m/s^2 of acceleration; nose up when speeding up, down when braking. */
  pitchPerAccel: 0.004,
  maxPitch: 0.14,
  /** Smoothing of the measured acceleration (1/s), which is noisy between fixed steps. */
  accelSmoothing: 10,
  /** A drop of forward speed faster than this (m/s^2) and bigger than `bumpMinDrop` is a crash. */
  bumpDecel: 100,
  bumpMinDrop: 1.5,
  /** Initial speed of the hop (m/s) and of the nose rocking forward (rad/s) at full hardness. */
  bumpHop: 2,
  bumpPitch: 3,
  /** Squash and stretch: scale of the chassis height per metre of spring offset. */
  squashPerMeter: 1.4,
  minScaleY: 0.8,
  maxScaleY: 1.2,
  /** Roll (rad) at full steer and speed, leaning out of a turn; drifts lean into the slide. */
  turnRoll: 0.06,
  driftRoll: 0.1,
  rollSmoothing: 8,
  /** Front wheels turn this much (rad) at full steer. */
  maxWheelSteer: 0.45,
  steerSmoothing: 14,
  /** Longest step integrated in one go, so large frame times stay stable. */
  maxSubstep: 1 / 120,
}

export interface SuspensionInput {
  onGround: boolean
  /** World vertical speed (m/s). */
  verticalSpeed: number
  /** Speed along the kart's heading (m/s, negative reversing). */
  forwardSpeed: number
  /** -1 (left) .. 1 (right). */
  steer: number
  /** -1 drifting left, 1 drifting right, 0 not drifting. */
  driftDirection: number
  /** Forward speed over top speed. */
  speedRatio: number
}

/** What the model's bones should look like. */
export interface SuspensionPose {
  /** Chassis height offset (m). */
  offsetY: number
  /** Rotation of the chassis around x (rad; positive dips the nose). */
  pitch: number
  /** Rotation of the chassis around z (rad; positive leans to the kart's right). */
  roll: number
  scaleY: number
  scaleXZ: number
  /** Accumulated wheel rotation around x (rad). */
  wheelSpin: number
  /** Front wheel yaw (rad). */
  steerAngle: number
}

export interface SuspensionState {
  pose: SuspensionPose
  offsetVelocity: number
  pitchVelocity: number
  accel: number
  wasOnGround: boolean
  /** Last vertical speed seen in the air, i.e. the speed of the touchdown. */
  airVerticalSpeed: number
  previousForwardSpeed: number
  /** False until the first update, which only records the starting speeds. */
  primed: boolean
}

export function createSuspensionState(): SuspensionState {
  return {
    pose: { offsetY: 0, pitch: 0, roll: 0, scaleY: 1, scaleXZ: 1, wheelSpin: 0, steerAngle: 0 },
    offsetVelocity: 0,
    pitchVelocity: 0,
    accel: 0,
    wasOnGround: true,
    airVerticalSpeed: 0,
    previousForwardSpeed: 0,
    primed: false,
  }
}

/** Advances the suspension by `dt` seconds; the result is in `state.pose`. */
export function stepSuspension(
  state: SuspensionState,
  input: SuspensionInput,
  dt: number,
  config = suspensionConfig,
): SuspensionPose {
  const pose = state.pose
  if (!state.primed) {
    state.primed = true
    state.previousForwardSpeed = input.forwardSpeed
  }

  if (dt > 0) {
    measure(state, input, dt, config)
    const steps = Math.max(1, Math.ceil(dt / config.maxSubstep))
    const h = dt / steps
    const targetPitch = clamp(
      -state.accel * config.pitchPerAccel,
      -config.maxPitch,
      config.maxPitch,
    )
    for (let i = 0; i < steps; i++) {
      state.offsetVelocity +=
        (-config.stiffness * pose.offsetY - config.damping * state.offsetVelocity) * h
      pose.offsetY = clamp(
        pose.offsetY + state.offsetVelocity * h,
        -config.maxOffset,
        config.maxOffset,
      )
      state.pitchVelocity +=
        (config.pitchStiffness * (targetPitch - pose.pitch) -
          config.pitchDamping * state.pitchVelocity) *
        h
      pose.pitch = clamp(
        pose.pitch + state.pitchVelocity * h,
        -config.maxPitch * 2,
        config.maxPitch * 2,
      )
    }

    const ratio = clamp(input.speedRatio, -1, 1)
    const targetRoll =
      -input.steer * config.turnRoll * Math.abs(ratio) + input.driftDirection * config.driftRoll
    pose.roll = damp(pose.roll, targetRoll, config.rollSmoothing, dt)
    pose.steerAngle = damp(
      pose.steerAngle,
      -input.steer * config.maxWheelSteer,
      config.steerSmoothing,
      dt,
    )
    pose.wheelSpin = (pose.wheelSpin + (input.forwardSpeed / WHEEL_RADIUS) * dt) % (Math.PI * 2)
  }

  // Squash when compressed, stretch when extended, keeping the volume roughly constant
  pose.scaleY = clamp(1 + pose.offsetY * config.squashPerMeter, config.minScaleY, config.maxScaleY)
  pose.scaleXZ = 1 / Math.sqrt(pose.scaleY)
  return pose
}

/** Turns landings, acceleration and crashes into spring impulses. */
function measure(
  state: SuspensionState,
  input: SuspensionInput,
  dt: number,
  config: typeof suspensionConfig,
): void {
  if (!input.onGround) state.airVerticalSpeed = input.verticalSpeed
  else if (!state.wasOnGround && state.airVerticalSpeed < 0) {
    state.offsetVelocity += state.airVerticalSpeed * config.landingGain
    state.pitchVelocity -= state.airVerticalSpeed * config.landingGain * 0.5
    state.airVerticalSpeed = 0
  }
  state.wasOnGround = input.onGround

  const rawAccel = (input.forwardSpeed - state.previousForwardSpeed) / dt
  const drop = state.previousForwardSpeed - input.forwardSpeed
  state.previousForwardSpeed = input.forwardSpeed
  if (-rawAccel > config.bumpDecel && drop > config.bumpMinDrop && input.onGround) {
    // Crash: hop up and rock the nose forward, scaled by how hard we hit
    const hardness = clamp(drop / 10, 0.2, 1)
    state.offsetVelocity += config.bumpHop * hardness
    state.pitchVelocity += config.bumpPitch * hardness
    state.accel = 0
    return
  }
  state.accel = damp(state.accel, rawAccel, config.accelSmoothing, dt)
}
