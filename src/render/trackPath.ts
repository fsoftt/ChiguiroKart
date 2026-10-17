import type { Vec2 } from '../sim/math'
import type { Track, TrackBranch } from '../sim/track'
import type { SurfaceType } from '../sim/race/surface'

/** Spacing (m) of the samples of a branch with a gap: the gap edges are cut to within half. */
const GAP_SAMPLE_SPACING = 0.25
/** Spacing (m) of the samples of a stepped branch: a riser is a near vertical quad. */
const STEP_SAMPLE_SPACING = 0.1

/** A road piece (main loop or branch) that can be drawn as a ribbon with walls. */
export interface Path {
  points: readonly Vec2[]
  closed: boolean
  halfWidth: number
  surfaceAt: (segment: number) => SurfaceType
  /** True where walls and curbs must be left out (junction openings). */
  openAt: (point: Vec2) => boolean
}

/**
 * Points to draw a branch from. Its own polyline normally; resampled finely when it has stairs
 * (so each riser is a sharp step) or a gap (so the road ends where the ground does).
 */
export function branchSamples(track: Track, branch: TrackBranch, index: number): readonly Vec2[] {
  const gapped = track.jumps.some((jump) => jump.gap?.branch === index)
  const stepped = (branch.steps ?? 0) > 0
  if (!gapped && !stepped) return branch.points
  const spacing = stepped ? STEP_SAMPLE_SPACING : GAP_SAMPLE_SPACING
  const samples: Vec2[] = []
  for (let i = 0; i + 1 < branch.points.length; i++) {
    const a = branch.points[i]
    const b = branch.points[i + 1]
    if (!a || !b) continue
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / spacing))
    for (let k = 0; k < count; k++) {
      const t = k / count
      samples.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
    }
  }
  const last = branch.points[branch.points.length - 1]
  if (last) samples.push({ x: last.x, z: last.z })
  return samples
}

export function pathPoint(path: Path, i: number): Vec2 {
  const count = path.points.length
  const index = path.closed ? ((i % count) + count) % count : Math.min(Math.max(i, 0), count - 1)
  const point = path.points[index]
  if (!point) throw new Error(`Missing path point ${i}`)
  return point
}

export function segmentCount(path: Path): number {
  return path.closed ? path.points.length : path.points.length - 1
}

export function sideAt(path: Path, i: number): Vec2 {
  const before = pathPoint(path, i - 1)
  const after = pathPoint(path, i + 1)
  const dx = after.x - before.x
  const dz = after.z - before.z
  const length = Math.hypot(dx, dz) || 1
  return { x: dz / length, z: -dx / length }
}

export function offsetPath(path: Path, offset: number): Vec2[] {
  return Array.from({ length: segmentCount(path) + 1 }, (_, i) => {
    const point = pathPoint(path, i)
    const side = sideAt(path, i)
    return { x: point.x + side.x * offset, z: point.z + side.z * offset }
  })
}

/** True if the middle of segment `i` of the path lies over a jump gap. */
export function overGap(track: Track, path: Path, i: number): boolean {
  const a = pathPoint(path, i)
  const b = pathPoint(path, i + 1)
  return track.inGap((a.x + b.x) / 2, (a.z + b.z) / 2)
}

/** The closed main loop as a path. */
export function createMainPath(track: Track): Path {
  return {
    points: track.centerline,
    closed: true,
    halfWidth: track.halfWidth,
    // A tidal branch overlapping the junction must not bake the tide into the main road
    surfaceAt: (i) => {
      const p = track.point(i)
      const projection = track.project(p.x, p.z)
      const tidal = track.branches[projection.branch]?.tide
      return tidal ? 'asphalt' : track.surfaceAt(p.x, p.z)
    },
    // Leave the road open where a branch joins it
    openAt: (p) => {
      const projection = track.project(p.x, p.z)
      return projection.branch >= 0 && projection.distance <= projection.halfWidth
    },
  }
}

/** A branch as a path; `points` overrides the samples (e.g. a denser resampling). */
export function createBranchPath(
  track: Track,
  branch: TrackBranch,
  index: number,
  points: readonly Vec2[] = branchSamples(track, branch, index),
): Path {
  return {
    points,
    closed: false,
    halfWidth: branch.halfWidth,
    surfaceAt: () => branch.surface,
    // Leave the branch open where it meets the main road
    openAt: (p) => track.mainProjection(p.x, p.z).distance <= track.halfWidth,
  }
}

/** Points of an open polyline every `spacing` meters or less, keeping its corners. */
export function resamplePolyline(points: readonly Vec2[], spacing: number): Vec2[] {
  const samples: Vec2[] = []
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i]
    const b = points[i + 1]
    if (!a || !b) continue
    const count = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / spacing))
    for (let k = 0; k < count; k++) {
      const t = k / count
      samples.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
    }
  }
  const last = points[points.length - 1]
  if (last) samples.push({ x: last.x, z: last.z })
  return samples
}
