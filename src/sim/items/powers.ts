import { addBoost } from '../kart/boost'
import { powerDurationFactor } from '../characters'
import { forwardOf, headingOf } from '../math'
import type { Racer } from '../racer'
import { dropShield, applyHit, hasShield, absorbedByProtection } from './hits'
import { distanceXZ, isRacing, racersAhead, type ItemContext } from './itemContext'
import { createItemSlot, type EntityKind, type PowerId } from './itemTypes'

/**
 * What using a power did to the slot:
 * - 'consumed': one use spent;
 * - 'kept': the power did something but stays in the slot (armadillo shield);
 * - 'refused': nothing happened (e.g. hormigas with no rival in range).
 */
export type UseResult = 'consumed' | 'kept' | 'refused'

interface Use {
  ctx: ItemContext
  user: Racer
  charged: boolean
  /** True when the player holds look-back: throw behind instead of ahead. */
  backwards: boolean
}

type PowerHandler = (use: Use) => UseResult

/** Uses the power held in the user's slot. Spends a use or leaves the slot as it was. */
export function usePower(ctx: ItemContext, user: Racer, backwards: boolean): UseResult {
  const slot = user.items.slot
  const { power, charged } = slot
  if (power === null) return 'refused'
  const result = HANDLERS[power]({ ctx, user, charged, backwards })
  if (result === 'refused') return result
  ctx.emit({ type: 'powerUsed', slot: user.slot, power, charged })
  if (result === 'consumed') spendUse(user)
  return result
}

function spendUse(user: Racer): void {
  const slot = user.items.slot
  slot.uses -= 1
  if (slot.uses <= 0) Object.assign(slot, createItemSlot())
}

// --- spawning ---

function spawnAt(use: Use, kind: EntityKind, ahead: boolean, extra: Partial<EntityExtra> = {}) {
  const { ctx, user, charged, backwards } = use
  const { spawnDistance, dropDistance, entityHeight } = ctx.config.powers
  const throwBack = ahead ? backwards : true
  const heading = user.kart.heading + (throwBack ? Math.PI : 0)
  const distance = ahead ? spawnDistance : dropDistance
  const direction = forwardOf(heading)
  const { x, z } = user.kart.position
  const sx = x + direction.x * distance
  const sz = z + direction.z * distance
  return ctx.entities.spawn({
    kind,
    position: { x: sx, y: ctx.track.groundHeight(sx, sz) + entityHeight, z: sz },
    heading,
    ownerSlot: user.slot,
    charged,
    ...extra,
  })
}

interface EntityExtra {
  targetSlot: number
  lapsLeft: number
}

// --- handlers ---

const throwCoco: PowerHandler = (use) => {
  spawnAt(use, 'coco', true)
  return 'consumed'
}

const dropTejo: PowerHandler = (use) => {
  spawnAt(use, 'tejo', false)
  return 'consumed'
}

const dropMango: PowerHandler = (use) => {
  spawnAt(use, 'mango', false)
  return 'consumed'
}

const useMascara: PowerHandler = ({ ctx, user, charged }) => {
  const { mascara } = ctx.config.powers
  const duration = charged ? mascara.chargedDuration : mascara.duration
  user.items.status.maskTime = duration * powerDurationFactor(user.character)
  return 'consumed'
}

const usePanela: PowerHandler = ({ ctx, user, charged }) => {
  const { panela } = ctx.config.powers
  addBoost(
    user.kart,
    charged ? panela.chargedLevel : panela.level,
    panela.duration * powerDurationFactor(user.character),
    false,
    ctx.drift,
  )
  return 'consumed'
}

/**
 * Armadillo: the first press raises the shield and the power stays in the slot (use 'kept');
 * a second press while the shield is up throws it. The slot empties when it is thrown or the
 * shield ends (time out or hits used up, see `dropShield`).
 */
