/**
 * Drift and nitro tuning. Shared by the simulation (rules), the HUD (bar, red zone)
 * and visual effects (colors). Values from docs/diseno.md §4.3, to be tuned in play tests.
 */

export interface NitroLevelConfig {
  /** Extra top speed as a fraction of maxSpeed (0.15 = +15 %). */
  speedBonus: number
  /** Seconds the nitro lasts. */
  duration: number
  /** Exhaust flame color. */
  color: string
}

export interface DriftConfig {
  /** Start of the red zone on the charge bar, 0..1. Firing before it breaks the chain. */
  redZoneStart: number
  /** Firing within this distance after redZoneStart counts as perfect. */
  perfectWindow: number
  /** Extra speed bonus for a perfect nitro (fraction of maxSpeed). */
  perfectBonus: number
  /** Seconds the bar can stay full before the chain breaks. */
  overchargeGrace: number
  /** Bar fill speed (1/s). */
  chargeRate: number
  /** Most boost time that can be stored by chaining nitros (s). */
  maxReserve: number
  /** Nitro levels 1..3, in chain order. */
  levels: readonly [NitroLevelConfig, NitroLevelConfig, NitroLevelConfig]
  /** Smoke color while charging, from empty to red zone. */
  smokeColors: readonly string[]
  /** Smoke color after the chain breaks. */
  brokenSmokeColor: string
}

export const defaultDrift: DriftConfig = {
  redZoneStart: 0.75,
  perfectWindow: 0.06,
  perfectBonus: 0.05,
  overchargeGrace: 0.35,
  chargeRate: 0.9,
  maxReserve: 3,
  levels: [
    { speedBonus: 0.15, duration: 0.8, color: '#ffd23f' },
    { speedBonus: 0.25, duration: 1.0, color: '#ff8c1a' },
    { speedBonus: 0.35, duration: 1.2, color: '#3fa9ff' },
  ],
  smokeColors: ['#bbbbbb', '#ffd23f', '#ff8c1a', '#ff3b30'],
  brokenSmokeColor: '#222222',
}
