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
  /** Upward speed of the hop that starts a drift (m/s). Air time is 2 * hopSpeed / gravity. */
  hopSpeed: number
  /** Slowest forward speed (m/s) at which a drift can start or continue. */
  minDriftSpeed: number
  /** Steer magnitude (0..1) needed at landing to start a drift. */
  driftSteerThreshold: number
  /** Turn input (0..1) the kart keeps toward the drift side with the stick centered. */
  driftBaseTurn: number
  /** How much steering moves the turn input: with the drift tightens, against it widens. */
  driftSteerInfluence: number
  /** Smallest turn input while drifting, so steering against it never reverses the drift. */
  driftMinTurn: number
  /** Lateral grip while drifting (1/s); lower than normal so the kart slides. */
  driftLateralGrip: number
  /** Acceleration toward the boosted top speed (m/s²). */
  boostAcceleration: number
  /** Shortest airtime (s) that earns a landing boost. */
  landingBoostMinAirTime: number
  /** Landing boost seconds earned per second of airtime. */
  landingBoostPerAirSecond: number
  /** Most boost seconds a single landing can give. */
  landingBoostMaxDuration: number
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
  hopSpeed: 3.75,
  minDriftSpeed: 8,
  driftSteerThreshold: 0.3,
  driftBaseTurn: 0.6,
  driftSteerInfluence: 0.4,
  driftMinTurn: 0.2,
  driftLateralGrip: 3,
  boostAcceleration: 60,
  landingBoostMinAirTime: 0.6,
  landingBoostPerAirSecond: 0.8,
  landingBoostMaxDuration: 2,
  levels: [
    { speedBonus: 0.15, duration: 0.8, color: '#ffd23f' },
    { speedBonus: 0.25, duration: 1.0, color: '#ff8c1a' },
    { speedBonus: 0.35, duration: 1.2, color: '#3fa9ff' },
  ],
  smokeColors: ['#bbbbbb', '#ffd23f', '#ff8c1a', '#ff3b30'],
  brokenSmokeColor: '#222222',
}
