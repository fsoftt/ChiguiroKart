import {
  characterTuning,
  characters,
  type CharacterId,
  type CharacterStats,
  type CharacterTuning,
} from '../config/characters'
import type { KartPhysicsConfig } from '../config/kartPhysics'
import { NEUTRAL_KART_PERKS, type KartPerks } from './kart/kartPerks'
import { clamp, forwardOf } from './math'
import type { Racer } from './racer'
import type { SurfaceProperties, SurfaceType } from './race/surface'

/** Multiplier of one stat: 1 at the neutral value, `perPoint` per point away from it. */
export function statMultiplier(value: number, perPoint: number, neutral: number): number {
  return 1 + (value - neutral) * perPoint
}

/** The kart physics of a character: stats applied on top of the base config. Pure. */
export function characterPhysics(
  base: KartPhysicsConfig,
  stats: CharacterStats,
  tuning: CharacterTuning = characterTuning,
): KartPhysicsConfig {
  const t = tuning.stats
  const handling = statMultiplier(stats.handling, t.handlingPerPoint, t.neutral)
  return {
    ...base,
    maxSpeed: base.maxSpeed * statMultiplier(stats.speed, t.speedPerPoint, t.neutral),
    acceleration:
      base.acceleration * statMultiplier(stats.acceleration, t.accelerationPerPoint, t.neutral),
    turnRate: base.turnRate * handling,
    lateralGrip: base.lateralGrip * handling,
  }
}

/** Kart-vs-kart mass: 1 at neutral weight; the Oso's perk adds on top of its weight. */
export function characterMass(id: CharacterId, tuning: CharacterTuning = characterTuning): number {
  const t = tuning.stats
  const weight = characters[id].stats.weight
  const mass = Math.max(t.minMass, statMultiplier(weight, t.massPerPoint, t.neutral))
  return id === 'oso' ? mass * tuning.perks.aplanadora.massFactor : mass
}

/** The `stepKart` perks of a character. */
export function characterPerks(
  id: CharacterId,
  tuning: CharacterTuning = characterTuning,
): KartPerks {
  const { perks } = tuning
  switch (id) {
    case 'titi':
      return { ...NEUTRAL_KART_PERKS, driftChargeFactor: perks.agil.driftChargeFactor }
    case 'condor':
      return {
        ...NEUTRAL_KART_PERKS,
        airGravityFactor: perks.planeo.airGravityFactor,
        airSteerRate: perks.planeo.airSteerRate,
        landingBoostFactor: perks.planeo.landingBoostFactor,
      }
    case 'perezoso':
      return {
        ...NEUTRAL_KART_PERKS,
        nitroDurationFactor: perks.calmaTotal.nitroDurationFactor,
        thirdNitroDurationFactor: perks.calmaTotal.thirdNitroDurationFactor,
      }
    default:
      return NEUTRAL_KART_PERKS
  }
}

/** How much faster hit, spin, flip and dizzy timers run (Chigüiro's Tranquilo). */
export function recoveryRate(id: CharacterId, tuning: CharacterTuning = characterTuning): number {
  return id === 'chiguiro' ? tuning.perks.tranquilo.recoveryRate : 1
}

/** Multiplier on the duration of timed powers the racer uses (Guacamaya's Coleccionista). */
export function powerDurationFactor(
  id: CharacterId,
  tuning: CharacterTuning = characterTuning,
): number {
  return id === 'guacamaya' ? tuning.perks.coleccionista.durationFactor : 1
}

/** True if the character ignores the penalty of this surface (Delfín's Anfibio). */
export function ignoresSurface(
  id: CharacterId,
  surface: SurfaceType,
  tuning: CharacterTuning = characterTuning,
): boolean {
  if (id !== 'delfin') return false
  return (tuning.perks.anfibio.surfaces as readonly string[]).includes(surface)
}

/** Surface properties as this character feels them (no penalty where its perk says so). */
export function surfaceFor(
  id: CharacterId,
  surface: SurfaceType,
  props: SurfaceProperties,
): SurfaceProperties {
  if (!ignoresSurface(id, surface)) return props
  return { speedMultiplier: 1, gripMultiplier: 1, accelerationMultiplier: 1 }
}

/**
 * Jaguar's slipstream, 0..1: how close the nearest racer is inside a narrow cone ahead of the
 * kart (1 right behind it, 0 at the edge of the range or outside the cone). Other characters get 0.
 */
export function slipstream(
  racer: Racer,
  others: readonly Racer[],
  tuning: CharacterTuning = characterTuning,
): number {
  if (racer.character !== 'jaguar') return 0
  const { range, coneHalfAngle, maxHeightGap } = tuning.perks.depredador
  const { position, heading } = racer.kart
  const forward = forwardOf(heading)
  let best = 0
  for (const other of others) {
    if (other === racer) continue
    const dx = other.kart.position.x - position.x
    const dz = other.kart.position.z - position.z
    const distance = Math.hypot(dx, dz)
    if (distance < 1e-6 || distance >= range) continue
    if (Math.abs(other.kart.position.y - position.y) > maxHeightGap) continue
    const cos = (dx * forward.x + dz * forward.z) / distance
    if (cos < Math.cos(coneHalfAngle)) continue
    best = Math.max(best, 1 - distance / range)
  }
  return clamp(best, 0, 1)
}
