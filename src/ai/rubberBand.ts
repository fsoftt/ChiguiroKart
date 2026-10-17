import { clamp } from '../sim/math'
import type { RubberBandConfig } from '../config/bots'

/**
 * Speed factor for a bot given its gap to the reference racer (m, positive = bot ahead).
 * Linear from 1 at the dead zone to `1 + maxBonus` (far behind) or `1 - maxPenalty` (far ahead).
 */
export function rubberBandFactor(gap: number, config: RubberBandConfig): number {
  if (!config.enabled) return 1
  const span = Math.max(config.fullGap - config.deadZone, 1e-6)
  const strength = clamp((Math.abs(gap) - config.deadZone) / span, 0, 1)
  return gap < 0 ? 1 + config.maxBonus * strength : 1 - config.maxPenalty * strength
}
