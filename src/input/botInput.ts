import type { KartInput } from './kartInput'
import type { Racer } from '../sim/racer'
import type { RaceWorld } from '../sim/world'

/** What a bot can see when it decides its next input. */
export interface BotContext {
  /** The race: track, physics and the player. */
  world: RaceWorld
  /** The racer this bot drives. */
  self: Racer
  /** Every racer in the race, the bot itself and the player included. */
  racers: readonly Racer[]
}

/** Provider of input for an AI-controlled kart. */
export interface BotInputProvider {
  /** Share of the kart's top speed this bot can use (default 1), set as the racer's speed scale. */
  readonly speedFactor?: number
  /** Computes the input for the next simulation step of `dt` seconds. */
  nextInput(dt: number, ctx: BotContext): KartInput
  /** Forgets everything learned in the current race (called when the race restarts). */
  reset?(): void
}
