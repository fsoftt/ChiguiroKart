import type { DriftConfig } from '../config/drift'
import type { KartPhysicsConfig } from '../config/kartPhysics'
import type { KartInput } from '../input/kartInput'
import type { KartState } from './kart/kartState'
import type { RaceManager, RaceManagerOptions } from './race/raceManager'
import { createRacer, resetRacer, stepRacer, type Racer } from './racer'
import { Track, type TrackDefinition } from './track'

/** The whole simulated race. Pure logic: no rendering, DOM or network. */
export class RaceWorld {
  readonly track: Track
  /** The human-controlled racer. Bots keep their own racers (see `BotManager`). */
  readonly player: Racer

  constructor(
    trackDefinition: TrackDefinition,
    readonly physics: KartPhysicsConfig,
    readonly drift: DriftConfig,
    readonly raceOptions?: RaceManagerOptions,
  ) {
    this.track = new Track(trackDefinition)
    this.player = createRacer(this.track, raceOptions)
  }

  /** The player's kart. */
  get kart(): KartState {
    return this.player.kart
  }

  /** The player's race progress. */
  get raceManager(): RaceManager {
    return this.player.race
  }

  step(input: KartInput, dt: number): void {
    stepRacer(this.player, input, this.track, this.physics, this.drift, dt)
  }

  resetKart(): void {
    resetRacer(this.player, this.track)
  }
}
