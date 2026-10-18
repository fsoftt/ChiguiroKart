import * as THREE from 'three'
import type { EffectsConfig } from '../../config/effects'
import { forwardOf, rightOf } from '../../sim/math'
import type { KartState } from '../../sim/kart/kartState'
import type { SurfaceType } from '../../sim/race/surface'
import { hexToRgb, type Rgb } from './effectsLogic'
import { ParticlePoints } from './particlePoints'
import { ParticleRing } from './particleRing'
import { SkidBuffer } from './skidBuffer'
import {
  isMarking,
  landingBurstCount,
  skidProfileFor,
  surfaceEmissionRate,
  withinEffectRange,
} from './surfaceFxLogic'

/** Most karts that can have surface effects at once (player plus bots). */
const MAX_KARTS = 16

/** A frame hitch (tab switch, slow device) counts as at most this long, so marks do not vanish (s). */
const MAX_DT = 0.1

/** Rear wheel offsets in kart-local space (m); x is sideways, z forward. */
const WHEEL_SIDES = [-0.75, 0.75] as const
const WHEEL_BACK = -0.75

const SURFACES: readonly SurfaceType[] = [
  'asphalt',
  'wood',
  'dirt',
  'mud',
  'ice',
  'sand',
  'water',
  'grass',
]

/** The slice of a track the effects need. */
export interface SurfaceSampler {
  surfaceAt(x: number, z: number): SurfaceType
  /** Height of the drawn road/ground, ignoring jump gaps. */
  roadHeight(x: number, z: number): number
}

/** What a kart did this frame, beyond its state. */
export interface KartDriveInput {
  /** Absolute steer, 0..1. */
  steer: number
  braking: boolean
}

/**
 * Surface particles (dust, splash, snow, sand) and tire marks for every kart, shared across the
 * race: one pooled particle cloud and one ring-buffer mesh, so the cost is two draw calls no
 * matter how many karts there are. Decisions live in `surfaceFxLogic`; this class only
 * samples the world, spawns and uploads.
 */
export class SurfaceFx {
  readonly object = new THREE.Group()

  private readonly ring: ParticleRing
  private readonly points: ParticlePoints
  private readonly skid: SkidBuffer
  private readonly skidMesh: THREE.Mesh
  private readonly skidGeometry = new THREE.BufferGeometry()
  private readonly skidMaterial: THREE.MeshBasicMaterial
  private readonly positionAttribute: THREE.BufferAttribute
  private readonly colorAttribute: THREE.BufferAttribute

  private readonly particleColors: Record<SurfaceType, Rgb>
  private readonly skidColors: Record<SurfaceType, Rgb>

  private readonly wasAirborne = new Array<boolean>(MAX_KARTS).fill(false)
  private readonly lastAirTime = new Array<number>(MAX_KARTS).fill(0)
  private readonly accumulator = new Array<number>(MAX_KARTS).fill(0)

  private skidEnabled = true
  private skidDirty = false
  private centerX = 0
  private centerZ = 0
  private readonly spawnPosition = { x: 0, y: 0, z: 0 }
  private readonly spawnVelocity = { x: 0, y: 0, z: 0 }

