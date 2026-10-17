import * as THREE from 'three'
import type { HazardObstacle } from '../sim/hazards/hazardTypes'
import type { HazardKind, Track } from '../sim/track'
import {
  boulderParts,
  COW_UNIT_RADIUS,
  cowParts,
  FLOAT_UNIT_RADIUS,
  floatParts,
  iceWallParts,
  shardGeometry,
} from './hazardModels'
import { sceneryMaterial, type SceneryPart } from './scenery/sceneryKit'
import { COW_HIP } from './scenery/sceneryModels'
import { seededRandom } from './scenery/random'

/** Legs swing this far (rad) and this fast (rad/s) while the herd runs. */
const LEG_SWING = 0.6
const LEG_SPEED = 11
/** Up-down bounce of a running cow (m) and of a moving float, per unit of scale. */
const COW_BOB = 0.07
const FLOAT_BOB = 0.025
const FLOAT_SWAY = 0.025
/** Ice walls are as tall as their radius, up to this height (m). */
const ICE_MAX_HEIGHT = 3
const SHARD_POOL = 48
const SHARDS_PER_BREAK = 14
const SHARD_LIFE = 0.9
const SHARD_GRAVITY = 14
const UP = new THREE.Vector3(0, 1, 0)
const RIGHT = new THREE.Vector3(1, 0, 0)
const FORWARD = new THREE.Vector3(0, 0, 1)

/** One instanced mesh with a fill cursor; `reset`, `add` per visible instance, then `flush`. */
class Batch {
  readonly mesh: THREE.InstancedMesh
  private count = 0

  constructor(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    private readonly capacity: number,
  ) {
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity)
    this.mesh.frustumCulled = false
    this.mesh.count = 0
  }

  reset(): void {
    this.count = 0
  }

  add(matrix: THREE.Matrix4): void {
    if (this.count >= this.capacity) return
    this.mesh.setMatrixAt(this.count++, matrix)
  }

  flush(): void {
    this.mesh.count = this.count
    this.mesh.instanceMatrix.needsUpdate = true
  }
}

interface Shard {
  position: THREE.Vector3
  velocity: THREE.Vector3
  spin: number
  age: number
}

/**
 * Draws the track's obstacles (`HazardObstacle`, written by the simulation each step): cattle,
 * carnival floats, ice walls and boulders. Pooled instanced meshes, a few draw calls in all.
 *
 * Usage: `const view = new HazardView(track)`, add `view.object` to the scene, then call
 * `view.update(obstacles, time)` every rendered frame with the obstacles of the moment and a
 * clock in seconds (animation phase only). Obstacle order must stay stable between frames.
 */
export class HazardView {
  readonly object = new THREE.Group()
  private readonly cowBody: Batch | null
  private readonly cowLegsA: Batch | null
  private readonly cowLegsB: Batch | null
  private readonly floats: Batch[]
  private readonly iceWalls: Batch[]
  private readonly boulders: Batch[]
  private readonly shards: Batch | null
  private readonly shardPool: Shard[] = []
  private readonly random = seededRandom(7)
  private wasActive: boolean[] = []
  private lastTime: number | null = null
  private readonly matrix = new THREE.Matrix4()
  private readonly position = new THREE.Vector3()
  private readonly rotation = new THREE.Quaternion()
  private readonly swing = new THREE.Quaternion()
  private readonly scale = new THREE.Vector3()

  constructor(track: Track) {
    this.object.name = 'hazards'
    const capacity = (kind: HazardKind): number =>
      track.hazards.reduce((sum, h) => sum + (h.kind === kind ? h.count : 0), 0)
    const batches = (parts: SceneryPart[], count: number): Batch[] =>
      count === 0
        ? []
        : parts.map((part) => new Batch(part.geometry, sceneryMaterial(part.layer), count))

    const cows = capacity('herd')
    if (cows > 0) {
      const geometry = cowParts()
      const solid = sceneryMaterial('solid')
      this.cowBody = new Batch(geometry.body, solid, cows)
      this.cowLegsA = new Batch(geometry.legsA, solid, cows)
      this.cowLegsB = new Batch(geometry.legsB, solid, cows)
    } else {
      this.cowBody = this.cowLegsA = this.cowLegsB = null
    }
    this.floats = batches(floatParts(), capacity('float'))
    const walls = capacity('iceWall')
    this.iceWalls = batches(iceWallParts(), walls)
    this.boulders = batches(boulderParts(), capacity('rock'))
    if (walls > 0) {
      this.shards = new Batch(
        shardGeometry(),
        new THREE.MeshToonMaterial({ color: '#cdf3ff' }),
        SHARD_POOL,
      )
    } else {
      this.shards = null
    }

    for (const batch of this.allBatches()) this.object.add(batch.mesh)
  }

