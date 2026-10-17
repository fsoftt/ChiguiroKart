import * as THREE from 'three'
import type { Racer } from '../../sim/racer'
import type { ItemSystem } from '../../sim/items/itemSystem'
import type { EntityKind, ItemEvent, Pickup } from '../../sim/items/itemTypes'
import {
  createBoxMaterials,
  createBoxVisual,
  createEntityVisual,
  createUchuvaVisual,
  entityScale,
  type EntityVisual,
} from './itemMeshes'
import { bobOffset, cycleHue, explosionRadius, fadeOut, lifeProgress } from './itemViewLogic'
import { markShadows } from '../shadows'
import { RacerStatusView } from './racerStatusView'

const BOX_LIFT = 1.1
const UCHUVA_LIFT = 0.7
const BOLT_HEIGHT = 40
const EFFECT_POOL = 8
const EXPLOSION_LIFE = 0.5
const BOLT_LIFE = 0.4
const PUFF_LIFE = 0.5
/** Explosions and lightning are brighter than white so the bloom pass picks them up. */
const EFFECT_GLOW = 2.2
const PUFFS_PER_HIT = 3

/** A short-lived pooled effect mesh. */
interface Transient {
  mesh: THREE.Mesh
  material: THREE.MeshBasicMaterial
  age: number
  life: number
  size: number
  active: boolean
}

function createPool(
  geometry: THREE.BufferGeometry,
  color: string,
  parent: THREE.Group,
  /** Brightness multiplier; above 1 the effect is bright enough to bloom. */
  glow = 1,
): Transient[] {
  const pool: Transient[] = []
  for (let i = 0; i < EFFECT_POOL; i++) {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      depthWrite: false,
      fog: false,
    })
    material.color.multiplyScalar(glow)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.visible = false
    parent.add(mesh)
    pool.push({ mesh, material, age: 0, life: 1, size: 1, active: false })
  }
  return pool
}

function acquire(pool: Transient[]): Transient {
  const free = pool.find((item) => !item.active)
  if (free) return free
  // Pool exhausted: recycle the oldest
  return pool.reduce(
    (oldest, item) => (item.age > oldest.age ? item : oldest),
    pool[0] as Transient,
  )
}

function start(item: Transient, life: number, size: number): void {
  item.active = true
  item.age = 0
  item.life = life
  item.size = size
  item.mesh.visible = true
}

/**
 * Placeholder visuals for stage 5: power boxes, uchuvas, thrown powers, per-kart status
 * effects and one-off event effects. Meshes are created once and reused (pooled).
 */
export class ItemView {
  readonly object = new THREE.Group()

  private readonly boxMaterials = createBoxMaterials()
  private readonly boxViews: THREE.Group[] = []
  private readonly uchuvaViews: THREE.Group[] = []
  private readonly entities = new Map<number, { visual: EntityVisual; seen: number }>()
  private readonly freeVisuals = new Map<EntityKind, EntityVisual[]>()
  private readonly statusViews: RacerStatusView[] = []
  private frame = 0
  private time = 0

  private readonly explosions: Transient[]
  private readonly bolts: Transient[]
  private readonly puffs: Transient[]

  constructor() {
    this.explosions = createPool(
      new THREE.SphereGeometry(1, 16, 12),
      '#ff9a2e',
      this.object,
      EFFECT_GLOW,
    )
    this.bolts = createPool(
      new THREE.BoxGeometry(0.4, BOLT_HEIGHT, 0.4),
      '#f4f8ff',
      this.object,
      EFFECT_GLOW,
    )
    this.puffs = createPool(new THREE.OctahedronGeometry(0.35), '#ffe14a', this.object)
  }

  /** Karts to hang the status effects on, indexed by grid slot (the player is slot 0). */
  setKarts(objects: readonly THREE.Object3D[]): void {
    for (const view of this.statusViews) view.object.removeFromParent()
    this.statusViews.length = 0
    for (const parent of objects) {
      const view = new RacerStatusView()
      parent.add(view.object)
      this.statusViews.push(view)
    }
  }

  /** Drops every entity and effect (new race or back to the menu). */
  reset(): void {
    for (const entry of this.entities.values()) this.release(entry.visual)
    this.entities.clear()
    for (const item of [...this.explosions, ...this.bolts, ...this.puffs]) {
      item.active = false
      item.mesh.visible = false
    }
  }

  update(system: ItemSystem, racers: readonly Racer[], dt: number): void {
    this.time += dt
    this.frame++
    this.updatePickups(system.boxes, system.uchuvas)
    this.updateEntities(system)
    for (let i = 0; i < this.statusViews.length; i++) {
      const racer = racers[i]
      if (racer) this.statusViews[i]?.update(racer.items.status, this.time)
    }
    this.updateTransients(dt)
  }

  /** Spawns the effects for the step's events. */
  handleEvents(events: readonly ItemEvent[], racers: readonly Racer[]): void {
    for (const event of events) {
      if (event.type === 'explosion') {
        const item = acquire(this.explosions)
        item.mesh.position.set(event.position.x, event.position.y + 0.6, event.position.z)
        start(item, EXPLOSION_LIFE, event.radius)
      } else if (event.type === 'lightning') {
        for (const slot of event.slots) {
          const kart = racers[slot]?.kart
          if (!kart) continue
          const item = acquire(this.bolts)
          item.mesh.position.set(
            kart.position.x,
            kart.position.y + BOLT_HEIGHT / 2,
            kart.position.z,
          )
          start(item, BOLT_LIFE, 1)
        }
      } else if (event.type === 'hit') {
        for (let i = 0; i < PUFFS_PER_HIT; i++) {
          const item = acquire(this.puffs)
          const angle = (i / PUFFS_PER_HIT) * Math.PI * 2 + this.time
          item.mesh.position.set(
            event.position.x + Math.cos(angle) * 0.6,
            event.position.y + 1.3,
            event.position.z + Math.sin(angle) * 0.6,
          )
          start(item, PUFF_LIFE, 1)
        }
      }
    }
  }

