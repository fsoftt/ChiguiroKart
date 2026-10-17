// src/sim/botManager.ts

import { NEUTRAL_INPUT, type KartInput } from '../input/kartInput'
import type { BotInputProvider } from '../input/botInput'
import { rubberBandFactor } from '../ai/rubberBand'
import { defaultRubberBand, type RubberBandConfig } from '../config/bots'
import { damp } from './math'
import { raceProgress } from './race/standings'
import type { RaceWorld } from './world'
import type { KartPhysicsConfig } from '../config/kartPhysics'
import type { DriftConfig } from '../config/drift'
import type { KartState } from './kart/kartState'
import type { RaceState } from './race/raceState'
import { resolveKartCollisions } from './kart/kartCollision'
import { characterIds, type CharacterId } from '../config/characters'
import { characterMass } from './characters'
import { createRacer, resetRacer, stepRacer, type Racer } from './racer'

interface BotEntry {
  provider: BotInputProvider
  racer: Racer
  lastInput: KartInput
  /** Smoothed rubber band factor currently applied to this bot's speed. */
  rubber: number
}

export interface BotManagerOptions {
  /** Catch-up help for bots far behind the player (and brake for those far ahead). */
  rubberBand?: RubberBandConfig
}

/**
 * Manages a collection of AI‑controlled karts.
 * Each bot provides a {@link BotInputProvider} that computes the next {@link KartInput}
 * and owns its own {@link Racer}, so laps, checkpoints and respawns are tracked per kart.
 * Bots go through the same race rules and physics pipeline as the player kart.
 */
export class BotManager {
  private bots: BotEntry[] = []
  private readonly rubberBand: RubberBandConfig
  /** Meters of track per unit of `raceProgress` (one checkpoint segment on average). */
  private readonly metersPerProgress: number

  constructor(
    private world: RaceWorld,
    private physics: KartPhysicsConfig,
    private drift: DriftConfig,
    options: BotManagerOptions = {},
  ) {
    this.rubberBand = options.rubberBand ?? defaultRubberBand
    this.metersPerProgress = world.track.loopLength / Math.max(world.track.checkpoints.length, 1)
    world.rivals = () => this.allRacers()
  }

  /**
   * Add a new bot instance. Without a `character`, bots cycle through the roster by slot so
   * they differ (the player's slot 0 is the first one).
   */
  addBot(provider: BotInputProvider, character?: CharacterId) {
    // Slot 0 is the player, bots take 1, 2, ... in order
    const slot = this.bots.length + 1
    const picked = character ?? characterIds[slot % characterIds.length] ?? 'chiguiro'
    const racer = createRacer(this.world.track, this.world.raceOptions, slot, picked)
    racer.speedScale = provider.speedFactor ?? 1
    this.bots.push({ provider, racer, lastInput: { ...NEUTRAL_INPUT }, rubber: 1 })
  }

  /** Update all bots for the elapsed time `dt`. */
  update(dt: number) {
    const racers = this.allRacers()
    const playerProgress = raceProgress(this.world.player)
    for (const entry of this.bots) {
      this.updateSpeedScale(entry, playerProgress, dt)
      const input = entry.provider.nextInput(dt, { world: this.world, self: entry.racer, racers })
      entry.lastInput = input
      stepRacer(
        entry.racer,
        input,
        this.world.track,
        this.physics,
        this.drift,
        dt,
        undefined,
        racers,
      )
    }
  }

  /** Bot speed scale = its difficulty factor times the smoothed rubber band factor. */
  private updateSpeedScale(entry: BotEntry, playerProgress: number, dt: number): void {
    const gap = (raceProgress(entry.racer) - playerProgress) * this.metersPerProgress
    const target = rubberBandFactor(gap, this.rubberBand)
    entry.rubber = damp(entry.rubber, target, this.rubberBand.smoothing, dt)
    entry.racer.speedScale = (entry.provider.speedFactor ?? 1) * entry.rubber
  }

  /** The player followed by every bot. */
  allRacers(): Racer[] {
    return [this.world.player, ...this.bots.map((b) => b.racer)]
  }

  /** Put every bot back on the grid with a fresh race state. */
  reset() {
    for (const entry of this.bots) {
      resetRacer(entry.racer, this.world.track)
      entry.lastInput = { ...NEUTRAL_INPUT }
      entry.rubber = 1
      entry.provider.reset?.()
    }
  }

  /** Get the internal array of bot kart states (read‑only). */
  getBotKarts(): KartState[] {
    return this.bots.map((b) => b.racer.kart)
  }

  /** Racers of every bot (read-only view), in slot order. */
  getBotRacers(): readonly Racer[] {
    return this.bots.map((b) => b.racer)
  }

  /** Player kart followed by every bot kart, for kart-vs-kart collisions. */
  allKarts(): KartState[] {
    return [this.world.kart, ...this.bots.map((b) => b.racer.kart)]
  }

  /** Resolve collisions between the player and all bots. Call after everyone has stepped. */
  resolveCollisions() {
    const masses = this.allRacers().map((racer) => characterMass(racer.character))
    resolveKartCollisions(this.allKarts(), this.physics, masses)
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
