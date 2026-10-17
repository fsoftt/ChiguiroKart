import { forwardOf, headingOf, wrapAngle, type Vec3 } from '../math'
import type { Racer } from '../racer'
import { absorbedByProtection, applyHit, stealUchuvas } from './hits'
import {
  distanceXZ,
  findRacer,
  isRacing,
  isTouching,
  kartsNear,
  type ItemContext,
} from './itemContext'
import type { ItemEntity } from './itemTypes'

/** Moves every entity one step and resolves what it touches. Dead entities are removed. */
export function stepEntities(ctx: ItemContext, dt: number): void {
  for (const entity of [...ctx.entities.list]) {
    entity.age += dt
    if (!stepEntity(ctx, entity, dt)) ctx.entities.remove(entity)
  }
}

/** Returns true while the entity lives on. */
function stepEntity(ctx: ItemContext, entity: ItemEntity, dt: number): boolean {
  switch (entity.kind) {
    case 'coco':
      return stepCoco(ctx, entity, dt)
    case 'tejo':
      return stepTejo(ctx, entity)
    case 'mango':
      return stepMango(ctx, entity)
    case 'armadillo':
      return stepArmadillo(ctx, entity, dt)
    case 'avispa':
      return stepAvispa(ctx, entity, dt)
    case 'colibri':
      return stepColibri(ctx, entity, dt)
    case 'sombrero':
      return stepSombrero(ctx, entity, dt)
    case 'hormigas':
      return stepHormigas(ctx, entity, dt)
  }
}

// --- shared helpers ---

function setGroundHeight(ctx: ItemContext, entity: ItemEntity): void {
  const { x, z } = entity.position
  entity.position.y = ctx.track.roadHeight(x, z) + ctx.config.powers.entityHeight
}

function moveForward(entity: ItemEntity, distance: number): void {
  const forward = forwardOf(entity.heading)
  entity.position.x += forward.x * distance
  entity.position.z += forward.z * distance
}

function isOutsideRoad(ctx: ItemContext, position: Vec3): boolean {
  const projection = ctx.track.project(position.x, position.z)
  return projection.distance > projection.halfWidth
}

/** Turns toward a point by at most `turnRate * dt`. */
function steerToward(entity: ItemEntity, target: Vec3, turnRate: number, dt: number): void {
  const wanted = headingOf(target.x - entity.position.x, target.z - entity.position.z)
  const diff = wrapAngle(wanted - entity.heading)
  const maxTurn = turnRate * dt
  entity.heading = wrapAngle(entity.heading + Math.max(-maxTurn, Math.min(maxTurn, diff)))
}

/** First racing kart other than the owner (until its immunity ends) touching the entity. */
function touchedKart(ctx: ItemContext, entity: ItemEntity, immunity: number): Racer | undefined {
  const skip = entity.age < immunity ? entity.ownerSlot : -1
  return kartsNear(ctx, entity.position, ctx.config.powers.contactRadius, skip)[0]
}

export function explode(ctx: ItemContext, at: Vec3, radius: number): void {
  ctx.emit({ type: 'explosion', position: { ...at }, radius })
  for (const racer of kartsNear(ctx, at, radius)) applyHit(ctx, racer, 'flip')
}

// --- coco, tejo, mango ---

function stepCoco(ctx: ItemContext, entity: ItemEntity, dt: number): boolean {
  const { coco } = ctx.config.powers
  moveForward(entity, coco.speed * dt)
  setGroundHeight(ctx, entity)
  const blown =
    isOutsideRoad(ctx, entity.position) ||
    entity.age >= coco.fuse ||
    touchedKart(ctx, entity, coco.ownerImmunity) !== undefined
  if (!blown) return true
  explode(ctx, entity.position, entity.charged ? coco.chargedRadius : coco.radius)
  return false
}

function stepTejo(ctx: ItemContext, entity: ItemEntity): boolean {
  const { tejo } = ctx.config.powers
  const skip = entity.age < tejo.ownerImmunity ? entity.ownerSlot : -1
  if (kartsNear(ctx, entity.position, tejo.triggerRadius, skip).length === 0) return true
  explode(ctx, entity.position, tejo.radius)
  return false
}

function stepMango(ctx: ItemContext, entity: ItemEntity): boolean {
  const { mango } = ctx.config.powers
  const skip = entity.age < mango.ownerImmunity ? entity.ownerSlot : -1
  const slipped = kartsNear(ctx, entity.position, mango.triggerRadius, skip)
  for (const racer of slipped) applyHit(ctx, racer, 'spin')
  return slipped.length === 0
}

// --- armadillo (thrown shield) ---

function stepArmadillo(ctx: ItemContext, entity: ItemEntity, dt: number): boolean {
  const { armadillo } = ctx.config.powers
  moveForward(entity, armadillo.throwSpeed * dt)
  bounceOffWalls(ctx, entity, armadillo.wallMargin)
  setGroundHeight(ctx, entity)
  const victim = touchedKart(ctx, entity, armadillo.ownerImmunity)
  if (victim) applyHit(ctx, victim, 'spin')
  return victim === undefined && entity.age < armadillo.lifetime
}

function bounceOffWalls(ctx: ItemContext, entity: ItemEntity, margin: number): void {
  const projection = ctx.track.project(entity.position.x, entity.position.z)
  const limit = projection.halfWidth - margin
  if (projection.distance <= limit) return
  const { normal, closest } = projection
  const forward = forwardOf(entity.heading)
  const into = forward.x * normal.x + forward.z * normal.z
  if (into > 0) {
    entity.heading = headingOf(forward.x - 2 * into * normal.x, forward.z - 2 * into * normal.z)
  }
  entity.position.x = closest.x + normal.x * limit
  entity.position.z = closest.z + normal.z * limit
}

