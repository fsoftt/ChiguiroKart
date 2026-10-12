export interface Vec2 {
  x: number
  z: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

export function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t
}

/** Wraps an angle to the range (-PI, PI]. */
export function wrapAngle(angle: number): number {
  const turns = Math.round(angle / (2 * Math.PI))
  const wrapped = angle - turns * 2 * Math.PI
  return wrapped <= -Math.PI ? wrapped + 2 * Math.PI : wrapped
}

/** Interpolates between two angles along the shortest arc. */
export function lerpAngle(from: number, to: number, t: number): number {
  return from + wrapAngle(to - from) * t
}

/** Moves `current` toward `target` by at most `maxDelta`. */
export function moveTowards(current: number, target: number, maxDelta: number): number {
  if (Math.abs(target - current) <= maxDelta) return target
  return current + Math.sign(target - current) * maxDelta
}

/**
 * Frame-rate independent exponential smoothing.
 * Higher `smoothing` reaches the target faster.
 */
export function damp(current: number, target: number, smoothing: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-smoothing * dt))
}

/** Unit vector the kart faces for a given heading (heading 0 faces +z). */
export function forwardOf(heading: number): Vec3 {
  return { x: Math.sin(heading), y: 0, z: Math.cos(heading) }
}

/** Unit vector to the kart's right for a given heading. */
export function rightOf(heading: number): Vec3 {
  return { x: -Math.cos(heading), y: 0, z: Math.sin(heading) }
}

export function dotXZ(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.z * b.z
}

/** Heading whose forward vector points along (x, z). */
export function headingOf(x: number, z: number): number {
  return Math.atan2(x, z)
}
