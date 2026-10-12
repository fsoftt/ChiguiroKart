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

export interface EffectsConfig {
  smoke: SmokeConfig
  flames: FlameConfig
  speedLines: SpeedLinesConfig
  camera: CameraFeedbackConfig
  body: BodyFeedbackConfig
}

export const defaultEffects: EffectsConfig = {
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
