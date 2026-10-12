import type { KartPhysicsConfig } from '../../config/kartPhysics'
import { headingOf, lerpAngle, type Vec2 } from '../math'
import type { Track } from '../track'
import type { KartState } from './kartState'

/**
 * Keeps the kart between the walls. On contact it:
 * - pushes the kart back inside,
 * - bounces part of the into-wall speed,
 * - scrubs along-wall speed in proportion to the impact,
 * - turns the kart to run along the wall on glancing hits, so it scrapes instead of sticking.
 * Returns true if the kart touched a wall.
 */
export function resolveTrackCollision(
  state: KartState,
  track: Track,
  config: KartPhysicsConfig,
  dt: number,
): boolean {
  const limit = track.halfWidth - config.radius
  const { closest, distance, normal } = track.project(state.position.x, state.position.z)
  if (distance <= limit) return false

  state.position.x = closest.x + normal.x * limit
  state.position.z = closest.z + normal.z * limit

  const intoWall = state.velocity.x * normal.x + state.velocity.z * normal.z
  if (intoWall > 0) {
    const alongX = state.velocity.x - normal.x * intoWall
    const alongZ = state.velocity.z - normal.z * intoWall
    const alongSpeed = Math.hypot(alongX, alongZ)
    const keep =
      alongSpeed > 0 ? Math.max(0, alongSpeed - config.wallFriction * intoWall) / alongSpeed : 0
    state.velocity.x = alongX * keep - normal.x * intoWall * config.wallBounce
    state.velocity.z = alongZ * keep - normal.z * intoWall * config.wallBounce
  }

  alignWithWall(state, normal, config, dt)
  return true
}

/** Rotates the heading toward the wall direction closest to where the kart points. */
function alignWithWall(
  state: KartState,
  normal: Vec2,
  config: KartPhysicsConfig,
  dt: number,
): void {
  const forwardX = Math.sin(state.heading)
  const forwardZ = Math.cos(state.heading)
  const facingWall = forwardX * normal.x + forwardZ * normal.z
  // Head-on hits only bounce; glancing ones slide along the wall
  if (facingWall <= 0 || facingWall > Math.sin(config.wallAlignMaxAngle)) return

  const side = forwardX * -normal.z + forwardZ * normal.x >= 0 ? 1 : -1
  const wallHeading = headingOf(-normal.z * side, normal.x * side)
  const t = 1 - Math.exp(-config.wallAlignRate * dt)
  state.heading = lerpAngle(state.heading, wallHeading, t)
}
