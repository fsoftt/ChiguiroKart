import type { Vec3 } from '../math'
import type { EntityKind, ItemEntity } from './itemTypes'

/** Per-entity state the render does not need (kept out of the shared `ItemEntity`). */
export interface EntityMeta {
  /** Slots already hit in the current pass (sombrero). */
  hitSlots: Set<number>
  /** Out-and-back laps still to fly, including the current one (sombrero). */
  lapsLeft: number
  /** True while the sombrero flies back to its owner. */
  returning: boolean
  /** Seconds since the current outward leg started (sombrero). */
  legTime: number
}

export interface EntityInit {
  kind: EntityKind
  position: Vec3
  heading: number
  ownerSlot: number
  targetSlot?: number
  charged: boolean
  lapsLeft?: number
}

/** Owns the list of live entities, their ids and their private state. */
export class EntityStore {
  private nextId = 1
  private readonly meta = new Map<number, EntityMeta>()

  constructor(readonly list: ItemEntity[]) {}

  spawn(init: EntityInit): ItemEntity {
    const entity: ItemEntity = {
      id: this.nextId++,
      kind: init.kind,
      position: { ...init.position },
      heading: init.heading,
      ownerSlot: init.ownerSlot,
      targetSlot: init.targetSlot ?? -1,
      charged: init.charged,
      age: 0,
    }
    this.list.push(entity)
    this.meta.set(entity.id, {
      hitSlots: new Set<number>(),
      lapsLeft: init.lapsLeft ?? 0,
      returning: false,
      legTime: 0,
    })
    return entity
  }

  metaOf(entity: ItemEntity): EntityMeta {
    const meta = this.meta.get(entity.id)
    if (!meta) throw new Error(`Missing state of entity ${entity.id}`)
    return meta
  }

  remove(entity: ItemEntity): void {
    const index = this.list.indexOf(entity)
    if (index >= 0) this.list.splice(index, 1)
    this.meta.delete(entity.id)
  }

  /** Removes everything and restarts the ids at 1. */
  clear(): void {
    this.list.length = 0
    this.meta.clear()
    this.nextId = 1
  }
}
