import type { DriftConfig } from '../../config/drift'
import type { NitroLevel } from './driftState'
import type { KartState } from './kartState'

/** Adds boost time (capped at the reserve) and makes `level` the active nitro. */
export function addBoost(
  state: KartState,
  level: Exclude<NitroLevel, 0>,
  duration: number,
  perfect: boolean,
  config: DriftConfig,
): void {
  const boost = state.boost
  boost.timeLeft = Math.min(boost.timeLeft + duration, config.maxReserve)
  boost.level = level
  boost.perfect = perfect
}

/** Counts the boost down; when it runs out the level returns to 0. */
export function tickBoost(state: KartState, dt: number): void {
  const boost = state.boost
  if (boost.level === 0) return
  boost.timeLeft = Math.max(boost.timeLeft - dt, 0)
  if (boost.timeLeft > 0) return
  boost.level = 0
  boost.perfect = false
}

/** Extra top speed of the active boost as a fraction of maxSpeed (0 when not boosting). */
export function boostSpeedBonus(state: KartState, config: DriftConfig): number {
  const { level, perfect } = state.boost
  if (level === 0) return 0
  return config.levels[level - 1].speedBonus + (perfect ? config.perfectBonus : 0)
}

/** Gives a boost proportional to the airtime of the jump just finished. */
export function applyLandingBoost(state: KartState, config: DriftConfig): void {
  if (state.airTime < config.landingBoostMinAirTime) return
  const duration = Math.min(
    state.airTime * config.landingBoostPerAirSecond,
    config.landingBoostMaxDuration,
  )
  // Never downgrade a stronger nitro that is still burning
  const level = Math.max(state.boost.level, 1) as Exclude<NitroLevel, 0>
  addBoost(state, level, duration, state.boost.perfect, config)
}
