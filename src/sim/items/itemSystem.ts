import { defaultItems, type ItemsConfig } from '../../config/items'
import type { KartInput } from '../../input/kartInput'
import type { Racer } from '../racer'
import type { Track } from '../track'
import type { ItemEntity, ItemEvent, Pickup } from './itemTypes'

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
  readonly boxes: Pickup[] = []
  readonly uchuvas: Pickup[] = []
  readonly entities: ItemEntity[] = []

  constructor(
    readonly track: Track,
    readonly config: ItemsConfig = defaultItems,
    readonly seed = 1,
  ) {}

  /**
   * Pickups, roulette, item use (rising edge of `useItem`; `lookBack` held throws backwards),
   * entity movement and hits, status timers. Mutates the racers' `items`.
   */
  update(entries: readonly ItemRacerEntry[], dt: number): void {
    void entries
    void dt
  }

  /** Events since the last call (oldest first), then forgets them. */
  drainEvents(): ItemEvent[] {
    return []
  }

  /** Every pickup back, no entities, fresh RNG. Racers' items are reset by `resetRacer`. */
  reset(): void {}
}
