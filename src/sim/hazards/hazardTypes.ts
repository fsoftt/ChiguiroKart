import type { Vec3 } from '../math'
import type { HazardKind } from '../track'

/**
 * Shared contract for track obstacles. `HazardSystem` (simulation) writes these every step;
 * the renderer and the bots only read them.
 */
export interface HazardObstacle {
  /** Index of the `HazardDefinition` in `Track.hazards` this obstacle belongs to. */
  hazard: number
  kind: HazardKind
  /** Position on the ground (y = ground height). */
  position: Vec3
  /** Facing (rad, `headingOf` convention): the direction it moves, or the path direction. */
  heading: number
  /** Contact radius (m). */
  radius: number
  /** False while it cannot be touched (a broken ice wall). */
  active: boolean
  /** True while it is moving (cattle running, a float driving); false while paused or static. */
  moving: boolean
}
