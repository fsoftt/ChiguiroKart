import type {
  SkidMarksConfig,
  SkidProfile,
  SurfaceParticleProfile,
  SurfaceParticlesConfig,
} from '../../config/effects'
import { clamp } from '../../sim/math'
import type { SurfaceType } from '../../sim/race/surface'

/** What a surface throws up from the wheels. */
export type SurfaceEffectKind = 'none' | 'dust' | 'splash' | 'snow' | 'sand'

const EFFECT_KIND: Record<SurfaceType, SurfaceEffectKind> = {
  asphalt: 'dust',
  wood: 'dust',
  dirt: 'dust',
  grass: 'dust',
  mud: 'splash',
  water: 'splash',
  ice: 'snow',
  sand: 'sand',
}

/** Which kind of particles a surface produces (asphalt and wood only show dust when sliding). */
export function surfaceEffectKind(surface: SurfaceType): SurfaceEffectKind {
  return EFFECT_KIND[surface] ?? 'none'
}

/**
 * Puffs per second per wheel for a surface. Rolling emits nothing below the profile's minimum
 * speed; drifting always emits and multiplies the rate. Airborne karts emit nothing.
 */
export function surfaceEmissionRate(
  profile: SurfaceParticleProfile,
  speedRatio: number,
  drifting: boolean,
  onGround: boolean,
): number {
  if (!onGround) return 0
  const speed = clamp(Math.abs(speedRatio), 0, 1)
  // A minimum above 1 means "only while sliding" (asphalt, wood)
  if (!drifting && speed < profile.minSpeedRatio) return 0
  const rolling = profile.baseRate + profile.speedRate * speed
  if (!drifting) return rolling
  return rolling * profile.driftMultiplier
}

/** Puffs per wheel thrown up when a kart lands after `airTime` seconds in the air. */
export function landingBurstCount(
  profile: SurfaceParticleProfile,
  airTime: number,
  config: Pick<SurfaceParticlesConfig, 'minLandingAirTime' | 'fullLandingAirTime'>,
): number {
  if (airTime < config.minLandingAirTime) return 0
  const strength = clamp(airTime / config.fullLandingAirTime, 0.3, 1)
  return Math.round(profile.landingBurst * strength)
}

/** Facts about a kart that decide whether its tires mark the ground. */
export interface SlipInput {
  onGround: boolean
  drifting: boolean
  braking: boolean
  /** Forward speed over the base top speed. */
  speedRatio: number
  /** Absolute speed sideways to the heading (m/s). */
  lateralSpeed: number
  /** Absolute steer, 0..1. */
  steer: number
}

/** True when the rear tires should leave a mark: sliding, hard braking or a sharp fast turn. */
export function isMarking(
  input: SlipInput,
  surface: SurfaceType,
  config: SkidMarksConfig,
): boolean {
  if (!input.onGround) return false
  if (input.drifting) return true
  if (input.lateralSpeed > config.slipSpeed) return true
  if (input.braking && input.speedRatio > config.brakeSpeedRatio) return true
  // Sharp turns only squeal on hard, grippy ground
  const grippy = surface === 'asphalt' || surface === 'wood'
  return grippy && input.steer > config.sharpSteer && input.speedRatio > config.sharpSpeedRatio
}

/** Mark profile for a surface, or null when the surface keeps no marks. */
export function skidProfileFor(surface: SurfaceType, config: SkidMarksConfig): SkidProfile | null {
  const profile = config.profiles[surface]
  return profile && profile.alpha > 0 ? profile : null
}

/** Opacity multiplier of a mark `age` seconds old: full while held, then linear to zero. */
export function skidFade(age: number, life: number, holdShare: number): number {
  if (age >= life) return 0
  if (age <= 0) return 1
  const hold = life * clamp(holdShare, 0, 0.99)
  if (age <= hold) return 1
  return 1 - (age - hold) / (life - hold)
}

/** True when a kart is close enough to the player for its effects to be worth drawing. */
export function withinEffectRange(
  x: number,
  z: number,
  centerX: number,
  centerZ: number,
  maxDistance: number,
): boolean {
  const dx = x - centerX
  const dz = z - centerZ
  return dx * dx + dz * dz <= maxDistance * maxDistance
}
