import { pickPower, usesFor } from './distribution'
import type { ItemContext } from './itemContext'
import { POWER_IDS, type PowerId } from './itemTypes'
import type { Racer } from '../racer'

function randomPower(ctx: ItemContext): PowerId {
  const index = Math.min(Math.floor(ctx.rng() * POWER_IDS.length), POWER_IDS.length - 1)
  return POWER_IDS[index] ?? 'coco'
}

/** Starts spinning the roulette if the slot is free. Returns true if it started. */
export function startRoulette(ctx: ItemContext, racer: Racer): boolean {
  const slot = racer.items.slot
  if (slot.power !== null || slot.rouletteTime > 0) return false
  slot.rouletteTime = ctx.config.boxes.rouletteTime
  slot.rouletteShowing = randomPower(ctx)
  return true
}

/** Spins the display every tick; at the end picks the power by the racer's position. */
export function tickRoulette(ctx: ItemContext, racer: Racer, dt: number): void {
  const slot = racer.items.slot
  if (slot.rouletteTime <= 0) return
  const { rouletteTime, rouletteTick } = ctx.config.boxes
  const ticksBefore = Math.floor((rouletteTime - slot.rouletteTime) / rouletteTick)
  slot.rouletteTime = Math.max(0, slot.rouletteTime - dt)
  if (slot.rouletteTime > 0) {
    const ticksAfter = Math.floor((rouletteTime - slot.rouletteTime) / rouletteTick)
    if (ticksAfter > ticksBefore) slot.rouletteShowing = randomPower(ctx)
    return
  }
  finishRoulette(ctx, racer)
}

function finishRoulette(ctx: ItemContext, racer: Racer): void {
  const slot = racer.items.slot
  const rank = ctx.standings.indexOf(racer) + 1
  const power = pickPower(ctx.config, rank, ctx.standings.length, ctx.rng)
  slot.power = power
  slot.charged = racer.items.uchuvas >= ctx.config.uchuvas.max
  slot.uses = usesFor(ctx.config, power, slot.charged)
  slot.rouletteShowing = null
}
