import type { BotBehaviorConfig, BotDifficultyConfig } from '../config/bots'
import type { BotContext } from '../input/botInput'
import type { PowerId } from '../sim/items/itemTypes'
import { forwardOf, rightOf } from '../sim/math'
import type { Racer } from '../sim/racer'
import { computeStandings, raceProgress } from '../sim/race/standings'
import type { Rng } from './random'

/** What the bot presses for items this step. */
export interface ItemCommand {
  useItem: boolean
  lookBack: boolean
}

/** A rival seen from the bot: meters ahead (negative = behind), sideways and straight distance. */
interface Sighting {
  racer: Racer
  ahead: number
  lateral: number
  distance: number
  inStandingsAhead: boolean
}

const NONE: ItemCommand = { useItem: false, lookBack: false }

/**
 * Decides when a bot uses its power. Simple rules: offensive powers at rivals close ahead,
 * defensive ones against rivals close behind, global ones when not leading, and anything
 * held too long is used anyway. Presses are single-step pulses so the item system sees a
 * rising edge each time. Deterministic given its seeded generator.
 */
export class ItemControl {
  private holding: PowerId | null = null
  private holdTime = 0
  private gapTimer = 0
  private pressed = false
  private series = false
  private willUseDefensive = true
  private shieldTime = 0

  constructor(
    private readonly skill: BotDifficultyConfig,
    private readonly behavior: BotBehaviorConfig,
    private readonly rng: Rng,
  ) {}

  reset(): void {
    this.holding = null
    this.holdTime = 0
    this.gapTimer = 0
    this.pressed = false
    this.series = false
    this.shieldTime = 0
  }

  /**
   * @param upcomingTurn heading change (rad) of the road ahead, to pick straights for panela.
   */
  update(dt: number, ctx: BotContext, upcomingTurn: number): ItemCommand {
    const { self } = ctx
    const slot = self.items.slot
    const power = slot.power
    if (power === null || slot.uses <= 0 || slot.rouletteTime > 0) {
      this.reset()
      return NONE
    }
    if (power !== this.holding) {
      this.reset()
      this.holding = power
      this.willUseDefensive = this.rng() < this.skill.itemDefensiveChance
    }
    if (self.race.state.phase !== 'racing' || self.items.status.hit) {
      this.pressed = false
      return NONE
    }
    this.holdTime += dt
    this.gapTimer = Math.max(0, this.gapTimer - dt)
    const shieldUp = self.items.status.shieldHits > 0
    this.shieldTime = shieldUp ? this.shieldTime + dt : 0

    // Release for one step after every press so the next one is a rising edge
    if (this.pressed) {
      this.pressed = false
      return NONE
    }
    if (this.holdTime < this.skill.itemReactionDelay || this.gapTimer > 0) return NONE

    let command = this.decide(power, ctx, upcomingTurn, shieldUp)
    if (!command && this.holdTime >= this.behavior.itemHoldTimeout)
      command = { ...NONE, useItem: true }
    if (!command) return NONE
    this.pressed = true
    this.series = true
    this.gapTimer = this.behavior.itemUseGap
    return command
  }

  private decide(
    power: PowerId,
    ctx: BotContext,
    upcomingTurn: number,
    shieldUp: boolean,
  ): ItemCommand | null {
    const press: ItemCommand = { useItem: true, lookBack: false }
    // Later uses of a multi-use trap follow the first one without asking again
    if (this.series && (power === 'mango' || power === 'tejo')) return press
    const b = this.behavior
    switch (power) {
      case 'mascara':
        return press
      case 'panela':
        return !this.skill.panelaNeedsStraight || Math.abs(upcomingTurn) < b.itemStraightTurn
          ? press
          : null
      case 'coco': {
        const sights = this.sightings(ctx)
        if (this.targetAhead(sights, b.itemCocoRange)) return press
        if (this.rivalBehind(sights)) return { useItem: true, lookBack: true }
        return null
      }
      case 'avispa':
      case 'hormigas':
        return this.sightings(ctx).some(
          (s) => s.inStandingsAhead && s.distance <= b.itemHomingRange,
        )
          ? press
          : null
      case 'sombrero':
        return this.sightings(ctx).some((s) => s.ahead > 0 && s.distance <= b.itemSombreroRange)
          ? press
          : null
      case 'mango':
      case 'tejo':
        return this.willUseDefensive && this.rivalBehind(this.sightings(ctx)) ? press : null
      case 'armadillo': {
        const sights = this.sightings(ctx)
        if (!shieldUp) {
          return this.willUseDefensive && this.rivalBehind(sights) ? press : null
        }
        if (this.targetAhead(sights, b.itemCocoRange) || this.shieldTime >= b.itemShieldHold) {
          return press
        }
        return null
      }
      case 'rayo':
      case 'colibri': {
        const leader = this.leaderDistance(ctx)
        return leader !== null && leader >= b.itemLeaderGap ? press : null
      }
      case 'mosquitos':
      case 'aguacero':
        return this.leaderDistance(ctx) !== null ? press : null
    }
  }

  /** Distance to the race leader, or null if the bot is the leader. */
  private leaderDistance(ctx: BotContext): number | null {
    const leader = computeStandings(ctx.racers)[0]
    if (!leader || leader === ctx.self) return null
    return Math.hypot(
      leader.kart.position.x - ctx.self.kart.position.x,
      leader.kart.position.z - ctx.self.kart.position.z,
    )
  }

  private sightings(ctx: BotContext): Sighting[] {
    const { self } = ctx
    const kart = self.kart
    const forward = forwardOf(kart.heading)
    const right = rightOf(kart.heading)
    const mine = raceProgress(self)
    const result: Sighting[] = []
    for (const other of ctx.racers) {
      if (other === self) continue
      const dx = other.kart.position.x - kart.position.x
      const dz = other.kart.position.z - kart.position.z
      result.push({
        racer: other,
        ahead: dx * forward.x + dz * forward.z,
        lateral: dx * right.x + dz * right.z,
        distance: Math.hypot(dx, dz),
        inStandingsAhead: raceProgress(other) > mine,
      })
    }
    return result
  }

  /** A rival ahead inside the firing cone and within range. */
  private targetAhead(sights: Sighting[], range: number): boolean {
    return sights.some(
      (s) =>
        s.ahead > 0 &&
        s.ahead <= range &&
        Math.atan2(Math.abs(s.lateral), s.ahead) <= this.behavior.itemConeAngle,
    )
  }

  /** A rival close behind, inside a narrow strip. */
  private rivalBehind(sights: Sighting[]): boolean {
    return sights.some(
      (s) =>
        s.ahead < 0 &&
        -s.ahead <= this.behavior.itemBackRange &&
        Math.abs(s.lateral) <= this.behavior.itemBackWidth,
    )
  }
}
