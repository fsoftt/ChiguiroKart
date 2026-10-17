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
  /** If set, the surface changes with the tide instead of being `surface` (San Andrés). */
  tide?: TideRule
  /**
   * Ground height at each point of `points` (m), piecewise linear by arc length. Without it
   * the branch ramps linearly between the road heights at its two ends.
   */
  heights?: readonly number[]
  /** If set, the height profile is quantized into this many flat treads with sharp risers. */
  steps?: number
}

/**
 * A branch that floods and dries with the tide. The leader's current lap (1-based) decides:
 * on `lowLaps` the tide is low and the branch is `lowSurface` (a fast sandbank), otherwise
 * it is `highSurface` (slow water).
 */
export interface TideRule {
  lowLaps: readonly number[]
  lowSurface: SurfaceType
  highSurface: SurfaceType
}

/** Turbo strip on the road: a kart that drives over it on the ground gets a short nitro. */
export interface BoostPad {
  /** Center of the strip (x, z). */
  position: Vec2
  /** Direction of travel the strip points to (rad, same convention as `headingOf`). */
  heading: number
  /** Size along the heading (m). */
  length: number
  /** Size across the heading (m). */
  width: number
}

/** A stretch of missing ground: `from`..`to` metres along the main loop or along a branch. */
export interface GapZone {
  /** -1 for the main loop, otherwise the index into `Track.branches`. */
  branch: number
  /** Arc length (m) where the gap starts, measured from the start of its piece. */
  from: number
  /** Arc length (m) where the gap ends. */
  to: number
}

/**
 * A launch ramp: a grounded kart inside the lip zone (`length` metres right before `position`,
 * the full road width) that moves along `heading` is thrown up at `launchSpeed`. Past the lip
 * the ground may be missing (`gap`), so a kart that is too slow falls in and respawns.
 */
export interface Jump {
  /** Center of the lip edge (x, z), where the ground ends or the ramp tops out. */
  position: Vec2
  /** Direction of travel over the lip (rad, same convention as `headingOf`). */
  heading: number
  /** Half the width of the lip zone across the heading (m). */
  halfWidth: number
  /** Size of the lip zone along the heading, counted back from `position` (m). */
  length: number
  /** Vertical speed given to the kart (m/s). */
  launchSpeed: number
  /** Resolved missing ground right after the lip, if any. */
  gap?: GapZone
}

/**
 * Obstacles that belong to a track (not to a power):
 * - `herd`: cattle crossing the road (Llanos stampede); touching one spins the kart.
 * - `float`: a big carnival float driving along the road (Barranquilla); bumps karts away.
 * - `iceWall`: static wall closing a shortcut (Nevado ice tunnel); bumps karts away, but a
 *   kart on a level 3 nitro breaks it and the shortcut stays open for a while.
 * - `rock`: static boulder; bumps karts away.
 */
export type HazardKind = 'herd' | 'float' | 'iceWall' | 'rock'

