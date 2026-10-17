import { headingOf, type Vec2 } from '../sim/math'
import type { Track } from '../sim/track'

/** Where a bot is on its route: the main loop (branch -1) or a branch, at the segment index..index+1. */
export interface RouteCursor {
  branch: number
  index: number
}

export interface RoutePoint {
  point: Vec2
  /** Heading of the segment the point lies on. */
  heading: number
}

/** Main-loop indices where a branch leaves and rejoins the road. */
export interface Junction {
  startIndex: number
  endIndex: number
}

const MAX_WALK_STEPS = 400
/** Segments past a branch start within which a bot with that branch planned turns onto it. */
const ENTER_SEGMENTS = 4

/**
 * The paths a bot can follow: the main loop and its branches. Tracks the bot's progress along
 * them locally (so it never jumps to a nearby stretch of road, e.g. across a hairpin) and
 * measures points and headings ahead, continuing from a branch end onto the main loop.
 */
export class Route {
  readonly junctions: readonly Junction[]
  /** Distance along the main loop at each centerline point (m). */
  private readonly cumulative: number[] = []
  readonly loopLength: number

  constructor(private readonly track: Track) {
    let total = 0
    for (let i = 0; i < track.centerline.length; i++) {
      this.cumulative.push(total)
      const a = track.point(i)
      const b = track.point(i + 1)
      total += Math.hypot(b.x - a.x, b.z - a.z)
    }
    this.loopLength = total
    this.junctions = track.branches.map((branch) => {
      const first = branch.points[0]
      const last = branch.points[branch.points.length - 1]
      if (!first || !last) throw new Error(`Branch ${branch.name} has no points`)
      return { startIndex: this.nearestMainIndex(first), endIndex: this.nearestMainIndex(last) }
    })
  }

  /** Centerline point closest to a position (global search; use once to place a bot). */
  nearestMainIndex(position: Vec2): number {
    let best = 0
    let bestDistance = Infinity
    for (let i = 0; i < this.track.centerline.length; i++) {
      const p = this.track.point(i)
      const distance = Math.hypot(p.x - position.x, p.z - position.z)
      if (distance < bestDistance) {
        bestDistance = distance
        best = i
      }
    }
    return best
  }

  /** Meters along the main loop from main point `index` forward to main point `target`. */
  mainDistanceAhead(index: number, target: number): number {
    const count = this.track.centerline.length
    const from = this.cumulative[((index % count) + count) % count] ?? 0
    const to = this.cumulative[((target % count) + count) % count] ?? 0
    return (to - from + this.loopLength) % this.loopLength
  }

  /**
   * Moves the cursor to the nearest segment within `window` segments around it. If the bot is
   * on the main loop with a branch planned and reaches its start, it moves onto the branch;
   * at the end of a branch it moves back onto the main loop.
   */
  locate(
    cursor: RouteCursor,
    position: Vec2,
    plannedBranch: number,
    window: number,
    exitRadius: number,
  ): RouteCursor {
    if (cursor.branch >= 0) return this.locateOnBranch(cursor, position, window, exitRadius)
    const count = this.track.centerline.length
    let best = cursor.index
    let bestDistance = Infinity
    for (let step = -2; step <= window; step++) {
      const index = (((cursor.index + step) % count) + count) % count
      const distance = distanceToSegment(
        position,
        this.track.point(index),
        this.track.point(index + 1),
      )
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    }
    const junction = this.junctions[plannedBranch]
    if (junction) {
      const passed = (best - junction.startIndex + count) % count
      if (passed <= ENTER_SEGMENTS) return { branch: plannedBranch, index: 0 }
    }
    return { branch: -1, index: best }
  }

  private locateOnBranch(
    cursor: RouteCursor,
    position: Vec2,
    window: number,
    exitRadius: number,
  ): RouteCursor {
    const points = this.pointsOf(cursor.branch)
    const lastSegment = points.length - 2
    let best = cursor.index
    let bestDistance = Infinity
    const from = Math.max(cursor.index - 1, 0)
    const to = Math.min(cursor.index + window, lastSegment)
    for (let index = from; index <= to; index++) {
      const a = points[index]
      const b = points[index + 1]
      if (!a || !b) continue
      const distance = distanceToSegment(position, a, b)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    }
    const end = points[points.length - 1]
    const junction = this.junctions[cursor.branch]
    if (best === lastSegment && end && junction) {
      if (Math.hypot(end.x - position.x, end.z - position.z) < exitRadius) {
        return { branch: -1, index: junction.endIndex }
      }
    }
    return { branch: cursor.branch, index: best }
  }

  /**
   * Point `distance` meters ahead along the route, measured from the position's projection
   * on the current segment. Follows the planned branch if it leaves within that distance.
   */
  walk(cursor: RouteCursor, position: Vec2, plannedBranch: number, distance: number): RoutePoint {
    const count = this.track.centerline.length
    let branch = cursor.branch
    let index = cursor.index
    let [a, b] = this.segment(branch, index)
    let current = closestOnSegment(position, a, b)
    let remaining = distance

    for (let steps = 0; steps < MAX_WALK_STEPS; steps++) {
      const length = Math.hypot(b.x - current.x, b.z - current.z)
      if (remaining <= length) {
        const t = length > 0 ? remaining / length : 0
        return {
          point: { x: current.x + (b.x - current.x) * t, z: current.z + (b.z - current.z) * t },
          heading: headingOf(b.x - a.x, b.z - a.z),
        }
      }
      remaining -= length
      current = b
      if (branch >= 0) {
        const points = this.pointsOf(branch)
        if (index + 1 >= points.length - 1) {
          index = this.junctions[branch]?.endIndex ?? 0
          branch = -1
        } else {
          index++
        }
      } else {
        index = (index + 1) % count
        if (plannedBranch >= 0 && index === this.junctions[plannedBranch]?.startIndex) {
          branch = plannedBranch
          index = 0
        }
      }
      ;[a, b] = this.segment(branch, index)
    }
    return { point: b, heading: headingOf(b.x - a.x, b.z - a.z) }
  }

  /** Corridor half-width of the piece the cursor is on. */
  halfWidthAt(cursor: RouteCursor): number {
    return this.track.branches[cursor.branch]?.halfWidth ?? this.track.halfWidth
  }

  private pointsOf(branch: number): readonly Vec2[] {
    return this.track.branches[branch]?.points ?? this.track.centerline
  }

  private segment(branch: number, index: number): [Vec2, Vec2] {
    if (branch < 0) return [this.track.point(index), this.track.point(index + 1)]
    const points = this.pointsOf(branch)
    const a = points[index]
    const b = points[index + 1]
    if (!a || !b) throw new Error(`Missing branch segment ${branch}:${index}`)
    return [a, b]
  }
}

function closestOnSegment(p: Vec2, a: Vec2, b: Vec2): Vec2 {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const lengthSquared = abx * abx + abz * abz
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(Math.max(((p.x - a.x) * abx + (p.z - a.z) * abz) / lengthSquared, 0), 1)
  return { x: a.x + abx * t, z: a.z + abz * t }
}

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const c = closestOnSegment(p, a, b)
  return Math.hypot(p.x - c.x, p.z - c.z)
}
