import { headingOf, type Vec2, type Vec3 } from './math'
import type { Checkpoint } from './race/checkpoint'
import type { SurfaceType } from './race/surface'

/** Open side road whose first and last points lie on the main road (e.g. a shortcut). */
export interface TrackBranch {
  name: string
  /** Polyline in driving order; first and last points lie on the main road. */
  points: readonly Vec2[]
  /** Distance from the branch polyline to each of its walls (m). */
  halfWidth: number
  surface: SurfaceType
}

export interface TrackDefinition {
  name: string
  /** Closed loop of points along the middle of the road, in driving order. */
  centerline: readonly Vec2[]
  /** Distance from the centerline to each wall (m). */
  halfWidth: number
  /** Optional custom ground height at position (x, z). Flat (0) if omitted. */
  groundHeight?: (x: number, z: number) => number
  /** Optional side roads (shortcuts) that leave and rejoin the main loop. */
  branches?: readonly TrackBranch[]
  /** Optional checkpoints. Automatically generated along centerline if omitted. */
  checkpoints?: readonly Checkpoint[]
  /** Optional surface lookup at position (x, z). Defaults to asphalt inside road, grass outside. */
  surfaceAt?: (x: number, z: number) => SurfaceType
}

export interface TrackProjection {
  /** Closest point on the centerline of the chosen piece (main loop or branch). */
  closest: Vec2
  /** Distance from that centerline (m), always >= 0. */
  distance: number
  /** Unit vector from the centerline toward the projected point. Zero if on the line. */
  normal: Vec2
  /** Corridor half-width of the chosen piece (m). Drivable iff distance <= halfWidth. */
  halfWidth: number
  /** -1 for the main loop, otherwise the index into `Track.branches`. */
  branch: number
}

export interface Pose {
  position: Vec3
  heading: number
}

const MIN_POINTS = 3
const DEFAULT_CHECKPOINT_COUNT = 8

/** Road geometry and race landmarks for the simulation: no rendering concerns. */
export class Track {
  readonly name: string
  readonly centerline: readonly Vec2[]
  readonly halfWidth: number
  readonly branches: readonly TrackBranch[]
  readonly checkpoints: readonly Checkpoint[]
  private readonly customGroundHeight?: ((x: number, z: number) => number) | undefined
  private readonly customSurfaceAt?: ((x: number, z: number) => SurfaceType) | undefined

  constructor(definition: TrackDefinition) {
    if (definition.centerline.length < MIN_POINTS) {
      throw new RangeError(`A track needs at least ${MIN_POINTS} centerline points`)
    }
    this.name = definition.name
    this.centerline = definition.centerline
    this.halfWidth = definition.halfWidth
    this.branches = definition.branches ?? []
    this.customGroundHeight = definition.groundHeight
    this.customSurfaceAt = definition.surfaceAt

    this.checkpoints = definition.checkpoints ?? this.generateDefaultCheckpoints()
  }

  /** Point `index` of the loop; wraps around in both directions. */
  point(index: number): Vec2 {
    const count = this.centerline.length
    const point = this.centerline[((index % count) + count) % count]
    if (!point) throw new Error(`Missing centerline point ${index}`)
    return point
  }

  /** Ground height at a position. */
  groundHeight(x: number, z: number): number {
    if (this.customGroundHeight) {
      return this.customGroundHeight(x, z)
    }
    return 0
  }

  /** Surface type at a position. */
  surfaceAt(x: number, z: number): SurfaceType {
    if (this.customSurfaceAt) {
      return this.customSurfaceAt(x, z)
    }
    const proj = this.project(x, z)
    if (proj.distance > proj.halfWidth) return 'grass'
    const branch = this.branches[proj.branch]
    return branch ? branch.surface : 'asphalt'
  }

  /** Where karts spawn: the first centerline point, facing along the road. */
  startPose(): Pose {
    const start = this.point(0)
    const next = this.point(1)
    return {
      position: { x: start.x, y: this.groundHeight(start.x, start.z), z: start.z },
      heading: headingOf(next.x - start.x, next.z - start.z),
    }
  }

  /** Projection onto the main loop only, ignoring branches. */
  mainProjection(x: number, z: number): TrackProjection {
    let best = emptyProjection(x, z, this.halfWidth, -1)
    for (let i = 0; i < this.centerline.length; i++) {
      best = nearer(best, x, z, this.point(i), this.point(i + 1), this.halfWidth, -1)
    }
    return best
  }

  /**
   * Projection onto the piece (main loop or branch) the position is most inside of,
   * i.e. the one minimizing `distance - halfWidth`. Drivable iff `distance <= halfWidth`.
   */
  project(x: number, z: number): TrackProjection {
    let best = this.mainProjection(x, z)
    this.branches.forEach((branch, index) => {
      // Branches are open: no segment from the last point back to the first
      for (let i = 0; i + 1 < branch.points.length; i++) {
        const a = branch.points[i]
        const b = branch.points[i + 1]
        if (!a || !b) continue
        best = nearer(best, x, z, a, b, branch.halfWidth, index)
      }
    })
    return best
  }

  private generateDefaultCheckpoints(): Checkpoint[] {
    const numCheckpoints = Math.min(DEFAULT_CHECKPOINT_COUNT, this.centerline.length)
    const step = Math.floor(this.centerline.length / numCheckpoints)
    const checkpoints: Checkpoint[] = []

    for (let i = 0; i < numCheckpoints; i++) {
      const ptIndex = i * step
      const p = this.point(ptIndex)
      const next = this.point(ptIndex + 1)
      const dx = next.x - p.x
      const dz = next.z - p.z
      const len = Math.hypot(dx, dz) || 1
      checkpoints.push({
        index: i,
        position: { x: p.x, z: p.z },
        forward: { x: dx / len, z: dz / len },
        width: this.halfWidth * 2,
        mandatory: true,
      })
    }
    return checkpoints
  }
}

function emptyProjection(x: number, z: number, halfWidth: number, branch: number): TrackProjection {
  return { closest: { x, z }, distance: Infinity, normal: { x: 0, z: 0 }, halfWidth, branch }
}

/** Returns `best`, or the projection onto segment a-b if that is more inside its corridor. */
function nearer(
  best: TrackProjection,
  x: number,
  z: number,
  a: Vec2,
  b: Vec2,
  halfWidth: number,
  branch: number,
): TrackProjection {
  const closest = closestOnSegment(x, z, a, b)
  const dx = x - closest.x
  const dz = z - closest.z
  const distance = Math.hypot(dx, dz)
  if (distance - halfWidth >= best.distance - best.halfWidth) return best
  const normal = distance > 0 ? { x: dx / distance, z: dz / distance } : { x: 0, z: 0 }
  return { closest, distance, normal, halfWidth, branch }
}

function closestOnSegment(x: number, z: number, a: Vec2, b: Vec2): Vec2 {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const lengthSquared = abx * abx + abz * abz
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(Math.max(((x - a.x) * abx + (z - a.z) * abz) / lengthSquared, 0), 1)
  return { x: a.x + abx * t, z: a.z + abz * t }
}
