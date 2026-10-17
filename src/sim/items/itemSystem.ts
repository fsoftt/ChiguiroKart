import { createRng, seedFor, type Rng } from '../../ai/random'
import { defaultDrift, type DriftConfig } from '../../config/drift'
import { defaultHazards, type HazardsConfig } from '../../config/hazards'
import { defaultItems, type ItemsConfig } from '../../config/items'
import { defaultKartPhysics, type KartPhysicsConfig } from '../../config/kartPhysics'
import type { KartInput } from '../../input/kartInput'
import { HazardSystem } from '../hazards/hazardSystem'
import { computeStandings } from '../race/standings'
import type { Racer } from '../racer'
import type { Track } from '../track'
import { applyMaskContacts, stepEntities } from './entities'
import { EntityStore } from './entityStore'
import { isRacing, type ItemContext } from './itemContext'
import type { ItemEntity, ItemEvent, Pickup } from './itemTypes'
import { createPickups, pickupsTouching, takePickup, tickRespawns } from './pickups'
import { usePower } from './powers'
import { startRoulette, tickRoulette } from './roulette'
import { tickStatus } from './statusTimers'

/** One racer and the input it used this step. */
export interface ItemRacerEntry {
  racer: Racer
  input: KartInput
}

/**
 * Boxes, uchuvas and every power on the track. Pure simulation, deterministic (seeded RNG).
 * Call `update` once per fixed step, after every racer has moved and kart collisions are solved.
 */
export class ItemSystem {
  readonly boxes: Pickup[]
  readonly uchuvas: Pickup[]
  readonly entities: ItemEntity[] = []
  /** Track obstacles and the tide; stepped by `update`, also in the time trial. */
  readonly hazards: HazardSystem
  private readonly store = new EntityStore(this.entities)
  private readonly events: ItemEvent[] = []
  private rng: Rng

  constructor(
    readonly track: Track,
    readonly config: ItemsConfig = defaultItems,
    readonly seed = 1,
    /** Needed by the panela to add its nitro. */
    private readonly drift: DriftConfig = defaultDrift,
    /** False for the time trial: no boxes and no uchuvas on the track. */
    withPickups = true,
    physics: KartPhysicsConfig = defaultKartPhysics,
    hazardConfig: HazardsConfig = defaultHazards,
  ) {
    this.hazards = new HazardSystem(track, hazardConfig, physics)
    this.boxes = withPickups ? createPickups(track, track.itemBoxes, config.boxes.lift) : []
    this.uchuvas = withPickups ? createPickups(track, track.uchuvas, config.uchuvas.lift) : []
    this.rng = createRng(seedFor(seed, 0))
  }

  /**
   * Pickups, roulette, item use (rising edge of `useItem`; `lookBack` held throws backwards),
   * entity movement and hits, status timers. Mutates the racers' `items`.
   * Timers tick for every racer; pickups, roulette and item use only in the 'racing' phase.
   */
  update(entries: readonly ItemRacerEntry[], dt: number): void {
    const racers = entries.map((entry) => entry.racer)
    const ctx = this.createContext(racers)
    for (const { racer } of entries) tickStatus(racer, this.config.hit, dt)
    tickRespawns(this.boxes, dt)
    tickRespawns(this.uchuvas, dt)

    for (const { racer, input } of entries) {
      const pressed = input.useItem && !racer.items.useHeld
      racer.items.useHeld = input.useItem
      if (!isRacing(racer)) continue
      this.collectPickups(ctx, racer)
      tickRoulette(ctx, racer, dt)
      if (pressed && racer.items.status.hit === null) usePower(ctx, racer, input.lookBack)
    }

    stepEntities(ctx, dt)
    applyMaskContacts(ctx)
    this.hazards.update(ctx, dt)
  }

  /** Events since the last call (item and hazard events) (oldest first), then forgets them. */
  drainEvents(): ItemEvent[] {
    return this.events.splice(0, this.events.length)
  }

  /** Every pickup back, no entities, fresh RNG. Racers' items are reset by `resetRacer`. */
  reset(): void {
    for (const pickup of [...this.boxes, ...this.uchuvas]) {
      pickup.active = true
      pickup.respawnTime = 0
    }
    this.store.clear()
    this.hazards.reset()
    this.events.length = 0
    this.rng = createRng(seedFor(this.seed, 0))
  }

  private createContext(racers: readonly Racer[]): ItemContext {
    return {
      track: this.track,
      config: this.config,
      drift: this.drift,
      rng: this.rng,
      entities: this.store,
      racers,
      standings: computeStandings(racers),
      emit: (event) => this.events.push(event),
    }
  }

  private collectPickups(ctx: ItemContext, racer: Racer): void {
    const { boxes, uchuvas } = this.config
    const height = this.config.powers.contactHeight
    for (const box of pickupsTouching(this.boxes, racer, boxes.pickupRadius, height)) {
      takePickup(box, boxes.respawnTime)
      racer.items.uchuvas = Math.min(uchuvas.max, racer.items.uchuvas + uchuvas.perBox)
      startRoulette(ctx, racer)
      this.events.push({ type: 'boxTaken', slot: racer.slot, position: { ...box.position } })
    }
    for (const uchuva of pickupsTouching(this.uchuvas, racer, uchuvas.pickupRadius, height)) {
      // A full kart leaves the uchuva for someone else
      if (racer.items.uchuvas >= uchuvas.max) break
      takePickup(uchuva, uchuvas.respawnTime)
      racer.items.uchuvas += 1
      this.events.push({ type: 'uchuvaTaken', slot: racer.slot, position: { ...uchuva.position } })
    }
  }
}
