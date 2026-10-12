import { lerp, lerpAngle, type Vec3 } from '../math'
import { createBoostState, createDriftState, type BoostState, type DriftState } from './driftState'

export interface KartState {
  position: Vec3
  /** World-space velocity (m/s). */
  velocity: Vec3
  /** Yaw in radians; 0 faces +z. */
  heading: number
  onGround: boolean
  /** Seconds spent in the air in the current jump; 0 on the ground. */
  airTime: number
  drift: DriftState
  boost: BoostState
}

export function createKartState(position: Vec3, heading: number): KartState {
  return {
    position: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    heading,
    onGround: true,
    airTime: 0,
    drift: createDriftState(),
    boost: createBoostState(),
  }
}

export function cloneKartState(state: KartState): KartState {
  return {
    ...state,
    position: { ...state.position },
    velocity: { ...state.velocity },
    drift: { ...state.drift },
    boost: { ...state.boost },
  }
}

/**
 * Blends two simulation states for smooth rendering between fixed steps.
 * Discrete fields (drift, boost, ground) come from the newer state.
 */
export function interpolateKart(previous: KartState, current: KartState, t: number): KartState {
  const blend = (a: Vec3, b: Vec3): Vec3 => ({
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    z: lerp(a.z, b.z, t),
  })
  return {
    ...cloneKartState(current),
    position: blend(previous.position, current.position),
    velocity: blend(previous.velocity, current.velocity),
    heading: lerpAngle(previous.heading, current.heading, t),
  }
}
