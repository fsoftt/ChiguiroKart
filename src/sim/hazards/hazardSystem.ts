import { defaultHazards, type HazardsConfig } from '../../config/hazards'
import { defaultKartPhysics, type KartPhysicsConfig } from '../../config/kartPhysics'
import { applyHit } from '../items/hits'
import { isRacing, type ItemContext } from '../items/itemContext'
import { headingOf, type Vec2 } from '../math'
import type { Racer } from '../racer'
import type { HazardDefinition, Track } from '../track'
import type { HazardObstacle } from './hazardTypes'
import { updateTide } from './tide'

/** A path with cumulative lengths, closed (back to its first point) for looping hazards. */
export interface PathInfo {
  points: readonly Vec2[]
  /** Length of the segment that starts at each point. */
  lengths: readonly number[]
  total: number
}

export interface PathSample {
  x: number
  z: number
  heading: number
}

interface HazardEntry {
  definition: HazardDefinition
  path: PathInfo
  obstacle: HazardObstacle
  /** Index of this obstacle among the `count` of its hazard. */
  instance: number
  /** Seconds until a broken ice wall tries to come back (0 while it stands). */
  brokenTimer: number
}

export function buildPath(definition: HazardDefinition): PathInfo {
  const points =
    definition.motion === 'loop' && definition.path.length > 1
      ? [...definition.path, ...definition.path.slice(0, 1)]
      : definition.path
  const lengths: number[] = []
  let total = 0
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]
    const b = points[i + 1]
    const length = a && b ? Math.hypot(b.x - a.x, b.z - a.z) : 0
    lengths.push(length)
    total += length
  }
  return { points, lengths, total }
}

/** Point and facing at distance `s` along the path (clamped to its ends). */
function sampleAlong(path: PathInfo, s: number, reverse: boolean): PathSample {
  const { points, lengths } = path
  const first = points[0] ?? { x: 0, z: 0 }
  let remaining = Math.max(0, Math.min(s, path.total))
  let heading = 0
  for (let i = 0; i < lengths.length; i++) {
    const a = points[i]
    const b = points[i + 1]
    const length = lengths[i] ?? 0
    if (!a || !b || length <= 0) continue
    heading = headingOf(b.x - a.x, b.z - a.z)
    if (remaining <= length) {
      const t = remaining / length
      return {
        x: a.x + (b.x - a.x) * t,
        z: a.z + (b.z - a.z) * t,
        heading: reverse ? heading + Math.PI : heading,
      }
    }
    remaining -= length
  }
  const last = points[points.length - 1] ?? first
  return { x: last.x, z: last.z, heading: reverse ? heading + Math.PI : heading }
}

function wrap(value: number, period: number): number {
  return ((value % period) + period) % period
}

/**
 * Where obstacle `instance` of a hazard is after `time` seconds of race, a pure function of
 * the time: `loop` runs around the closed path, `pingPong` goes back and forth waiting `pause`
 * seconds at each end. Obstacles are evenly spaced along the path (or along the cycle).
 */
export function hazardMotion(
  definition: HazardDefinition,
  path: PathInfo,
  instance: number,
  time: number,
): PathSample & { moving: boolean } {
  const count = Math.max(definition.count, 1)
  const fixed = definition.speed <= 0 || path.points.length < 2 || path.total <= 0
  if (fixed) {
    const share =
      definition.motion === 'loop' ? instance / count : instance / Math.max(count - 1, 1)
    return { ...sampleAlong(path, share * path.total, false), moving: false }
  }
  if (definition.motion === 'loop') {
    const s = wrap(definition.speed * time + (instance * path.total) / count, path.total)
    return { ...sampleAlong(path, s, false), moving: true }
  }
  const travel = path.total / definition.speed
  const pause = Math.max(definition.pause ?? 0, 0)
  const period = 2 * (travel + pause)
  const t = wrap(time + (instance * period) / count, period)
  if (t < travel) return { ...sampleAlong(path, t * definition.speed, false), moving: true }
  if (t < travel + pause) return { ...sampleAlong(path, path.total, false), moving: false }
  if (t < 2 * travel + pause) {
    const back = path.total - (t - travel - pause) * definition.speed
    return { ...sampleAlong(path, back, true), moving: true }
  }
  return { ...sampleAlong(path, 0, false), moving: false }
}

/**
 * The obstacles of a track (cattle, floats, ice walls, rocks) and the tide. Pure simulation:
 * motion depends only on the race time (counted from the end of the countdown), so it is
 * deterministic. Owned and stepped by `ItemSystem`; the renderer and the bots read `obstacles`.
 */
export class HazardSystem {
  /** One entry per obstacle, in hazard order; updated in place every step. */
  readonly obstacles: HazardObstacle[] = []
  private readonly entries: HazardEntry[] = []
  private elapsed = 0

