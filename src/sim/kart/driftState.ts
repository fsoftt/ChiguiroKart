/**
 * Shared contract for stage 2 (drift, nitro chain, jumps).
 * The simulation writes these fields; the HUD and visual effects only read them.
 */

/** -1 drifting left, 1 drifting right, 0 not drifting. */
export type DriftDirection = -1 | 0 | 1

/** 0 = no nitro, 1..3 = nitro level (each stronger than the previous). */
export type NitroLevel = 0 | 1 | 2 | 3

export const MAX_NITROS_PER_DRIFT = 3

export interface DriftState {
  direction: DriftDirection
  /** Charge bar, 0..1. The red zone is defined in the drift config. */
  charge: number
  /** Nitros already fired during the current drift, 0..3. */
  nitrosInChain: number
  /** True after a mistimed nitro or overcharge; no more nitros until the next drift. */
  chainBroken: boolean
  /** Seconds the bar has stayed full; the chain breaks past the overcharge grace. */
  overchargeTime: number
}

export interface BoostState {
  /** Level of the nitro currently active. */
  level: NitroLevel
  /** Seconds of boost left, including stored reserve. */
  timeLeft: number
  /** True if the current nitro was fired with perfect timing. */
  perfect: boolean
}

export function createDriftState(): DriftState {
  return { direction: 0, charge: 0, nitrosInChain: 0, chainBroken: false, overchargeTime: 0 }
}

export function createBoostState(): BoostState {
  return { level: 0, timeLeft: 0, perfect: false }
}
