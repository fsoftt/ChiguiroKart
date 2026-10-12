import { headingOf, type Vec2, type Vec3 } from './math'
import type { Checkpoint } from './race/checkpoint'
import type { SurfaceType } from './race/surface'

export interface TrackDefinition {
  name: string
  /** Closed loop of points along the middle of the road, in driving order. */
  centerline: readonly Vec2[]
  /** Distance from the centerline to each wall (m). */
  halfWidth: number
  /** Optional custom ground height at position (x, z). Flat (0) if omitted. */
  groundHeight?: (x: number, z: number) => number
  /** Optional checkpoints. Automatically generated along centerline if omitted. */
  checkpoints?: readonly Checkpoint[]
  /** Optional surface lookup at position (x, z). Defaults to asphalt inside road, grass outside. */
  surfaceAt?: (x: number, z: number) => SurfaceType
}

export interface TrackProjection {
  /** Closest point on the centerline. */
  closest: Vec2
  /** Distance from the centerline (m), always >= 0. */
  distance: number
  /** Unit vector from the centerline toward the projected point. Zero if on the line. */
  normal: Vec2
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
    return proj.distance <= this.halfWidth ? 'asphalt' : 'grass'
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

  project(x: number, z: number): TrackProjection {
    let best: TrackProjection = { closest: { x, z }, distance: Infinity, normal: { x: 0, z: 0 } }
    for (let i = 0; i < this.centerline.length; i++) {
      const closest = closestOnSegment(x, z, this.point(i), this.point(i + 1))
      const dx = x - closest.x
      const dz = z - closest.z
      const distance = Math.hypot(dx, dz)
      if (distance < best.distance) {
        const normal = distance > 0 ? { x: dx / distance, z: dz / distance } : { x: 0, z: 0 }
        best = { closest, distance, normal }
      }
    }
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
