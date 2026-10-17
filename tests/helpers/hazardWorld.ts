import { defaultDrift } from '../../src/config/drift'
import { defaultHazards, type HazardsConfig } from '../../src/config/hazards'
import { defaultItems } from '../../src/config/items'
import { defaultKartPhysics } from '../../src/config/kartPhysics'
import { NEUTRAL_INPUT, type KartInput } from '../../src/input/kartInput'
import { ItemSystem } from '../../src/sim/items/itemSystem'
import type { ItemEvent } from '../../src/sim/items/itemTypes'
import { createRacer, stepRacer, type Racer } from '../../src/sim/racer'
import { Track, type TrackDefinition } from '../../src/sim/track'

export const DT = 1 / 60

/** A flat road along +x (2 km, 18 m wide) closed by a return lane, with optional extras. */
export function straightTrack(extra: Partial<TrackDefinition> = {}): Track {
  const out = Array.from({ length: 21 }, (_, i) => ({ x: i * 100, z: 0 }))
  const back = Array.from({ length: 21 }, (_, i) => ({ x: 2000 - i * 100, z: 60 }))
  return new Track({
    name: 'Recta de prueba',
    centerline: [...out, ...back],
    halfWidth: 9,
    ...extra,
  })
}

export interface HazardWorld {
  track: Track
  racers: Racer[]
  system: ItemSystem
  log: ItemEvent[]
  /** One step: moves the racers (if `drive`) with `input`, then updates the item system. */
  tick(input?: Partial<KartInput>, drive?: boolean): void
  run(seconds: number, input?: Partial<KartInput>, drive?: boolean): void
  eventsOf<T extends ItemEvent['type']>(type: T): Extract<ItemEvent, { type: T }>[]
}

/** Racers (in the 'racing' phase, parked at `xs` on the road axis facing +x) over a track. */
export function makeHazardWorld(
  track: Track,
  xs: readonly number[] = [800],
  hazardConfig: HazardsConfig = defaultHazards,
): HazardWorld {
  const racers = xs.map((x, slot) => {
    const racer = createRacer(track, { totalLaps: 3, countdownSeconds: 0 }, slot, 'condor')
    racer.race.state.phase = 'racing'
    racer.kart.position = { x, y: 0, z: 0 }
    racer.kart.heading = Math.PI / 2
    racer.kart.velocity = { x: 0, y: 0, z: 0 }
    return racer
  })
  const system = new ItemSystem(
    track,
    defaultItems,
    1,
    defaultDrift,
    false,
    defaultKartPhysics,
    hazardConfig,
  )
  const log: ItemEvent[] = []
  const tick = (input: Partial<KartInput> = {}, drive = false): void => {
    const full: KartInput = { ...NEUTRAL_INPUT, ...input }
    if (drive) {
      for (const racer of racers) {
        stepRacer(racer, full, track, defaultKartPhysics, defaultDrift, DT, defaultItems, racers)
      }
    }
    system.update(
      racers.map((racer) => ({ racer, input: full })),
      DT,
    )
    log.push(...system.drainEvents())
  }
  return {
    track,
    racers,
    system,
    log,
    tick,
    run(seconds, input, drive) {
      for (let i = 0; i < Math.round(seconds / DT); i++) tick(input, drive)
    },
    eventsOf(type) {
      return log.filter((event): event is Extract<ItemEvent, { type: typeof type }> => {
        return event.type === type
      })
    },
  }
}
