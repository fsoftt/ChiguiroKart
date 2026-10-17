/** Per-kart tweaks that character perks apply inside `stepKart` (all neutral by default). */
export interface KartPerks {
  /** Multiplies the drift charge rate. */
  driftChargeFactor: number
  /** Multiplies the duration of every nitro fired from a drift. */
  nitroDurationFactor: number
  /** Multiplies the duration of the third nitro of a chain, on top of the factor above. */
  thirdNitroDurationFactor: number
  /** Multiplies gravity while airborne. */
  airGravityFactor: number
  /** Yaw rate (rad/s) at full steer while airborne; 0 = no air steering. */
  airSteerRate: number
  /** Multiplies the landing boost duration. */
  landingBoostFactor: number
}

export const NEUTRAL_KART_PERKS: KartPerks = {
  driftChargeFactor: 1,
  nitroDurationFactor: 1,
  thirdNitroDurationFactor: 1,
  airGravityFactor: 1,
  airSteerRate: 0,
  landingBoostFactor: 1,
}
