/**
 * Shared contract for stage 5 (powers and uchuvas).
 * The simulation (`ItemSystem`) writes these; the HUD, the render and the bots only read them.
 */
import type { Vec3 } from '../math'
import type { HazardKind } from '../track'

/** Every power in docs/diseno.md §5. */
export type PowerId =
  | 'coco'
  | 'tejo'
  | 'mango'
  | 'panela'
  | 'armadillo'
  | 'avispa'
  | 'colibri'
  | 'mosquitos'
  | 'sombrero'
  | 'hormigas'
  | 'aguacero'
  | 'rayo'
  | 'mascara'

export const POWER_IDS: readonly PowerId[] = [
  'coco',
  'tejo',
  'mango',
  'panela',
  'armadillo',
  'avispa',
  'colibri',
  'mosquitos',
  'sombrero',
  'hormigas',
  'aguacero',
  'rayo',
  'mascara',
]

/** How a hit kart reacts: spin out, get launched into the air, or both followed by dizziness. */
export type HitKind = 'spin' | 'flip'

/** Item slot of one racer. */
export interface ItemSlot {
  /** Power held, ready to use (null = empty). */
  power: PowerId | null
  /** Uses left of the held power (3 mangos, 2 tejos...). 0 when empty. */
  uses: number
  /** True if the held power was rolled in Bien Cargado mode (stronger version). */
  charged: boolean
  /** Seconds left of the roulette; > 0 while spinning, the slot is empty meanwhile. */
  rouletteTime: number
  /** Power shown by the roulette right now (only meaningful while it spins). */
  rouletteShowing: PowerId | null
}

/** Temporary effects on one racer. Timers in seconds; 0 = not active. */
export interface RacerStatus {
  /** Hit reaction in progress (no control). */
  hit: HitKind | null
  hitTime: number
  /** Hit animation angle (rad): extra yaw while spinning out, somersault pitch while flipping. */
  spinAngle: number
  /** Reduced top speed after a hit. */
  dizzyTime: number
  /** Armadillo shield around the kart: hits it still absorbs (0 = no shield). */
  shieldHits: number
  shieldTime: number
  /** Carnival mask: invincible, faster, knocks down karts it touches. */
  maskTime: number
  /** Mosquito cloud on screen; `zigzag` makes the kart weave (Bien Cargado). */
  blindTime: number
  zigzag: boolean
  /** Rain cloud overhead: less grip; `slowed` also lowers the top speed (Bien Cargado). */
  rainTime: number
  slowed: boolean
  /** Seconds a hit cannot land again, so one blast does not hit twice. */
  invulnerableTime: number
}

/** Everything item-related a racer carries. */
export interface RacerItems {
  uchuvas: number
  slot: ItemSlot
  status: RacerStatus
  /** Use button state at the previous step, for rising-edge detection. */
  useHeld: boolean
}

/** Kinds of objects moving or lying on the track. */
export type EntityKind =
  'coco' | 'tejo' | 'mango' | 'armadillo' | 'avispa' | 'colibri' | 'sombrero' | 'hormigas'

/** A thrown or dropped power on the track. */
export interface ItemEntity {
  /** Unique, increasing id (stable across steps, for the render to keep its meshes). */
  readonly id: number
  readonly kind: EntityKind
  position: Vec3
  /** Direction of travel (rad, same convention as `KartState.heading`). */
  heading: number
  /** Grid slot of the racer that used it. */
  readonly ownerSlot: number
  /** Grid slot of the racer it chases (avispa, colibri, hormigas), -1 if none. */
  targetSlot: number
  /** Bien Cargado version. */
  readonly charged: boolean
  /** Seconds since it was created. */
  age: number
}

/** A pickup spot on the track: a power box or an uchuva. */
export interface Pickup {
  readonly position: Vec3
  /** False while it waits to respawn after being taken. */
  active: boolean
  /** Seconds left until it respawns (0 when active). */
  respawnTime: number
}

/** One-off things that happened during a step, for effects and the HUD. */
export type ItemEvent =
  | { type: 'boxTaken'; slot: number; position: Vec3 }
  | { type: 'uchuvaTaken'; slot: number; position: Vec3 }
  | { type: 'powerUsed'; slot: number; power: PowerId; charged: boolean }
  | { type: 'hit'; slot: number; kind: HitKind; position: Vec3 }
  | { type: 'blocked'; slot: number; position: Vec3 }
  | { type: 'explosion'; position: Vec3; radius: number }
  | { type: 'lightning'; slots: readonly number[] }
  | { type: 'uchuvasStolen'; from: number; to: number; amount: number }
  /** A kart bumped into a track obstacle (float, rock, ice wall). */
  | { type: 'hazardBump'; slot: number; kind: HazardKind; position: Vec3 }
  /** A level 3 nitro broke an ice wall (`hazard` = index in `Track.hazards`). */
  | { type: 'iceWallBroken'; slot: number; hazard: number; position: Vec3 }
  /** A broken ice wall closed again. */
  | { type: 'iceWallRestored'; hazard: number; position: Vec3 }

export function createItemSlot(): ItemSlot {
  return { power: null, uses: 0, charged: false, rouletteTime: 0, rouletteShowing: null }
}

export function createRacerStatus(): RacerStatus {
  return {
    hit: null,
    hitTime: 0,
    spinAngle: 0,
    dizzyTime: 0,
    shieldHits: 0,
    shieldTime: 0,
    maskTime: 0,
    blindTime: 0,
    zigzag: false,
    rainTime: 0,
    slowed: false,
    invulnerableTime: 0,
  }
}

export function createRacerItems(): RacerItems {
  return { uchuvas: 0, slot: createItemSlot(), status: createRacerStatus(), useHeld: false }
}
