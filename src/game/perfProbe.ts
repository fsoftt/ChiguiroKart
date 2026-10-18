import type { Vec2 } from '../sim/math'

/** Where along the track the perf report looks: the start and three points on the loop. */
export const PERF_STATIONS: readonly number[] = [0, 0.25, 0.5, 0.75]

/** Pose of a point on the main loop, `fraction` (0..1) of the way round. */
export interface StationPose {
  x: number
  z: number
  heading: number
}

/** Position and heading (yaw, 0 faces +z) at `fraction` of the centerline loop. */
export function stationPose(centerline: readonly Vec2[], fraction: number): StationPose {
  const count = centerline.length
  const index = Math.floor(fraction * count) % count
  const here = centerline[index] as Vec2
  const next = centerline[(index + 1) % count] as Vec2
  return { x: here.x, z: here.z, heading: Math.atan2(next.x - here.x, next.z - here.z) }
}

/**
 * Offset (forward, sideways, in meters) of the `index`-th of the other karts, in rows of two
 * ahead of the camera, so the whole grid is in view.
 */
export function gridOffset(index: number): { forward: number; side: number } {
  return { forward: 4 + 4.5 * Math.floor(index / 2), side: index % 2 === 0 ? -2 : 2 }
}

/** What one camera station of the perf report measured (renderer counters of one frame). */
export interface PerfSample {
  drawCalls: number
  triangles: number
  geometries: number
  textures: number
}
