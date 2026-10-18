import type { SurfaceType } from '../sim/race/surface'

/**
 * Visual effect tuning for drift smoke, nitro flames, speed lines and feedback motion.
 * Counts and rates live here so a future quality setting can scale them.
 */

/** Per-level values for nitro levels 1..3. */
export type PerLevel = readonly [number, number, number]

export interface SmokeConfig {
  /** Particle pool size. */
  maxParticles: number
  /** Puffs per second per wheel at standstill. */
  baseRate: number
  /** Extra puffs per second per wheel at top speed. */
  speedRate: number
  /** Puff lifetime (s). */
  life: number
  /** Puff diameter at spawn and at death (m). */
  sizeStart: number
  sizeEnd: number
  /** Initial upward speed (m/s). */
  rise: number
  /** Random sideways speed (m/s). */
  spread: number
  /** Share of the kart velocity inherited by a puff. */
  inheritVelocity: number
  /** Velocity damping (1/s). */
  drag: number
  /** Peak opacity, 0..1. */
  alpha: number
}

export interface FlameConfig {
  maxParticles: number
  /** Flames per second per exhaust while a nitro is active. */
  rate: number
  life: number
  /** Flame diameter at spawn per nitro level (m). */
  size: PerLevel
  /** Diameter at death as a fraction of the spawn size. */
  endSizeRatio: number
  /** Speed pushed backward, relative to the kart (m/s). */
  exitSpeed: number
  spread: number
  /** Random size variation, 0..1 (0.3 = +-30 %). */
  flicker: number
  /** Flames spawned at once when a nitro starts, per level. */
  burstCount: PerLevel
  alpha: number
  /** Velocity damping (1/s). */
  drag: number
}

export interface SpeedLinesConfig {
  /** Speed ratio where the lines begin to appear. */
  startRatio: number
  /** Intensity at top speed without nitro, 0..1. */
  baseIntensity: number
  /** Extra intensity per active nitro level. */
  levelIntensity: PerLevel
  /** How fast the intensity follows its target (1/s). */
  smoothing: number
  color: string
}

export interface CameraFeedbackConfig {
  /** FOV added by a new nitro per level (degrees). */
  fovKick: PerLevel
  /** Kick decay rate (1/s). */
  fovKickDecay: number
  /** Chain-break shake: peak offset (m), duration (s). */
  breakShakeIntensity: number
  breakShakeSeconds: number
  /** Shake oscillation frequency (Hz). */
  shakeFrequency: number
}

export interface BodyFeedbackConfig {
  /** Roll into the drift (radians) and extra yaw of the body (radians). */
  driftTilt: number
  driftYaw: number
  /** How fast the body follows the drift pose (1/s). */
  driftSmoothing: number
  /** Backward pitch when a nitro fires, per level (radians). */
  nitroPitch: PerLevel
  /** Length stretch when a nitro fires, per level (fraction). */
  nitroStretch: PerLevel
  /** Impulse decay rate (1/s). */
  nitroRecovery: number
}

/** Surface particle look and rate for one surface (dust, splash, snow or sand puffs). */
export interface SurfaceParticleProfile {
  /** Puff color as `#rrggbb`. */
  color: string
  /** Puffs per second per rear wheel when rolling at the minimum speed, 0 = none. */
  baseRate: number
  /** Extra puffs per second per wheel at top speed. */
  speedRate: number
  /** Rate multiplier while drifting (1 = same as rolling). */
  driftMultiplier: number
  /** Rolling emits nothing below this speed ratio; drifting ignores it. */
  minSpeedRatio: number
  /** Puff diameter at spawn and death (m). */
  sizeStart: number
  sizeEnd: number
  life: number
  /** Upward speed (m/s); splashes are higher and shorter lived. */
  rise: number
  /** Random sideways speed (m/s). */
  spread: number
  alpha: number
  /** Puffs per wheel in a landing burst at one second of air time. */
  landingBurst: number
}

export interface SurfaceParticlesConfig {
  /** Particle pool size shared by every kart (one draw call). */
  maxParticles: number
  drag: number
  /** Karts farther than this from the player emit nothing (m). */
  maxDistance: number
  /** Landing bursts need at least this much air time (s). */
  minLandingAirTime: number
  /** Air time (s) at which a landing burst reaches its full strength. */
  fullLandingAirTime: number
  /** Share of the kart velocity inherited by a puff. */
  inheritVelocity: number
  profiles: Record<SurfaceType, SurfaceParticleProfile>
}

/** Tire mark look for one surface. Alpha 0 means the surface keeps no marks. */
export interface SkidProfile {
  color: string
  alpha: number
}

export interface SkidMarksConfig {
  /** Quads in the ring buffer (one draw call, 2 triangles each). */
  capacity: number
  /** Seconds before a mark has fully faded. */
  life: number
  /** Share of the life a mark stays at full opacity before fading. */
  holdShare: number
  /** Distance the wheel must travel before a new quad is added (m). */
  segmentLength: number
  /** A wheel jump longer than this (teleport, respawn) breaks the trail (m). */
  maxGap: number
  /** Mark width (m). */
  width: number
  /** Lift above the ground against z-fighting (m). */
  lift: number
  /** Sideways slip speed (m/s) above which the tires mark the ground. */
  slipSpeed: number
  /** Braking marks need at least this speed ratio. */
  brakeSpeedRatio: number
  /** Steer magnitude and speed ratio from which a sharp turn marks asphalt. */
  sharpSteer: number
  sharpSpeedRatio: number
  /** Karts farther than this from the player leave no marks (m). */
  maxDistance: number
  profiles: Record<SurfaceType, SkidProfile>
}