const useArmadillo: PowerHandler = (use) => {
  const { ctx, user, charged } = use
  const { armadillo } = ctx.config.powers
  if (hasShield(user)) {
    dropShield(user)
    spawnAt(use, 'armadillo', true)
    return 'kept'
  }
  const status = user.items.status
  status.shieldHits = charged ? armadillo.chargedHits : armadillo.hits
  status.shieldTime = armadillo.duration * powerDurationFactor(user.character)
  return 'kept'
}

const useAvispa: PowerHandler = (use) => {
  const target = racersAhead(use.ctx, use.user).pop()
  spawnAt(use, 'avispa', true, { targetSlot: target?.slot ?? -1 })
  return 'consumed'
}

const useColibri: PowerHandler = (use) => {
  const { ctx, user, charged } = use
  const { colibri } = ctx.config.powers
  const count = charged ? colibri.chargedTargets : colibri.targets
  const targets = ctx.standings.filter((racer) => racer !== user && isRacing(racer)).slice(0, count)
  for (const target of targets) spawnAt(use, 'colibri', true, { targetSlot: target.slot })
  return 'consumed'
}

const useMosquitos: PowerHandler = ({ ctx, user, charged }) => {
  const { mosquitos } = ctx.config.powers
  for (const racer of racersAhead(ctx, user)) {
    if (!isRacing(racer)) continue
    if (racer.items.status.maskTime > 0) {
      absorbedByProtection(ctx, racer)
      continue
    }
    const duration = charged ? mosquitos.chargedDuration : mosquitos.duration
    racer.items.status.blindTime = duration * powerDurationFactor(user.character)
    racer.items.status.zigzag = charged
  }
  return 'consumed'
}

const useSombrero: PowerHandler = (use) => {
  const { sombrero } = use.ctx.config.powers
  spawnAt(use, 'sombrero', true, { lapsLeft: use.charged ? sombrero.chargedLaps : sombrero.laps })
  return 'consumed'
}

const useHormigas: PowerHandler = (use) => {
  const { ctx, user } = use
  const { range } = ctx.config.powers.hormigas
  const rivals = ctx.racers
    .filter((racer) => racer !== user && isRacing(racer))
    .map((racer) => ({ racer, distance: distanceXZ(racer.kart.position, user.kart.position) }))
    .filter((entry) => entry.distance <= range)
    .sort((a, b) => a.distance - b.distance || a.racer.slot - b.racer.slot)
  const nearest = rivals[0]
  if (!nearest) return 'refused'
  const { kart } = user
  const toTarget = headingOf(
    nearest.racer.kart.position.x - kart.position.x,
    nearest.racer.kart.position.z - kart.position.z,
  )
  const entity = spawnAt(use, 'hormigas', true, { targetSlot: nearest.racer.slot })
  entity.heading = toTarget
  return 'consumed'
}

const useAguacero: PowerHandler = ({ ctx, user, charged }) => {
  const { aguacero } = ctx.config.powers
  for (const racer of racersAhead(ctx, user)) {
    if (!isRacing(racer)) continue
    racer.items.status.rainTime = aguacero.duration * powerDurationFactor(user.character)
    racer.items.status.slowed = charged
  }
  return 'consumed'
}

const useRayo: PowerHandler = ({ ctx, user, charged }) => {
  const ahead = racersAhead(ctx, user)
  ctx.emit({ type: 'lightning', slots: ahead.map((racer) => racer.slot) })
  for (const racer of ahead) {
    const landed = applyHit(ctx, racer, ctx.config.powers.rayo.hit)
    if (landed && charged) Object.assign(racer.items.slot, createItemSlot())
  }
  return 'consumed'
}

const HANDLERS: Record<PowerId, PowerHandler> = {
  coco: throwCoco,
  tejo: dropTejo,
  mango: dropMango,
  panela: usePanela,
  armadillo: useArmadillo,
  avispa: useAvispa,
  colibri: useColibri,
  mosquitos: useMosquitos,
  sombrero: useSombrero,
  hormigas: useHormigas,
  aguacero: useAguacero,
  rayo: useRayo,
  mascara: useMascara,
}
