import type { SurfaceType } from './race/surface'
import { clamp, headingOf, type Vec2 } from './math'
import type { GapZone, Track, TrackBranch } from './track'

/** Control point of a closed Catmull-Rom road: ground height `y` and optional surface. */
export interface ControlPoint {
  x: number
  z: number
  y: number
  surface?: SurfaceType
}

/** Distance beyond the main corridor over which ground height blends into a branch ramp (m). */
export const BRANCH_BLEND_DISTANCE = 6

/** Ground height inside a jump gap: deep enough that a kart falling in is respawned. */
export const GAP_FLOOR = -20

/** A gap on the main loop also covers this much beyond the walls, so nothing hangs at its edge. */
const GAP_SIDE_MARGIN = 3

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

/** Metres along the branch of the point closest to (x, z). */
export function branchArcAt(branch: TrackBranch, x: number, z: number): number {
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
  return bestAlong
}

/** Distance along the branch (0..1) of the point closest to (x, z). */
export function branchProgress(branch: TrackBranch, x: number, z: number): number {
  return branchArcAt(branch, x, z) / (branchLength(branch) || 1)
}

/** Point of the branch `arc` metres along it, and the heading of the polyline there. */
export function branchPointAt(branch: TrackBranch, arc: number): { point: Vec2; heading: number } {
  let travelled = 0
  let last: { point: Vec2; heading: number } = { point: { x: 0, z: 0 }, heading: 0 }
  for (let i = 0; i + 1 < branch.points.length; i++) {
    const a = branch.points[i]
    const b = branch.points[i + 1]
    if (!a || !b) continue
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    const heading = headingOf(b.x - a.x, b.z - a.z)
    const t = length > 0 ? clamp((arc - travelled) / length, 0, 1) : 0
    last = { point: { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, heading }
    if (arc <= travelled + length) return last
    travelled += length
  }
  return last
}

/**
 * Height of a branch `arc` metres along it. With `heights` it is piecewise linear through them
 * (by arc length); otherwise a straight ramp from `from` to `to`. With `steps` the profile is
 * quantized into flat treads and sharp risers; the two ends keep their height.
 */
export function branchHeightAt(branch: TrackBranch, arc: number, from: number, to: number): number {
  const total = branchLength(branch) || 1
  const heights = branch.heights
  let height = from + (to - from) * clamp(arc / total, 0, 1)
  let start = from
  let end = to
  if (heights && heights.length === branch.points.length) {
    start = heights[0] ?? from
    end = heights[heights.length - 1] ?? to
    height = end
    let travelled = 0
    for (let i = 0; i + 1 < branch.points.length; i++) {
      const a = branch.points[i]
      const b = branch.points[i + 1]
      const h0 = heights[i]
      const h1 = heights[i + 1]
      if (!a || !b || h0 === undefined || h1 === undefined) continue
      const length = Math.hypot(b.x - a.x, b.z - a.z)
      if (arc <= travelled + length) {
        height = h0 + (h1 - h0) * (length > 0 ? clamp((arc - travelled) / length, 0, 1) : 0)
        break
      }
      travelled += length
    }
  }
  const steps = branch.steps ?? 0
  if (steps < 1 || end === start) return height
  const progress = clamp((height - start) / (end - start), 0, 1)
  return start + ((end - start) * Math.round(progress * steps)) / steps
}

/** Cumulative arc length (m) at each sample of the closed loop; `arcs[0]` is 0. */
export function loopArcs(points: readonly Vec2[]): number[] {
  const arcs: number[] = []
  let travelled = 0
  points.forEach((a, i) => {
    arcs.push(travelled)
    const b = points[(i + 1) % points.length]
    if (b) travelled += Math.hypot(b.x - a.x, b.z - a.z)
  })
  return arcs
}

/** Arc position (m) and lateral distance of the point closest to (x, z) on the closed loop. */
function loopArcAt(
  points: readonly Vec2[],
  arcs: readonly number[],
  x: number,
  z: number,
): { arc: number; distance: number } {
  const nearest = nearestIndex(points, x, z)
  const count = points.length
  let best = { arc: arcs[nearest] ?? 0, distance: Infinity }
  for (const start of [(nearest - 1 + count) % count, nearest]) {
    const a = points[start]
    const b = points[(start + 1) % count]
    if (!a || !b) continue
    const abx = b.x - a.x
    const abz = b.z - a.z
    const length = Math.hypot(abx, abz) || 1
    const t = clamp(((x - a.x) * abx + (z - a.z) * abz) / (length * length), 0, 1)
    const distance = Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t))
    if (distance < best.distance) best = { arc: (arcs[start] ?? 0) + t * length, distance }
  }
  return best
}