  constructor(private readonly config: EffectsConfig) {
    const particles = config.surfaceParticles
    const marks = config.skidMarks
    this.ring = new ParticleRing(particles.maxParticles, particles.drag)
    this.points = new ParticlePoints(this.ring, false)
    this.points.object.renderOrder = 3

    this.skid = new SkidBuffer(marks.capacity, MAX_KARTS * 2, marks.life, marks.holdShare)
    this.positionAttribute = new THREE.BufferAttribute(this.skid.positions, 3)
    this.positionAttribute.setUsage(THREE.DynamicDrawUsage)
    this.colorAttribute = new THREE.BufferAttribute(this.skid.colors, 4)
    this.colorAttribute.setUsage(THREE.DynamicDrawUsage)
    const index = new Uint16Array(marks.capacity * 6)
    for (let quad = 0; quad < marks.capacity; quad += 1) {
      const v = quad * 4
      index.set([v, v + 1, v + 2, v, v + 2, v + 3], quad * 6)
    }
    this.skidGeometry.setAttribute('position', this.positionAttribute)
    this.skidGeometry.setAttribute('color', this.colorAttribute)
    this.skidGeometry.setIndex(new THREE.BufferAttribute(index, 1))
    this.skidMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      // Double-sided transparent meshes are drawn twice by default; one pass is enough here
      forceSinglePass: true,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    })
    this.skidMesh = new THREE.Mesh(this.skidGeometry, this.skidMaterial)
    this.skidMesh.frustumCulled = false
    this.skidMesh.renderOrder = 2

    this.object.add(this.skidMesh, this.points.object)

    this.particleColors = colorTable(SURFACES, (s) => particles.profiles[s].color)
    this.skidColors = colorTable(SURFACES, (s) => marks.profiles[s].color)
    // Vertex colors are linear, the config is authored in sRGB
    for (const surface of SURFACES) {
      const c = this.skidColors[surface]
      c.r **= 2.2
      c.g **= 2.2
      c.b **= 2.2
    }
  }

  /** Graphics quality: pool share for particles, and share of the tire mark buffer (0 = off). */
  setQuality(particleScale: number, skidMarkScale: number): void {
    this.ring.setShare(particleScale)
    this.skidEnabled = skidMarkScale > 0
    this.skid.setScale(skidMarkScale, this.config.skidMarks.life)
    this.skidMesh.visible = this.skidEnabled
    if (!this.skidEnabled) this.skid.clear()
    this.skidDirty = true
  }

  /** Forgets all marks and puffs (new race or track). */
  reset(): void {
    this.skid.clear()
    this.skidDirty = true
    this.wasAirborne.fill(false)
    this.lastAirTime.fill(0)
    this.accumulator.fill(0)
  }

  /**
   * Handles one kart for this frame. Call the player (slot 0) first: its position decides which
   * other karts are close enough to bother with.
   */
  updateKart(
    slot: number,
    kart: KartState,
    speedRatio: number,
    drive: KartDriveInput,
    track: SurfaceSampler,
    rawDt: number,
  ): void {
    if (slot >= MAX_KARTS) return
    const dt = Math.min(rawDt, MAX_DT)
    if (slot === 0) {
      this.centerX = kart.position.x
      this.centerZ = kart.position.z
    }
    const particles = this.config.surfaceParticles
    const marks = this.config.skidMarks
    const near = withinEffectRange(
      kart.position.x,
      kart.position.z,
      this.centerX,
      this.centerZ,
      Math.max(particles.maxDistance, marks.maxDistance),
    )
    const landing = this.wasAirborne[slot] === true && kart.onGround
    const airTime = this.lastAirTime[slot] ?? 0
    this.wasAirborne[slot] = !kart.onGround
    this.lastAirTime[slot] = kart.airTime
    if (!near) {
      this.breakTrails(slot)
      return
    }

    const forward = forwardOf(kart.heading)
    const right = rightOf(kart.heading)
    const lateral = Math.abs(kart.velocity.x * right.x + kart.velocity.z * right.z)
    const drifting = kart.drift.direction !== 0
    const nearForParticles = withinEffectRange(
      kart.position.x,
      kart.position.z,
      this.centerX,
      this.centerZ,
      particles.maxDistance,
    )
    const nearForMarks = withinEffectRange(
      kart.position.x,
      kart.position.z,
      this.centerX,
      this.centerZ,
      marks.maxDistance,
    )

    for (let side = 0; side < WHEEL_SIDES.length; side += 1) {
      const local = WHEEL_SIDES[side] ?? 0
      const x = kart.position.x + right.x * local + forward.x * WHEEL_BACK
      const z = kart.position.z + right.z * local + forward.z * WHEEL_BACK
      const surface = track.surfaceAt(x, z)

      if (nearForParticles) {
        const profile = particles.profiles[surface]
        if (landing) {
          const count = landingBurstCount(profile, airTime, particles)
          for (let i = 0; i < count; i += 1) this.spawn(surface, kart, x, z, 1.8)
        }
      }
      if (nearForMarks && this.skidEnabled) {
        this.markWheel(slot, side, kart, speedRatio, drive, lateral, surface, x, z, track)
      }
    }

    if (nearForParticles) this.emitRolling(slot, kart, speedRatio, drifting, track, dt)
  }

  /** Advances the particles and fades the tire marks; uploads whatever changed. */
  update(rawDt: number): void {
    const dt = Math.min(rawDt, MAX_DT)
    this.ring.update(dt)
    this.points.sync()
    if (this.skidEnabled) {
      if (this.skid.update(dt)) this.skidDirty = true
      if (this.skidDirty) {
        this.positionAttribute.needsUpdate = true
        this.colorAttribute.needsUpdate = true
        this.skidDirty = false
      }
    }
  }

  dispose(): void {
    this.points.dispose()
    this.skidGeometry.dispose()
    this.skidMaterial.dispose()
  }

  /** Steady dust, splash, snow or sand from both rear wheels. */
  private emitRolling(
    slot: number,
    kart: KartState,
    speedRatio: number,
    drifting: boolean,
    track: SurfaceSampler,
    dt: number,
  ): void {
    const forward = forwardOf(kart.heading)
    const right = rightOf(kart.heading)
    const centerX = kart.position.x + forward.x * WHEEL_BACK
    const centerZ = kart.position.z + forward.z * WHEEL_BACK
    const surface = track.surfaceAt(centerX, centerZ)
    const profile = this.config.surfaceParticles.profiles[surface]
    const rate = surfaceEmissionRate(profile, speedRatio, drifting, kart.onGround)
    if (rate <= 0) {
      this.accumulator[slot] = 0
      return
    }
    const total = (this.accumulator[slot] ?? 0) + rate * dt * WHEEL_SIDES.length
    const count = Math.floor(total)
    this.accumulator[slot] = total - count
    for (let i = 0; i < count; i += 1) {
      const local = WHEEL_SIDES[i % WHEEL_SIDES.length] ?? 0
      this.spawn(surface, kart, centerX + right.x * local, centerZ + right.z * local, 1)
    }
  }

  private spawn(surface: SurfaceType, kart: KartState, x: number, z: number, energy: number): void {
    const cfg = this.config.surfaceParticles
    const profile = cfg.profiles[surface]
    const color = this.particleColors[surface]
    this.spawnPosition.x = x
    this.spawnPosition.y = kart.position.y + 0.12
    this.spawnPosition.z = z
    const spread = profile.spread * energy
    this.spawnVelocity.x = kart.velocity.x * cfg.inheritVelocity + jitter(spread)
    this.spawnVelocity.y = profile.rise * (0.6 + Math.random() * 0.8) * energy
    this.spawnVelocity.z = kart.velocity.z * cfg.inheritVelocity + jitter(spread)
    this.ring.spawn(
      this.spawnPosition,
      this.spawnVelocity,
      profile.life * (0.7 + Math.random() * 0.6),
      profile.sizeStart * (0.8 + Math.random() * 0.4),
      profile.sizeEnd * energy,
      color,
      profile.alpha,
    )
  }

  private markWheel(
    slot: number,
    side: number,
    kart: KartState,
    speedRatio: number,
    drive: KartDriveInput,
    lateralSpeed: number,
    surface: SurfaceType,
    x: number,
    z: number,
    track: SurfaceSampler,
  ): void {
    const marks = this.config.skidMarks
    const trail = slot * 2 + side
    const profile = skidProfileFor(surface, marks)
    const marking =
      profile !== null &&
      isMarking(
        {
          onGround: kart.onGround,
          drifting: kart.drift.direction !== 0,
          braking: drive.braking,
          speedRatio,
          lateralSpeed,
          steer: drive.steer,
        },
        surface,
        marks,
      )
    if (!profile || !marking) {
      this.skid.breakTrail(trail)
      return
    }
    // Direction of travel when moving, otherwise the heading
    const vx = kart.velocity.x
    const vz = kart.velocity.z
    const speed = Math.hypot(vx, vz)
    const dirX = speed > 1 ? vx / speed : Math.sin(kart.heading)
    const dirZ = speed > 1 ? vz / speed : Math.cos(kart.heading)
    const y = track.roadHeight(x, z) + marks.lift
    const color = this.skidColors[surface]
    const written = this.skid.extend(
      trail,
      x,
      y,
      z,
      dirX,
      dirZ,
      marks.width,
      profile.alpha,
      color,
      marks.segmentLength,
      marks.maxGap,
    )
    if (written >= 0) this.skidDirty = true
  }

  private breakTrails(slot: number): void {
    this.skid.breakTrail(slot * 2)
    this.skid.breakTrail(slot * 2 + 1)
  }
}

function colorTable(
  surfaces: readonly SurfaceType[],
  hex: (surface: SurfaceType) => string,
): Record<SurfaceType, Rgb> {
  const table = {} as Record<SurfaceType, Rgb>
  for (const surface of surfaces) table[surface] = hexToRgb(hex(surface))
  return table
}

function jitter(amount: number): number {
  return (Math.random() * 2 - 1) * amount
}