export interface EffectsConfig {
  surfaceParticles: SurfaceParticlesConfig
  skidMarks: SkidMarksConfig
  smoke: SmokeConfig
  flames: FlameConfig
  speedLines: SpeedLinesConfig
  camera: CameraFeedbackConfig
  body: BodyFeedbackConfig
}

export const defaultEffects: EffectsConfig = {
  surfaceParticles: {
    maxParticles: 360,
    drag: 2.2,
    maxDistance: 70,
    minLandingAirTime: 0.25,
    fullLandingAirTime: 1,
    inheritVelocity: 0.15,
    profiles: {
      // Light grey tire dust: minimum speed 2 means it only shows while sliding
      asphalt: dust('#b9b4a8', 0, 6, 1.5, 2, 1, 0.3),
      wood: dust('#c9b08a', 0, 5, 1.5, 2, 1, 0.3),
      dirt: dust('#a98a62', 6, 14, 2.2, 0.15, 1.6, 0.55),
      grass: dust('#8aa05a', 5, 10, 2, 0.15, 1.5, 0.45),
      mud: splash('#5b4026', 8, 10, 1.8, 0.1, 0.4, 0.8),
      water: splash('#d6efff', 12, 16, 1.6, 0.1, 0.35, 0.85),
      ice: dust('#f2f8ff', 6, 10, 2, 0.15, 1.5, 0.7),
      sand: dust('#e3cb86', 7, 12, 2.2, 0.15, 1.6, 0.6),
    },
  },
  skidMarks: {
    capacity: 1024,
    life: 7,
    holdShare: 0.4,
    segmentLength: 0.6,
    maxGap: 3,
    width: 0.45,
    lift: 0.04,
    slipSpeed: 3.2,
    brakeSpeedRatio: 0.45,
    sharpSteer: 0.85,
    sharpSpeedRatio: 0.75,
    maxDistance: 90,
    profiles: {
      asphalt: { color: '#0a0a0c', alpha: 0.75 },
      wood: { color: '#2b2118', alpha: 0.4 },
      dirt: { color: '#5a4228', alpha: 0.45 },
      mud: { color: '#33210f', alpha: 0.5 },
      sand: { color: '#a9915a', alpha: 0.35 },
      ice: { color: '#9fb6c8', alpha: 0.4 },
      grass: { color: '#000000', alpha: 0 },
      water: { color: '#000000', alpha: 0 },
    },
  },
  smoke: {
    maxParticles: 160,
    baseRate: 14,
    speedRate: 22,
    life: 0.8,
    sizeStart: 0.5,
    sizeEnd: 1.8,
    rise: 1.2,
    spread: 0.8,
    inheritVelocity: 0.1,
    drag: 2,
    alpha: 0.6,
  },
  flames: {
    maxParticles: 96,
    rate: 70,
    life: 0.2,
    size: [0.3, 0.42, 0.58],
    endSizeRatio: 0.2,
    exitSpeed: 7,
    spread: 0.8,
    flicker: 0.3,
    burstCount: [6, 10, 16],
    alpha: 0.9,
    drag: 1,
  },
  speedLines: {
    startRatio: 0.6,
    baseIntensity: 0.25,
    levelIntensity: [0.35, 0.6, 0.9],
    smoothing: 6,
    color: '#ffffff',
  },
  camera: {
    fovKick: [4, 7, 11],
    fovKickDecay: 4,
    breakShakeIntensity: 0.25,
    breakShakeSeconds: 0.35,
    shakeFrequency: 35,
  },
  body: {
    driftTilt: 0.12,
    driftYaw: 0.25,
    driftSmoothing: 8,
    nitroPitch: [0.06, 0.09, 0.12],
    nitroStretch: [0.05, 0.08, 0.12],
    nitroRecovery: 7,
  },
}

/** Soft dust puffs that rise slowly. */
function dust(
  color: string,
  baseRate: number,
  speedRate: number,
  driftMultiplier: number,
  minSpeedRatio: number,
  sizeEnd: number,
  alpha: number,
): SurfaceParticleProfile {
  return {
    color,
    baseRate,
    speedRate,
    driftMultiplier,
    minSpeedRatio,
    sizeStart: 0.3,
    sizeEnd,
    life: 0.7,
    rise: 0.9,
    spread: 0.9,
    alpha,
    landingBurst: 14,
  }
}

/** Small fast droplets thrown up and out; short lived. */
function splash(
  color: string,
  baseRate: number,
  speedRate: number,
  driftMultiplier: number,
  minSpeedRatio: number,
  sizeEnd: number,
  alpha: number,
): SurfaceParticleProfile {
  return {
    color,
    baseRate,
    speedRate,
    driftMultiplier,
    minSpeedRatio,
    sizeStart: 0.22,
    sizeEnd,
    life: 0.45,
    rise: 3.2,
    spread: 1.8,
    alpha,
    landingBurst: 22,
  }
}
