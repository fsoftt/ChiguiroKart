import * as THREE from 'three'
import type { DriftConfig } from '../../config/drift'
import type { EffectsConfig } from '../../config/effects'
import { forwardOf, rightOf, type Vec3 } from '../../sim/math'
import type { BoostState, DriftState } from '../../sim/kart/driftState'
import type { KartState } from '../../sim/kart/kartState'
import {
  createSmokePalette,
  detectChainBreak,
  detectNitroStart,
  hexToRgb,
  smokeColorAt,
  type Rgb,
  type SmokePalette,
} from './effectsLogic'
import { ParticleRing } from './particleRing'
import { ParticlePoints } from './particlePoints'

/** Rear wheel offsets in kart-local space (m). */
const REAR_WHEELS: readonly Vec3[] = [
  { x: -0.75, y: 0.35, z: -0.75 },
  { x: 0.75, y: 0.35, z: -0.75 },
]

/** Exhaust offsets in kart-local space (m). */
const EXHAUSTS: readonly Vec3[] = [
  { x: -0.22, y: 0.62, z: -1.5 },
  { x: 0.22, y: 0.62, z: -1.5 },
]

const ZERO: Rgb = { r: 0, g: 0, b: 0 }

/** Flames are drawn brighter than white so the bloom pass picks them up. */
const FLAME_GAIN = 2.5

/**
 * Drift smoke and nitro flames for one kart. Reads the shared drift/boost state every frame
 * and decides what to spawn; the simulation never knows this exists. Particles are pooled, so
 * a steady frame allocates nothing.
 */
export class KartEffects {
  readonly object = new THREE.Group()

  private readonly smokeRing: ParticleRing
  private readonly flameRing: ParticleRing
  private readonly smokeView: ParticlePoints
  private readonly flameView: ParticlePoints
  private palette: SmokePalette
  private readonly smokeColor: Rgb = { ...ZERO }

  private previousBoost: BoostState = { level: 0, timeLeft: 0, perfect: false }
  private previousDrift: DriftState = {
    direction: 0,
    charge: 0,
    nitrosInChain: 0,
    chainBroken: false,
    overchargeTime: 0,
  }
  private smokeAccumulator = 0
  private flameAccumulator = 0

  constructor(
    private readonly effects: EffectsConfig,
    private drift: DriftConfig,
  ) {
    this.palette = createSmokePalette(drift)
    this.smokeRing = new ParticleRing(effects.smoke.maxParticles, effects.smoke.drag)
    this.flameRing = new ParticleRing(effects.flames.maxParticles, effects.flames.drag)
    this.smokeView = new ParticlePoints(this.smokeRing, false)
    this.flameView = new ParticlePoints(this.flameRing, true, FLAME_GAIN)
    this.object.add(this.smokeView.object, this.flameView.object)
  }

  /** Switches the nitro tier colors (flames and smoke) to those of `drift`, live. */
  setDrift(drift: DriftConfig): void {
    this.drift = drift
    this.palette = createSmokePalette(drift)
  }

  /** Scales the particle pools (graphics quality), 0..1. */
  setParticleScale(scale: number): void {
    this.smokeRing.setShare(scale)
    this.flameRing.setShare(scale)
  }

  /**
   * @param state interpolated kart state for the current frame
   * @param speedRatio forward speed over the base top speed, 0..1
   */
  update(state: KartState, speedRatio: number, dt: number): void {
    this.emitSmoke(state, speedRatio, dt)
    this.emitFlames(state, dt)

    this.smokeRing.update(dt)
    this.flameRing.update(dt)
    this.smokeView.sync()
    this.flameView.sync()

    this.previousBoost = { ...state.boost }
    this.previousDrift = { ...state.drift }
  }

  private emitSmoke(state: KartState, speedRatio: number, dt: number): void {
    if (state.drift.direction === 0 && !detectChainBreak(this.previousDrift, state.drift)) {
      this.smokeAccumulator = 0
      return
    }
    const cfg = this.effects.smoke
    const speedShare = Math.min(Math.abs(speedRatio), 1)
    const perSecond = (cfg.baseRate + cfg.speedRate * speedShare) * REAR_WHEELS.length
    this.smokeAccumulator += perSecond * dt
    const puffs = Math.floor(this.smokeAccumulator)
    this.smokeAccumulator -= puffs

    const broken = detectChainBreak(this.previousDrift, state.drift)
    smokeColorAt(state.drift, this.drift.redZoneStart, this.palette, this.smokeColor)

    for (let i = 0; i < puffs; i += 1) {
      for (const wheel of REAR_WHEELS) {
        const position = toWorld(state, wheel)
        this.smokeRing.spawn(
          position,
          {
            x: state.velocity.x * cfg.inheritVelocity + jitter(cfg.spread),
            y: cfg.rise + jitter(cfg.spread * 0.5),
            z: state.velocity.z * cfg.inheritVelocity + jitter(cfg.spread),
          },
          broken ? cfg.life * 0.6 : cfg.life,
          cfg.sizeStart,
          cfg.sizeEnd,
          this.smokeColor,
          cfg.alpha,
        )
      }
    }
  }

  private emitFlames(state: KartState, dt: number): void {
    const cfg = this.effects.flames
    const started = detectNitroStart(this.previousBoost, state.boost)
    if (started > 0) {
      const count = cfg.burstCount[started - 1] ?? 0
      for (let i = 0; i < count; i += 1) this.spawnFlame(state, started)
    }
    if (state.boost.level === 0) {
      this.flameAccumulator = 0
      return
    }
    this.flameAccumulator += cfg.rate * EXHAUSTS.length * dt
    const flames = Math.floor(this.flameAccumulator)
    this.flameAccumulator -= flames
    for (let i = 0; i < flames; i += 1) this.spawnFlame(state, state.boost.level)
  }

  private spawnFlame(state: KartState, level: number): void {
    const cfg = this.effects.flames
    const levelIndex = Math.min(Math.max(level, 1), cfg.size.length) - 1
    const size = (cfg.size[levelIndex] ?? cfg.size[0]) * (1 + jitter(cfg.flicker))
    const color = hexToRgb(this.drift.levels[levelIndex]?.color ?? '#ffffff')
    const backward = forwardOf(state.heading)

    for (const exhaust of EXHAUSTS) {
      const position = toWorld(state, exhaust)
      this.flameRing.spawn(
        position,
        {
          x: -backward.x * cfg.exitSpeed + jitter(cfg.spread),
          y: jitter(cfg.spread * 0.5),
          z: -backward.z * cfg.exitSpeed + jitter(cfg.spread),
        },
        cfg.life,
        size,
        size * cfg.endSizeRatio,
        color,
        cfg.alpha,
      )
    }
  }

  dispose(): void {
    this.smokeView.dispose()
    this.flameView.dispose()
  }
}

/** Kart-local offset to world space, using the heading as yaw. */
function toWorld(state: KartState, local: Vec3): Vec3 {
  const forward = forwardOf(state.heading)
  const right = rightOf(state.heading)
  return {
    x: state.position.x + right.x * local.x + forward.x * local.z,
    y: state.position.y + local.y,
    z: state.position.z + right.z * local.x + forward.z * local.z,
  }
}

/** Symmetric random value in `[-amount, amount]`. */
function jitter(amount: number): number {
  return (Math.random() * 2 - 1) * amount
}
