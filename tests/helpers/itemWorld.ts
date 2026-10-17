import { defaultDrift } from '../../src/config/drift'
import { defaultItems, type ItemsConfig } from '../../src/config/items'
import { defaultKartPhysics } from '../../src/config/kartPhysics'
import { NEUTRAL_INPUT, type KartInput } from '../../src/input/kartInput'
import { ItemSystem } from '../../src/sim/items/itemSystem'
import type { ItemEvent, PowerId } from '../../src/sim/items/itemTypes'
import type { Vec2 } from '../../src/sim/math'
import type { CharacterId } from '../../src/config/characters'
import { createRacer, stepRacer, type Racer } from '../../src/sim/racer'
import { Track, type TrackDefinition } from '../../src/sim/track'

export const DT = 1 / 60

/** Meters between the karts staged by `makeItemWorld`. */
export const SPACING = 25
/** x of the leader (slot 0); slot n sits `n * SPACING` further back. */
export const LEADER_X = 800

/**
 * A long flat road along +x (2 km, 18 m wide) closed by a return lane, so rank is simply
 * "larger x is ahead" for karts between x = 500 and x = 1000.
 */
function straightDefinition(boxes: Vec2[], uchuvas: Vec2[]): TrackDefinition {
  const out = Array.from({ length: 21 }, (_, i) => ({ x: i * 100, z: 0 }))
  const back = Array.from({ length: 21 }, (_, i) => ({ x: 2000 - i * 100, z: 60 }))
  return {
    name: 'Recta de prueba',
    centerline: [...out, ...back],
    halfWidth: 9,
    itemBoxes: boxes,
    uchuvas,
  }
}

export interface ItemWorldOptions {
  count?: number
  config?: ItemsConfig
  seed?: number
  boxes?: Vec2[]
  uchuvas?: Vec2[]
  /** Character of every racer. Defaults to one without timer perks, so the base rules show. */
  character?: CharacterId
}

export type Inputs = ReadonlyMap<Racer, Partial<KartInput>>

/** Karts parked in a row on the straight (slot 0 leads), plus an item system over them. */
export interface ItemWorld {
  track: Track
  racers: Racer[]
  system: ItemSystem
  /** Every event since the world was made. */
  log: ItemEvent[]
  tick(inputs?: Inputs, drive?: boolean): void
  run(seconds: number, inputs?: Inputs, drive?: boolean): void
  /** One step with the use button down, one with it released. */
  press(racer: Racer, extra?: Partial<KartInput>): void
  give(racer: Racer, power: PowerId, charged?: boolean, uses?: number): void
  place(racer: Racer, x: number, z?: number): void
  eventsOf<T extends ItemEvent['type']>(type: T): Extract<ItemEvent, { type: T }>[]
}

export function makeItemWorld(options: ItemWorldOptions = {}): ItemWorld {
  const config = options.config ?? defaultItems
  const track = new Track(straightDefinition(options.boxes ?? [], options.uchuvas ?? []))
  const racers = Array.from({ length: options.count ?? 4 }, (_, slot) =>
    createRacer(track, { totalLaps: 3, countdownSeconds: 0 }, slot, options.character ?? 'condor'),
  )
  const system = new ItemSystem(track, config, options.seed ?? 1, defaultDrift)
  const log: ItemEvent[] = []

  const place = (racer: Racer, x: number, z = 0): void => {
    racer.kart.position = { x, y: 0, z }
    racer.kart.heading = Math.PI / 2
    racer.kart.velocity = { x: 0, y: 0, z: 0 }
    racer.race.state.lastPassedCheckpoint = Math.floor(x / 500)
  }
  racers.forEach((racer, slot) => {
    racer.race.state.phase = 'racing'
    place(racer, LEADER_X - slot * SPACING)
  })

  const tick = (inputs: Inputs = new Map(), drive = false): void => {
    const entries = racers.map((racer) => ({
      racer,
      input: { ...NEUTRAL_INPUT, ...inputs.get(racer) },
    }))
    if (drive) {
      for (const { racer, input } of entries) {
        stepRacer(racer, input, track, defaultKartPhysics, defaultDrift, DT, config)
      }
    }
    system.update(entries, DT)
    log.push(...system.drainEvents())
  }

  return {
    track,
    racers,
    system,
    log,
    tick,
    run(seconds, inputs, drive) {
      for (let i = 0; i < Math.round(seconds / DT); i++) tick(inputs, drive)
    },
    press(racer, extra = {}) {
      tick(new Map([[racer, { ...extra, useItem: true }]]))
      tick()
    },
    give(racer, power, charged = false, uses = 1) {
      racer.items.slot = { power, uses, charged, rouletteTime: 0, rouletteShowing: null }
    },
    place,
    eventsOf(type) {
      return log.filter((event): event is Extract<ItemEvent, { type: typeof type }> => {
        return event.type === type
      })
    },
  }
}

/** The racer at `slot` (throws if the world has fewer karts). */
export function at(world: ItemWorld, slot: number): Racer {
  const racer = world.racers[slot]
  if (!racer) throw new Error(`No racer in slot ${slot}`)
  return racer
}

/** A copy of the default config with some sections overridden. */
export function withItems(overrides: {
  [K in 'uchuvas' | 'boxes' | 'hit' | 'powers']?: Partial<ItemsConfig[K]>
}): ItemsConfig {
  return {
    ...defaultItems,
    uchuvas: { ...defaultItems.uchuvas, ...overrides.uchuvas },
    boxes: { ...defaultItems.boxes, ...overrides.boxes },
    hit: { ...defaultItems.hit, ...overrides.hit },
    powers: { ...defaultItems.powers, ...overrides.powers },
  }
}