/**
 * Test for "is there no ground here" from the resolved gaps of a track, or undefined if there
 * are none. Main loop gaps cover the full road width (and a little beyond); branch gaps the
 * corridor of the branch. `shape` is a geometry-only track (centerline + branches).
 */
export function createGapTest(
  shape: Track,
  points: readonly Vec2[],
  gaps: readonly GapZone[],
): ((x: number, z: number) => boolean) | undefined {
  if (gaps.length === 0) return undefined
  const arcs = loopArcs(points)
  const loop = shape.loopLength
  const mainGaps = gaps.filter((gap) => gap.branch < 0)
  const branchGaps = gaps.filter((gap) => gap.branch >= 0)
  return (x, z) => {
    if (mainGaps.length > 0) {
      const along = loopArcAt(points, arcs, x, z)
      if (along.distance <= shape.halfWidth + GAP_SIDE_MARGIN) {
        for (const gap of mainGaps) {
          const offset = (((along.arc - gap.from) % loop) + loop) % loop
          if (offset <= gap.to - gap.from) return true
        }
      }
    }
    if (branchGaps.length > 0) {
      const projection = shape.project(x, z)
      if (projection.branch >= 0 && projection.distance <= projection.halfWidth) {
        const branch = shape.branches[projection.branch]
        if (!branch) return false
        const arc = branchArcAt(branch, x, z)
        for (const gap of branchGaps) {
          if (gap.branch === projection.branch && arc >= gap.from && arc <= gap.to) return true
        }
      }
    }
    return false
  }
}

/** Ground height with and without the jump gaps (see `createTerrain`). */
export interface Terrain {
  groundHeight: (x: number, z: number) => number
  roadHeight: (x: number, z: number) => number
}

/**
 * Ground height lookup from the nearest centerline sample. Inside a branch it blends from the
 * road height (at the main corridor edge) into the branch profile (a linear ramp between the
 * heights at the two junctions, or the branch's own `heights` and `steps`). `shape` is a
 * geometry-only track (centerline + branches). Where `gapAt` says so, `groundHeight` is the
 * deep `GAP_FLOOR` instead; `roadHeight` ignores the gaps.
 */
export function createTerrain(
  shape: Track,
  points: readonly Vec2[],
  heights: readonly number[],
  gapAt?: (x: number, z: number) => boolean,
): Terrain {
  const roadHeight = (x: number, z: number): number => {
    const base = heights[nearestIndex(points, x, z)] ?? 0
    const projection = shape.project(x, z)
    const branch = shape.branches[projection.branch]
    if (!branch || projection.distance > projection.halfWidth) return base

    const awayFromRoad = shape.mainProjection(x, z).distance - shape.halfWidth
    if (awayFromRoad <= 0) return base
    const weight = Math.min(awayFromRoad / BRANCH_BLEND_DISTANCE, 1)
    const first = branch.points[0]
    const last = branch.points[branch.points.length - 1]
    const from = first ? (heights[nearestIndex(points, first.x, first.z)] ?? 0) : 0
    const to = last ? (heights[nearestIndex(points, last.x, last.z)] ?? 0) : 0
    const profile = branchHeightAt(branch, branchArcAt(branch, x, z), from, to)
    return base + (profile - base) * weight
  }
  const groundHeight = gapAt
    ? (x: number, z: number): number => (gapAt(x, z) ? GAP_FLOOR : roadHeight(x, z))
    : roadHeight
  return { groundHeight, roadHeight }
}

/** Ground height without gaps; see `createTerrain`. */
export function createGroundHeight(
  shape: Track,
  points: readonly Vec2[],
  heights: readonly number[],
): (x: number, z: number) => number {
  return createTerrain(shape, points, heights).groundHeight
}
