import type { DriftConfig } from '../../config/drift'
import type { HazardsConfig } from '../../config/hazards'
import { addBoost } from '../kart/boost'
import type { KartState } from '../kart/kartState'
import { forwardOf, rightOf, type Vec2 } from '../math'
import type { BoostPad, Track } from '../track'

/** True if the point is inside the pad rectangle (`length` along its heading, `width` across). */
export function insidePad(pad: BoostPad, point: Vec2): boolean {
  const dx = point.x - pad.position.x
  const dz = point.z - pad.position.z
  const forward = forwardOf(pad.heading)
  const right = rightOf(pad.heading)
  return (
    Math.abs(dx * forward.x + dz * forward.z) <= pad.length / 2 &&
    Math.abs(dx * right.x + dz * right.z) <= pad.width / 2
  )
}

/**
 * Gives a short level 1 nitro to a kart on the ground over a pad. The boost is refreshed, not
 * added, and a stronger nitro that is already burning keeps its level. Returns true on a pad.
 */
export function applyBoostPads(
  kart: KartState,
  track: Track,
  drift: DriftConfig,
  config: HazardsConfig,
): boolean {
  if (!kart.onGround) return false
  if (!track.boostPads.some((pad) => insidePad(pad, kart.position))) return false
  const boost = kart.boost
  const duration = config.pad.boostDuration
  if (boost.level === 0) {
    addBoost(kart, 1, duration, false, drift)
  } else {
    boost.timeLeft = Math.max(boost.timeLeft, duration)
  }
  return true
}
