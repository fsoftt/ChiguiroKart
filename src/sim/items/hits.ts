import { endDrift } from '../kart/drift'
import type { Racer } from '../racer'
import { isRacing, type ItemContext } from './itemContext'
import { createItemSlot, type HitKind } from './itemTypes'

/** True while an armadillo shield protects the racer. */
export function hasShield(racer: Racer): boolean {
  const status = racer.items.status
  return status.shieldHits > 0 && status.shieldTime > 0
}

/** Removes the shield; the armadillo that made it leaves the slot with it. */
export function dropShield(racer: Racer): void {
  const { status, slot } = racer.items
  status.shieldHits = 0
  status.shieldTime = 0
  if (slot.power === 'armadillo') Object.assign(slot, createItemSlot())
}

/**
 * Mask and shield protection shared by hits and uchuva thefts. Returns true if the target
 * is protected (and emits 'blocked'); a shield loses one hit.
 */
export function absorbedByProtection(ctx: ItemContext, target: Racer): boolean {
  const status = target.items.status
  const position = { ...target.kart.position }
  if (status.maskTime > 0) {
    ctx.emit({ type: 'blocked', slot: target.slot, position })
    return true
  }
  if (hasShield(target)) {
    status.shieldHits -= 1
    if (status.shieldHits <= 0) dropShield(target)
    ctx.emit({ type: 'blocked', slot: target.slot, position })
    return true
  }
  return false
}

/**
 * The one hit rule. Returns true if the hit landed.
 * Order: not racing (finished racers cannot be hit) -> mask -> invulnerability -> shield.
 */
export function applyHit(ctx: ItemContext, target: Racer, kind: HitKind): boolean {
  if (!isRacing(target)) return false
  const status = target.items.status
  if (status.maskTime > 0) {
    absorbedByProtection(ctx, target)
    return false
  }
  if (status.invulnerableTime > 0) return false
  if (absorbedByProtection(ctx, target)) return false

  const { hit, uchuvas } = ctx.config
  const kart = target.kart
  status.hit = kind
  status.hitTime = kind === 'spin' ? hit.spinTime : hit.flipTime
  status.spinAngle = 0
  status.dizzyTime = 0
  status.invulnerableTime = hit.invulnerableTime
  target.items.uchuvas = Math.max(0, target.items.uchuvas - uchuvas.lostPerHit)
  endDrift(kart)
  if (kind === 'flip') {
    kart.velocity.y = hit.flipLaunchSpeed
    kart.onGround = false
  }
  ctx.emit({ type: 'hit', slot: target.slot, kind, position: { ...kart.position } })
  return true
}

/** Moves up to `amount` uchuvas from one racer to another (the thief is capped at the max). */
export function stealUchuvas(ctx: ItemContext, from: Racer, to: Racer, amount: number): void {
  const taken = Math.min(from.items.uchuvas, amount)
  if (taken <= 0) return
  from.items.uchuvas -= taken
  to.items.uchuvas = Math.min(ctx.config.uchuvas.max, to.items.uchuvas + taken)
  ctx.emit({ type: 'uchuvasStolen', from: from.slot, to: to.slot, amount: taken })
}
