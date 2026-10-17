// src/sim/botManager.ts

import { NEUTRAL_INPUT, type KartInput } from '../input/kartInput'
import type { BotInputProvider } from '../input/botInput'
import type { RaceWorld } from './world'
import type { KartPhysicsConfig } from '../config/kartPhysics'
import type { DriftConfig } from '../config/drift'
import type { KartState } from './kart/kartState'
import type { RaceState } from './race/raceState'
import { createRacer, resetRacer, stepRacer, type Racer } from './racer'

interface BotEntry {
  provider: BotInputProvider
  racer: Racer
  lastInput: KartInput
}

/**
 * Manages a collection of AI‑controlled karts.
 * Each bot provides a {@link BotInputProvider} that computes the next {@link KartInput}
 * and owns its own {@link Racer}, so laps, checkpoints and respawns are tracked per kart.
 * Bots go through the same race rules and physics pipeline as the player kart.
 */
export class BotManager {
  private bots: BotEntry[] = []

  constructor(
    private world: RaceWorld,
    private physics: KartPhysicsConfig,
    private drift: DriftConfig,
  ) {}

  /** Add a new bot instance. */
  addBot(provider: BotInputProvider) {
    const racer = createRacer(this.world.track, this.world.raceOptions)
    this.bots.push({ provider, racer, lastInput: { ...NEUTRAL_INPUT } })
  }

  /** Update all bots for the elapsed time `dt`. */
  update(dt: number) {
    for (const entry of this.bots) {
      const { kart, race } = entry.racer
      const input = entry.provider.nextInput(dt, this.world, kart, race.state)
      entry.lastInput = input
      stepRacer(entry.racer, input, this.world.track, this.physics, this.drift, dt)
    }
  }

  /** Put every bot back on the grid with a fresh race state. */
  reset() {
    for (const entry of this.bots) {
      resetRacer(entry.racer, this.world.track)
      entry.lastInput = { ...NEUTRAL_INPUT }
    }
  }

  /** Get the internal array of bot kart states (read‑only). */
  getBotKarts(): KartState[] {
    return this.bots.map((b) => b.racer.kart)
  }

  /** Get the kart, race state and last input of each bot. */
  getBotInfos(): { kart: KartState; race: RaceState; input: KartInput }[] {
    return this.bots.map((b) => ({
      kart: b.racer.kart,
      race: b.racer.race.state,
      input: b.lastInput,
    }))
  }

  /** Get the number of bots managed. */
  count(): number {
    return this.bots.length
  }
}
