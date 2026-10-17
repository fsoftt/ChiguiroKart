import type { Vec3 } from '../config/tracks/lighting'

/** Rounds `value` to the nearest multiple of `cell`. */
export function snapToGrid(value: number, cell: number): number {
  return cell > 0 ? Math.round(value / cell) * cell : value
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}

function unit(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2])
  return [v[0] / length, v[1] / length, v[2] / length]
}

/**
 * Right and up axes of the light's view for a light shining along `toSun` (unit vector toward
 * the sun). The shadow map's texels are aligned to these.
 */
export function lightAxes(toSun: Vec3): { right: Vec3; up: Vec3 } {
  const worldUp: Vec3 = Math.abs(toSun[1]) > 0.99 ? [0, 0, 1] : [0, 1, 0]
  const right = unit(cross(worldUp, toSun))
  return { right, up: cross(toSun, right) }
}

/**
 * Moves `focus` to the nearest point whose light-space coordinates are multiples of `texel`.
 * The shadow camera follows the kart through this, so shadow edges keep their texels instead of
 * shimmering while the camera glides. The move along the light direction is left untouched.
 */
export function snapFocusToTexelGrid(focus: Vec3, toSun: Vec3, texel: number): Vec3 {
  const { right, up } = lightAxes(toSun)
  const r = focus[0] * right[0] + focus[1] * right[1] + focus[2] * right[2]
  const u = focus[0] * up[0] + focus[1] * up[1] + focus[2] * up[2]
  const dr = snapToGrid(r, texel) - r
  const du = snapToGrid(u, texel) - u
  return [
    focus[0] + right[0] * dr + up[0] * du,
    focus[1] + right[1] * dr + up[1] * du,
    focus[2] + right[2] * dr + up[2] * du,
  ]
}
