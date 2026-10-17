import type { Vec2 } from '../../sim/math'

/** Point of the loop at `index` (wraps around). */
function loopPoint(centerline: readonly Vec2[], index: number): Vec2 {
  const count = centerline.length
  const point = centerline[((index % count) + count) % count]
  if (!point) throw new Error(`Missing centerline point ${index}`)
  return point
}

/** Spot `offset` meters to the right of the centerline at `index` (negative = left). */
export function spotAt(centerline: readonly Vec2[], index: number, offset: number): Vec2 {
  const a = loopPoint(centerline, index)
  const b = loopPoint(centerline, index + 1)
  const length = Math.hypot(b.x - a.x, b.z - a.z) || 1
  const forwardX = (b.x - a.x) / length
  const forwardZ = (b.z - a.z) / length
  // Right of the driving direction (see rightOf in sim/math)
  return { x: a.x - forwardZ * offset, z: a.z + forwardX * offset }
}

/** A row of spots across the road at centerline `index`. */
export function rowAcross(
  centerline: readonly Vec2[],
  index: number,
  offsets: readonly number[],
): Vec2[] {
  return offsets.map((offset) => spotAt(centerline, index, offset))
}

/** `count` spots along the road from `start`, one every `step` centerline points. */
export function lineAlong(
  centerline: readonly Vec2[],
  start: number,
  count: number,
  offset: number,
  step = 1,
): Vec2[] {
  return Array.from({ length: count }, (_, i) => spotAt(centerline, start + i * step, offset))
}
