import type { Vec2 } from './math'
import type { SurfaceType } from './race/surface'
import type { Track, TrackBranch } from './track'

/** Control point of a closed Catmull-Rom road: ground height `y` and optional surface. */
export interface ControlPoint {
  x: number
  z: number
  y: number
  surface?: SurfaceType
}

/** Distance beyond the main corridor over which ground height blends into a branch ramp (m). */
export const BRANCH_BLEND_DISTANCE = 6

/** Evaluates standard Catmull-Rom spline at parameter t in [0, 1]. */
export function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

/** Samples a closed Catmull-Rom loop: `samplesPerSegment` points (and heights) per segment. */
export function buildCenterline(
  controls: readonly ControlPoint[],
  samplesPerSegment: number,
): { points: Vec2[]; heights: number[] } {
  const n = controls.length
  const points: Vec2[] = []
  const heights: number[] = []

  for (let i = 0; i < n; i++) {
    const cp0 = controls[(i - 1 + n) % n] ?? controls[0]
    const cp1 = controls[i] ?? controls[0]
    const cp2 = controls[(i + 1) % n] ?? controls[0]
    const cp3 = controls[(i + 2) % n] ?? controls[0]
    if (!cp0 || !cp1 || !cp2 || !cp3) continue

    for (let s = 0; s < samplesPerSegment; s++) {
      const t = s / samplesPerSegment
      points.push({
        x: catmullRom(cp0.x, cp1.x, cp2.x, cp3.x, t),
        z: catmullRom(cp0.z, cp1.z, cp2.z, cp3.z, t),
      })
      heights.push(catmullRom(cp0.y, cp1.y, cp2.y, cp3.y, t))
    }
  }

  return { points, heights }
}

/** Index of the sample closest to (x, z). */
export function nearestIndex(points: readonly Vec2[], x: number, z: number): number {
  let closestDistSq = Infinity
  let closestIndex = 0
  for (let i = 0; i < points.length; i++) {
    const pt = points[i]
    if (!pt) continue
    const dx = x - pt.x
    const dz = z - pt.z
    const dSq = dx * dx + dz * dz
    if (dSq < closestDistSq) {
      closestDistSq = dSq
      closestIndex = i
    }
  }
  return closestIndex
}

/** Length of the branch polyline (m). */
export function branchLength(branch: TrackBranch): number {
  let length = 0
  for (let i = 0; i + 1 < branch.points.length; i++) {
    const a = branch.points[i]
    const b = branch.points[i + 1]
    if (a && b) length += Math.hypot(b.x - a.x, b.z - a.z)
  }
  return length
}

/** Distance along the branch (0..1) of the point closest to (x, z). */
export function branchProgress(branch: TrackBranch, x: number, z: number): number {
  const total = branchLength(branch) || 1
  let travelled = 0
  let bestDistance = Infinity
  let bestAlong = 0
  for (let i = 0; i + 1 < branch.points.length; i++) {
    const a = branch.points[i]
    const b = branch.points[i + 1]
    if (!a || !b) continue
    const abx = b.x - a.x
    const abz = b.z - a.z
    const length = Math.hypot(abx, abz) || 1
    const t = Math.min(Math.max(((x - a.x) * abx + (z - a.z) * abz) / (length * length), 0), 1)
    const distance = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t))
    if (distance < bestDistance) {
      bestDistance = distance
      bestAlong = travelled + t * length
    }
    travelled += length
  }
  return bestAlong / total
}

/**
 * Ground height lookup from the nearest centerline sample. Inside a branch it blends from the
 * road height (at the main corridor edge) into a linear ramp between the heights at the two
 * junctions, so there are no steps. `shape` is a geometry-only track (centerline + branches).
 */
export function createGroundHeight(
  shape: Track,
  points: readonly Vec2[],
  heights: readonly number[],
): (x: number, z: number) => number {
  return (x, z) => {
    const roadHeight = heights[nearestIndex(points, x, z)] ?? 0
    const projection = shape.project(x, z)
    const branch = shape.branches[projection.branch]
    if (!branch || projection.distance > projection.halfWidth) return roadHeight

    const awayFromRoad = shape.mainProjection(x, z).distance - shape.halfWidth
    if (awayFromRoad <= 0) return roadHeight
    const weight = Math.min(awayFromRoad / BRANCH_BLEND_DISTANCE, 1)
    const t = branchProgress(branch, x, z)
    const first = branch.points[0]
    const last = branch.points[branch.points.length - 1]
    const from = first ? (heights[nearestIndex(points, first.x, first.z)] ?? 0) : 0
    const to = last ? (heights[nearestIndex(points, last.x, last.z)] ?? 0) : 0
    return roadHeight + (from + (to - from) * t - roadHeight) * weight
  }
}