  update(obstacles: readonly HazardObstacle[], time: number): void {
    const dt = this.lastTime === null ? 0 : Math.min(Math.max(time - this.lastTime, 0), 0.1)
    this.lastTime = time
    for (const batch of this.allBatches()) batch.reset()

    obstacles.forEach((obstacle, index) => {
      const { position: at, heading, radius, kind } = obstacle
      if (kind === 'iceWall') this.trackBreak(index, obstacle)
      if (!obstacle.active) return
      this.rotation.setFromAxisAngle(UP, heading)
      const moving = obstacle.moving
      switch (kind) {
        case 'herd': {
          const s = radius / COW_UNIT_RADIUS
          const phase = time * LEG_SPEED + index * 1.7
          const bob = moving ? Math.abs(Math.sin(phase)) * COW_BOB * s : 0
          this.scale.setScalar(s)
          this.cowBody?.add(this.compose(at.x, at.y + bob, at.z))
          const angle = moving ? Math.sin(phase) * LEG_SWING : 0
          const hipY = at.y + COW_HIP * s + bob
          const yaw = this.rotation.clone()
          this.rotation.copy(yaw).multiply(this.swing.setFromAxisAngle(RIGHT, angle))
          this.cowLegsA?.add(this.compose(at.x, hipY, at.z))
          this.rotation.copy(yaw).multiply(this.swing.setFromAxisAngle(RIGHT, -angle))
          this.cowLegsB?.add(this.compose(at.x, hipY, at.z))
          break
        }
        case 'float': {
          const s = radius / FLOAT_UNIT_RADIUS
          const bob = moving ? Math.sin(time * 5 + index) * FLOAT_BOB * s : 0
          this.swing.setFromAxisAngle(FORWARD, moving ? Math.sin(time * 3 + index) * FLOAT_SWAY : 0)
          this.rotation.multiply(this.swing)
          this.scale.setScalar(s)
          const matrix = this.compose(at.x, at.y + Math.abs(bob), at.z)
          for (const batch of this.floats) batch.add(matrix)
          break
        }
        case 'iceWall': {
          this.scale.set(radius, Math.min(radius, ICE_MAX_HEIGHT), radius * 0.8)
          const matrix = this.compose(at.x, at.y, at.z)
          for (const batch of this.iceWalls) batch.add(matrix)
          break
        }
        case 'rock': {
          this.scale.setScalar(radius)
          const matrix = this.compose(at.x, at.y, at.z)
          for (const batch of this.boulders) batch.add(matrix)
          break
        }
      }
    })

    this.stepShards(dt)
    for (const batch of this.allBatches()) batch.flush()
  }

  private compose(x: number, y: number, z: number): THREE.Matrix4 {
    return this.matrix.compose(this.position.set(x, y, z), this.rotation, this.scale)
  }

  private allBatches(): Batch[] {
    const single = [this.cowBody, this.cowLegsA, this.cowLegsB, this.shards]
    return [
      ...single.filter((batch): batch is Batch => batch !== null),
      ...this.floats,
      ...this.iceWalls,
      ...this.boulders,
    ]
  }

  /** Spawns a burst of shards the moment an ice wall goes from standing to broken. */
  private trackBreak(index: number, obstacle: HazardObstacle): void {
    const before = this.wasActive[index] ?? obstacle.active
    this.wasActive[index] = obstacle.active
    if (!before || obstacle.active) return
    for (let i = 0; i < SHARDS_PER_BREAK; i++) {
      const spread = (this.random() - 0.5) * obstacle.radius * 2
      const side = Math.cos(obstacle.heading)
      const depth = -Math.sin(obstacle.heading)
      const shard: Shard = {
        position: new THREE.Vector3(
          obstacle.position.x + side * spread,
          obstacle.position.y + 0.4 + this.random() * Math.min(obstacle.radius, ICE_MAX_HEIGHT),
          obstacle.position.z + depth * spread,
        ),
        velocity: new THREE.Vector3(
          (this.random() - 0.5) * 8,
          3 + this.random() * 5,
          (this.random() - 0.5) * 8,
        ),
        spin: (this.random() - 0.5) * 12,
        age: 0,
      }
      this.shardPool.push(shard)
      if (this.shardPool.length > SHARD_POOL) this.shardPool.shift()
    }
  }

  private stepShards(dt: number): void {
    const shards = this.shards
    if (!shards) return
    for (let i = this.shardPool.length - 1; i >= 0; i--) {
      const shard = this.shardPool[i]
      if (!shard) continue
      shard.age += dt
      if (shard.age >= SHARD_LIFE) {
        this.shardPool.splice(i, 1)
        continue
      }
      shard.velocity.y -= SHARD_GRAVITY * dt
      shard.position.addScaledVector(shard.velocity, dt)
      shard.position.y = Math.max(shard.position.y, 0.05)
      const size = 1 - shard.age / SHARD_LIFE
      this.rotation.setFromAxisAngle(UP, shard.spin * shard.age)
      this.scale.setScalar(size)
      shards.add(this.matrix.compose(shard.position, this.rotation, this.scale))
    }
  }
}