export interface HazardDefinition {
  kind: HazardKind
  /** Path the obstacles follow (x, z). A single point means a static obstacle. */
  path: readonly Vec2[]
  /** `loop`: around the closed path; `pingPong`: back and forth between its ends. */
  motion: 'loop' | 'pingPong'
  /** Speed along the path (m/s); 0 = static. */
  speed: number
  /** Number of obstacles, evenly spaced along the path. */
  count: number
  /** Contact radius of each obstacle (m). */
  radius: number
  /** Seconds the obstacles wait at each end of a `pingPong` path. */
  pause?: number
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
  /** Optional power box spots (x, z); the item system lifts them to the ground. */
  itemBoxes?: readonly Vec2[]
  /** Optional uchuva spots (x, z). */
  uchuvas?: readonly Vec2[]
  /** Optional turbo strips. */
  boostPads?: readonly BoostPad[]
  /** Optional launch ramps (see `Jump`). */
  jumps?: readonly Jump[]
  /**
   * Ground height ignoring gaps: what the road surface would be there. Used for drawing and for
   * things that must not fall into a gap. Defaults to `groundHeight`.
   */
  roadHeight?: (x: number, z: number) => number
  /** True where there is no ground (inside a jump gap). */
  gapAt?: (x: number, z: number) => boolean
  /** Optional track obstacles (cattle, floats, ice walls, rocks). */
  hazards?: readonly HazardDefinition[]
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
  /** Length of the closed main loop (m). */
  readonly loopLength: number
  readonly branches: readonly TrackBranch[]
  readonly checkpoints: readonly Checkpoint[]
  /** Power box spots (x, z). */
  readonly itemBoxes: readonly Vec2[]
  /** Uchuva spots (x, z). */
  readonly uchuvas: readonly Vec2[]
  readonly boostPads: readonly BoostPad[]
  readonly jumps: readonly Jump[]
  readonly hazards: readonly HazardDefinition[]
  /**
   * True while the tide is low (see `TideRule`). Race state, not geometry: the race code sets
   * it every step with `setTideLow`, and `surfaceAt` reads it for tidal branches.
   */
  tideLow = false
  private readonly customGroundHeight?: ((x: number, z: number) => number) | undefined
  private readonly customRoadHeight?: ((x: number, z: number) => number) | undefined
  private readonly customGapAt?: ((x: number, z: number) => boolean) | undefined
  private readonly customSurfaceAt?: ((x: number, z: number) => SurfaceType) | undefined

  constructor(definition: TrackDefinition) {
    if (definition.centerline.length < MIN_POINTS) {
      throw new RangeError(`A track needs at least ${MIN_POINTS} centerline points`)
    }
    this.name = definition.name
    this.centerline = definition.centerline
    this.halfWidth = definition.halfWidth
    this.loopLength = loopLengthOf(definition.centerline)
    this.branches = definition.branches ?? []
    this.itemBoxes = definition.itemBoxes ?? []
    this.uchuvas = definition.uchuvas ?? []
    this.boostPads = definition.boostPads ?? []
    this.jumps = definition.jumps ?? []
    this.hazards = definition.hazards ?? []
    this.customGroundHeight = definition.groundHeight
    this.customRoadHeight = definition.roadHeight
    this.customGapAt = definition.gapAt
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

  /** Ground height ignoring jump gaps (the road surface as if it were whole). */
  roadHeight(x: number, z: number): number {
    return this.customRoadHeight ? this.customRoadHeight(x, z) : this.groundHeight(x, z)
  }

  /** True if (x, z) is over a jump gap, where `groundHeight` is the deep gap floor. */
  inGap(x: number, z: number): boolean {
    return this.customGapAt ? this.customGapAt(x, z) : false
  }

  /** Surface type at a position. Tidal branches follow `tideLow`, even with a custom lookup. */
  surfaceAt(x: number, z: number): SurfaceType {
    if (this.hasTide) {
      const proj = this.project(x, z)
      const tide = this.branches[proj.branch]?.tide
      if (tide && proj.distance <= proj.halfWidth) {
        return this.tideLow ? tide.lowSurface : tide.highSurface
      }
    }
    if (this.customSurfaceAt) {
      return this.customSurfaceAt(x, z)
    }
    const proj = this.project(x, z)
    if (proj.distance > proj.halfWidth) return 'grass'
    const branch = this.branches[proj.branch]
    return branch ? branch.surface : 'asphalt'
  }

  /** True if any branch follows the tide. */
  get hasTide(): boolean {
    return this.branches.some((branch) => branch.tide !== undefined)
  }

  setTideLow(low: boolean): void {
    this.tideLow = low
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

function loopLengthOf(points: readonly Vec2[]): number {
  let length = 0
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length]
    if (b) length += Math.hypot(b.x - a.x, b.z - a.z)
  })
  return length
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