  constructor(
    readonly track: Track,
    readonly config: HazardsConfig = defaultHazards,
    private readonly physics: KartPhysicsConfig = defaultKartPhysics,
  ) {
    track.hazards.forEach((definition, hazard) => {
      const path = buildPath(definition)
      for (let instance = 0; instance < Math.max(definition.count, 1); instance++) {
        const obstacle: HazardObstacle = {
          hazard,
          kind: definition.kind,
          position: { x: 0, y: 0, z: 0 },
          heading: 0,
          radius: definition.radius,
          active: true,
          moving: false,
        }
        this.entries.push({ definition, path, obstacle, instance, brokenTimer: 0 })
        this.obstacles.push(obstacle)
      }
    })
    this.place()
  }

  /** Race time (s) the obstacles have been running. */
  get time(): number {
    return this.elapsed
  }

  /** Obstacles back at their start, ice walls whole, tide as on lap 1. */
  reset(): void {
    this.elapsed = 0
    for (const entry of this.entries) {
      entry.obstacle.active = true
      entry.brokenTimer = 0
    }
    const rule = this.track.branches.find((branch) => branch.tide)?.tide
    if (rule) this.track.setTideLow(rule.lowLaps.includes(1))
    this.place()
  }

  /** One step: tide, obstacle motion, ice wall timers and kart contacts. */
  update(ctx: ItemContext, dt: number): void {
    updateTide(this.track, ctx.racers)
    if (ctx.racers.some((racer) => racer.race.state.phase !== 'countdown')) this.elapsed += dt
    this.place()
    for (const entry of this.entries) this.tickWall(ctx, entry, dt)
    for (const entry of this.entries) {
      if (!entry.obstacle.active) continue
      for (const racer of ctx.racers) {
        if (isRacing(racer)) this.touch(ctx, entry, racer)
      }
    }
  }

  private place(): void {
    for (const entry of this.entries) {
      const { obstacle, definition, path, instance } = entry
      const motion = hazardMotion(definition, path, instance, this.elapsed)
      obstacle.position.x = motion.x
      obstacle.position.z = motion.z
      obstacle.position.y = this.track.groundHeight(motion.x, motion.z)
      obstacle.heading = motion.heading
      // Everything waits in place until the race starts
      obstacle.moving = obstacle.active && motion.moving && this.elapsed > 0
    }
  }

  /** A broken ice wall waits, then closes again unless a kart stands in its place. */
  private tickWall(ctx: ItemContext, entry: HazardEntry, dt: number): void {
    const { obstacle } = entry
    if (obstacle.active) return
    entry.brokenTimer = Math.max(entry.brokenTimer - dt, 0)
    if (entry.brokenTimer > 0) return
    const reach = obstacle.radius + this.physics.kartRadius
    const occupied = ctx.racers.some(
      (racer) =>
        Math.hypot(
          racer.kart.position.x - obstacle.position.x,
          racer.kart.position.z - obstacle.position.z,
        ) < reach,
    )
    if (occupied) return
    obstacle.active = true
    ctx.emit({
      type: 'iceWallRestored',
      hazard: obstacle.hazard,
      position: { ...obstacle.position },
    })
  }

  private touch(ctx: ItemContext, entry: HazardEntry, racer: Racer): void {
    const { obstacle } = entry
    const kart = racer.kart
    const { contactHeight, breakLevel, iceWallRespawn, bumpEventSpeed } = this.config.obstacle
    if (Math.abs(kart.position.y - obstacle.position.y) > contactHeight) return
    const dx = kart.position.x - obstacle.position.x
    const dz = kart.position.z - obstacle.position.z
    const reach = obstacle.radius + this.physics.kartRadius
    const distance = Math.hypot(dx, dz)
    if (distance >= reach) return

    if (obstacle.kind === 'herd') {
      applyHit(ctx, racer, 'spin')
      return
    }
    if (obstacle.kind === 'iceWall' && kart.boost.level >= breakLevel && kart.boost.timeLeft > 0) {
      obstacle.active = false
      obstacle.moving = false
      entry.brokenTimer = iceWallRespawn
      ctx.emit({
        type: 'iceWallBroken',
        slot: racer.slot,
        hazard: obstacle.hazard,
        position: { ...obstacle.position },
      })
      return
    }

    // Bump: push the kart out of the circle and bounce it like a wall (see resolveTrackCollision)
    // Exactly coincident centers: pick an arbitrary but deterministic axis
    const nx = distance > 1e-6 ? dx / distance : 1
    const nz = distance > 1e-6 ? dz / distance : 0
    kart.position.x = obstacle.position.x + nx * reach
    kart.position.z = obstacle.position.z + nz * reach
    const into = -(kart.velocity.x * nx + kart.velocity.z * nz)
    if (into <= 0) return
    const alongX = kart.velocity.x + nx * into
    const alongZ = kart.velocity.z + nz * into
    const alongSpeed = Math.hypot(alongX, alongZ)
    const keep =
      alongSpeed > 0 ? Math.max(0, alongSpeed - this.physics.wallFriction * into) / alongSpeed : 0
    kart.velocity.x = alongX * keep + nx * into * this.physics.wallBounce
    kart.velocity.z = alongZ * keep + nz * into * this.physics.wallBounce
    if (into >= bumpEventSpeed) {
      ctx.emit({
        type: 'hazardBump',
        slot: racer.slot,
        kind: obstacle.kind,
        position: { ...kart.position },
      })
    }
  }
}
