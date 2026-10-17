import type { HitConfig } from '../../config/items'
import { clamp } from '../math'
import { recoveryRate } from '../characters'
import type { Racer } from '../racer'
import { dropShield } from './hits'

/** Advances every temporary effect of one racer by `dt`. */
export function tickStatus(racer: Racer, hit: HitConfig, dt: number): void {
  const status = racer.items.status
  tickHit(racer, hit, dt * recoveryRate(racer.character))

  if (status.shieldTime > 0) {
    status.shieldTime -= dt
    if (status.shieldTime <= 0) dropShield(racer)
  }
  status.maskTime = Math.max(0, status.maskTime - dt)
  status.blindTime = Math.max(0, status.blindTime - dt)
  if (status.blindTime === 0) status.zigzag = false
  status.rainTime = Math.max(0, status.rainTime - dt)
  if (status.rainTime === 0) status.slowed = false
  status.invulnerableTime = Math.max(0, status.invulnerableTime - dt)
}

/** Hit reaction: the view spins or somersaults; when it ends the kart gets dizzy. */
function tickHit(racer: Racer, hit: HitConfig, dt: number): void {
  const status = racer.items.status
  if (status.hit === null) {
    status.dizzyTime = Math.max(0, status.dizzyTime - dt)
    return
  }
  status.hitTime -= dt
  if (status.hitTime > 0) {
    // Spin-outs turn the view `spinTurns` times; flips make one somersault
    const total = status.hit === 'spin' ? hit.spinTime : hit.flipTime
    const turns = status.hit === 'spin' ? hit.spinTurns : 1
    const progress = 1 - clamp(status.hitTime / total, 0, 1)
    status.spinAngle = Math.PI * 2 * turns * progress
    return
  }
  status.hit = null
  status.hitTime = 0
  status.spinAngle = 0
  status.dizzyTime = hit.dizzyTime
}
