import type { DriftConfig } from '../../config/drift'
import type { ItemsConfig } from '../../config/items'
import type { Rng } from '../../ai/random'
import type { Racer } from '../racer'
import type { Track } from '../track'
import type { EntityStore } from './entityStore'
import type { ItemEvent } from './itemTypes'

/** Everything the item modules need during one step. */
export interface ItemContext {
  readonly track: Track
  readonly config: ItemsConfig
  readonly drift: DriftConfig
  readonly rng: Rng
  readonly entities: EntityStore
  /** Every racer in the race (slot order is not guaranteed). */
  readonly racers: readonly Racer[]
  /** Racers sorted leader first, computed once per step. */
  readonly standings: readonly Racer[]
  emit(event: ItemEvent): void
}

/** Only racers in the 'racing' phase pick up, use and suffer powers. */
export function isRacing(racer: Racer): boolean {
  return racer.race.state.phase === 'racing'
}

export function findRacer(ctx: ItemContext, slot: number): Racer | undefined {
  return ctx.racers.find((racer) => racer.slot === slot)
}

/** Racers in front of `user` in the standings, leader first. */
export function racersAhead(ctx: ItemContext, user: Racer): Racer[] {
  const index = ctx.standings.indexOf(user)
  return index <= 0 ? [] : ctx.standings.slice(0, index)
}

/** Horizontal distance between two points. */
export function distanceXZ(a: { x: number; z: number }, b: { x: number; z: number }): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

/** True if the racer's kart is within `radius` (horizontally) and the contact height of `at`. */
export function isTouching(
  ctx: ItemContext,
  racer: Racer,
  at: { x: number; y: number; z: number },
  radius: number,
): boolean {
  const position = racer.kart.position
  if (Math.abs(position.y - at.y) > ctx.config.powers.contactHeight) return false
  return distanceXZ(position, at) <= radius
}

/** Racing karts within `radius` of `at`, skipping the given slot. */
export function kartsNear(
  ctx: ItemContext,
  at: { x: number; y: number; z: number },
  radius: number,
  skipSlot = -1,
): Racer[] {
  return ctx.racers.filter(
    (racer) => racer.slot !== skipSlot && isRacing(racer) && isTouching(ctx, racer, at, radius),
  )
}
