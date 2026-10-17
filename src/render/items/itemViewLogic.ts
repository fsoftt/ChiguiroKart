/** Pure helpers for the item visuals (no Three.js), so they can be unit tested. */
import type { RacerStatus } from '../../sim/items/itemTypes'

/** Extra rotation a hit adds to the kart view. */
export interface HitPose {
  /** Added to the heading (spin-out). */
  yaw: number
  /** Forward somersault angle (flip). */
  pitch: number
}

const TWO_PI = Math.PI * 2

/** Fills `out` with the extra rotation for the current hit reaction (zero when not hit). */
export function hitPoseInto(status: Pick<RacerStatus, 'hit' | 'spinAngle'>, out: HitPose): HitPose {
  out.yaw = 0
  out.pitch = 0
  if (status.hit === 'spin') out.yaw = status.spinAngle
  else if (status.hit === 'flip') out.pitch = status.spinAngle
  return out
}

/** Age over lifetime, clamped to 0..1. */
export function lifeProgress(age: number, life: number): number {
  if (life <= 0) return 1
  return Math.min(1, Math.max(0, age / life))
}

/** Explosion sphere radius: grows fast then slows down (ease out) up to `radius`. */
export function explosionRadius(t: number, radius: number): number {
  const inverse = 1 - Math.min(1, Math.max(0, t))
  return Math.max(0.05, radius * (1 - inverse * inverse * inverse))
}

/** Opacity that fades out along `t` (1 at the start, 0 at the end). */
export function fadeOut(t: number): number {
  const clamped = Math.min(1, Math.max(0, t))
  return 1 - clamped * clamped
}

/** Vertical bobbing offset. */
export function bobOffset(time: number, phase: number, amplitude: number, speed: number): number {
  return Math.sin(time * speed + phase) * amplitude
}

/** Hue (0..1) that cycles with time, for the rainbow boxes and the mask aura. */
export function cycleHue(time: number, speed: number, phase = 0): number {
  const hue = (time * speed + phase) % 1
  return hue < 0 ? hue + 1 : hue
}

/** Position of swarm dot `index` of `count` orbiting a center, written into `out`. */
export function orbitOffset(
  index: number,
  count: number,
  time: number,
  radius: number,
  out: { x: number; y: number; z: number },
): void {
  const angle = (index / count) * TWO_PI + time * (2 + (index % 3))
  out.x = Math.cos(angle) * radius
  out.z = Math.sin(angle) * radius
  out.y = Math.sin(time * 5 + index * 1.7) * 0.4
}