  private updatePickups(boxes: readonly Pickup[], uchuvas: readonly Pickup[]): void {
    if (this.boxViews.length !== boxes.length) {
      for (const view of this.boxViews) view.removeFromParent()
      this.boxViews.length = 0
      for (const pickup of boxes) {
        const { group } = createBoxVisual(this.boxMaterials.cube, this.boxMaterials.label)
        group.position.set(pickup.position.x, pickup.position.y + BOX_LIFT, pickup.position.z)
        markShadows(group, { cast: true })
        this.object.add(group)
        this.boxViews.push(group)
      }
    }
    if (this.uchuvaViews.length !== uchuvas.length) {
      for (const view of this.uchuvaViews) view.removeFromParent()
      this.uchuvaViews.length = 0
      for (const pickup of uchuvas) {
        const { group } = createUchuvaVisual()
        group.position.set(pickup.position.x, pickup.position.y + UCHUVA_LIFT, pickup.position.z)
        markShadows(group, { cast: true })
        this.object.add(group)
        this.uchuvaViews.push(group)
      }
    }

    this.boxMaterials.cube.color.setHSL(cycleHue(this.time, 0.35), 0.9, 0.6)
    for (let i = 0; i < boxes.length; i++) {
      const view = this.boxViews[i]
      const pickup = boxes[i]
      if (!view || !pickup) continue
      view.visible = pickup.active
      if (!pickup.active) continue
      view.position.y = pickup.position.y + BOX_LIFT + bobOffset(this.time, i, 0.2, 2.5)
      view.rotation.y = this.time * 1.4 + i
      view.rotation.x = 0.4
    }
    for (let i = 0; i < uchuvas.length; i++) {
      const view = this.uchuvaViews[i]
      const pickup = uchuvas[i]
      if (!view || !pickup) continue
      view.visible = pickup.active
      if (!pickup.active) continue
      view.position.y = pickup.position.y + UCHUVA_LIFT + bobOffset(this.time, i, 0.12, 3)
      view.rotation.y = this.time * 2.2 + i
    }
  }

  private updateEntities(system: ItemSystem): void {
    for (const entity of system.entities) {
      let entry = this.entities.get(entity.id)
      if (!entry) {
        const visual = this.takeVisual(entity.kind)
        const scale = entityScale(entity.charged)
        visual.group.scale.setScalar(scale)
        markShadows(visual.group, { cast: true })
        this.object.add(visual.group)
        entry = { visual, seen: this.frame }
        this.entities.set(entity.id, entry)
      }
      entry.seen = this.frame
      const { group, spinner, wings } = entry.visual
      group.position.set(entity.position.x, entity.position.y, entity.position.z)
      group.rotation.y = entity.heading
      switch (entity.kind) {
        case 'coco':
        case 'armadillo':
          spinner.rotation.x = entity.age * 9
          break
        case 'sombrero':
          spinner.rotation.y = entity.age * 14
          break
        case 'tejo':
          spinner.rotation.y = entity.age * 2
          break
        case 'avispa':
        case 'colibri': {
          const flap = Math.sin(entity.age * 60) * 0.7
          for (const [index, wing] of wings.entries()) wing.rotation.z = index === 0 ? flap : -flap
          break
        }
        default:
          break
      }
    }
    // Entities that were not seen this frame are gone
    for (const [id, entry] of this.entities) {
      if (entry.seen === this.frame) continue
      this.release(entry.visual)
      this.entities.delete(id)
    }
  }

  private takeVisual(kind: EntityKind): EntityVisual {
    const free = this.freeVisuals.get(kind)?.pop()
    return free ?? createEntityVisual(kind)
  }

  private release(visual: EntityVisual): void {
    visual.group.removeFromParent()
    let list = this.freeVisuals.get(visual.kind)
    if (!list) {
      list = []
      this.freeVisuals.set(visual.kind, list)
    }
    list.push(visual)
  }

  private updateTransients(dt: number): void {
    for (const item of this.explosions) {
      if (!this.advance(item, dt)) continue
      const t = lifeProgress(item.age, item.life)
      item.mesh.scale.setScalar(explosionRadius(t, item.size))
      item.material.opacity = 0.85 * fadeOut(t)
    }
    for (const item of this.bolts) {
      if (!this.advance(item, dt)) continue
      const t = lifeProgress(item.age, item.life)
      item.material.opacity = fadeOut(t) * (0.6 + 0.4 * Math.sin(item.age * 90))
      item.mesh.scale.x = item.mesh.scale.z = 1 + (1 - t) * 1.5
    }
    for (const item of this.puffs) {
      if (!this.advance(item, dt)) continue
      const t = lifeProgress(item.age, item.life)
      item.mesh.scale.setScalar(0.5 + t * 1.5)
      item.mesh.rotation.y += dt * 8
      item.mesh.position.y += dt * 1.5
      item.material.opacity = fadeOut(t)
    }
  }

  /** Ages an active effect; hides it and returns false once it ends. */
  private advance(item: Transient, dt: number): boolean {
    if (!item.active) return false
    item.age += dt
    if (item.age < item.life) return true
    item.active = false
    item.mesh.visible = false
    return false
  }
}