// --- homing: avispa, colibri, hormigas ---

function stepAvispa(ctx: ItemContext, entity: ItemEntity, dt: number): boolean {
  const { avispa } = ctx.config.powers
  const target = findRacer(ctx, entity.targetSlot)
  if (entity.age >= avispa.lifetime) return false
  if (!target) {
    // Nobody ahead: fly forward until it hits a wall
    moveForward(entity, avispa.speed * dt)
    setGroundHeight(ctx, entity)
    return !isOutsideRoad(ctx, entity.position)
  }
  if (!isRacing(target)) return false
  steerToward(entity, target.kart.position, avispa.turnRate, dt)
  moveForward(entity, avispa.speed * dt)
  setGroundHeight(ctx, entity)
  if (!isTouching(ctx, target, entity.position, ctx.config.powers.contactRadius)) return true

  const landed = applyHit(ctx, target, 'spin')
  const owner = findRacer(ctx, entity.ownerSlot)
  if (landed && entity.charged && owner) stealUchuvas(ctx, target, owner, avispa.stolenUchuvas)
  return false
}

function stepColibri(ctx: ItemContext, entity: ItemEntity, dt: number): boolean {
  const { colibri, entityHeight } = ctx.config.powers
  const target = findRacer(ctx, entity.targetSlot)
  if (!target || !isRacing(target) || entity.age >= colibri.lifetime) return false
  // Straight flight: it ignores walls and every other kart
  const to = target.kart.position
  const dx = to.x - entity.position.x
  const dz = to.z - entity.position.z
  entity.heading = headingOf(dx, dz)
  const step = Math.min(colibri.speed * dt, Math.hypot(dx, dz))
  moveForward(entity, step)
  entity.position.y = to.y + entityHeight
  if (!isTouching(ctx, target, entity.position, ctx.config.powers.contactRadius)) return true
  applyHit(ctx, target, 'flip')
  return false
}

function stepHormigas(ctx: ItemContext, entity: ItemEntity, dt: number): boolean {
  const { hormigas, contactRadius } = ctx.config.powers
  const target = findRacer(ctx, entity.targetSlot)
  if (!target || !isRacing(target) || entity.age >= hormigas.lifetime) return false
  steerToward(entity, target.kart.position, hormigas.turnRate, dt)
  moveForward(entity, hormigas.speed * dt)
  setGroundHeight(ctx, entity)
  if (!isTouching(ctx, target, entity.position, contactRadius)) return true

  const owner = findRacer(ctx, entity.ownerSlot)
  if (!absorbedByProtection(ctx, target) && owner) {
    stealUchuvas(ctx, target, owner, entity.charged ? hormigas.chargedStolen : hormigas.stolen)
    const status = target.items.status
    status.dizzyTime = Math.max(status.dizzyTime, ctx.config.hit.dizzyTime)
  }
  return false
}

// --- sombrero (boomerang) ---

function stepSombrero(ctx: ItemContext, entity: ItemEntity, dt: number): boolean {
  const { sombrero, contactRadius } = ctx.config.powers
  const owner = findRacer(ctx, entity.ownerSlot)
  const meta = ctx.entities.metaOf(entity)
  if (!owner || entity.age >= sombrero.lifetime) return false

  if (meta.returning) {
    steerToward(entity, owner.kart.position, Math.PI * 8, dt)
    moveForward(entity, sombrero.returnSpeed * dt)
  } else {
    meta.legTime += dt
    moveForward(entity, sombrero.speed * dt)
    if (meta.legTime >= sombrero.outTime) meta.returning = true
  }
  setGroundHeight(ctx, entity)
  spinTouchedKarts(ctx, entity, meta.hitSlots)

  if (!meta.returning || distanceXZ(entity.position, owner.kart.position) > contactRadius) {
    return true
  }
  meta.lapsLeft -= 1
  if (meta.lapsLeft <= 0) return false
  startNextLap(ctx, entity, owner)
  return true
}

/** Each kart is spun once per pass. */
function spinTouchedKarts(ctx: ItemContext, entity: ItemEntity, hitSlots: Set<number>): void {
  for (const racer of kartsNear(ctx, entity.position, ctx.config.powers.contactRadius)) {
    if (racer.slot === entity.ownerSlot || hitSlots.has(racer.slot)) continue
    hitSlots.add(racer.slot)
    applyHit(ctx, racer, 'spin')
  }
}

function startNextLap(ctx: ItemContext, entity: ItemEntity, owner: Racer): void {
  const meta = ctx.entities.metaOf(entity)
  const forward = forwardOf(owner.kart.heading)
  const ahead = ctx.config.powers.spawnDistance
  meta.returning = false
  meta.legTime = 0
  meta.hitSlots.clear()
  entity.heading = owner.kart.heading
  entity.position.x = owner.kart.position.x + forward.x * ahead
  entity.position.z = owner.kart.position.z + forward.z * ahead
  setGroundHeight(ctx, entity)
}

// --- mask ---

/** Karts wearing the mask knock down every other kart they touch. */
export function applyMaskContacts(ctx: ItemContext): void {
  const { touchRadius } = ctx.config.powers.mascara
  for (const wearer of ctx.racers) {
    if (!isRacing(wearer) || wearer.items.status.maskTime <= 0) continue
    for (const racer of kartsNear(ctx, wearer.kart.position, touchRadius, wearer.slot)) {
      applyHit(ctx, racer, 'flip')
    }
  }
}
