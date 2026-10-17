import type { ItemsConfig } from '../../config/items'
import type { RacerItems } from './itemTypes'

/** How the status effects of a racer change its driving this step. */
export interface StatusModifiers {
  /** Multiplies top speed and acceleration. */
  speedFactor: number
  /** Multiplies the lateral grip. */
  gripFactor: number
  /** Added to the steering (Bien Cargado mosquitos). */
  steerOffset: number
  /** True if the kart has no control (hit reaction). */
  noControl: boolean
}

/** Pure: reads the racer's items and the config, returns the driving modifiers. */
export function statusModifiers(items: RacerItems, config: ItemsConfig): StatusModifiers {
  const { status, uchuvas } = items
  const { powers, hit } = config
  let speedFactor = 1 + uchuvas * config.uchuvas.speedBonusPerUchuva
  if (status.dizzyTime > 0) speedFactor *= hit.dizzySpeedFactor
  if (status.maskTime > 0) speedFactor *= 1 + powers.mascara.speedBonus
  if (status.rainTime > 0 && status.slowed) speedFactor *= powers.aguacero.chargedSpeedFactor

  const gripFactor = status.rainTime > 0 ? powers.aguacero.gripFactor : 1
  const weaving = status.blindTime > 0 && status.zigzag
  const steerOffset = weaving
    ? powers.mosquitos.zigzagAmplitude *
      Math.sin(status.blindTime * powers.mosquitos.zigzagFrequency)
    : 0
  return { speedFactor, gripFactor, steerOffset, noControl: status.hit !== null }
}
