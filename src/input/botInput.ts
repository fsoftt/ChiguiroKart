// src/input/botInput.ts

import { NEUTRAL_INPUT, type KartInput } from './kartInput'
import type { RaceWorld } from '../sim/world'
import type { KartState } from '../sim/kart/kartState'
import { clamp, headingOf, wrapAngle, type Vec2 } from '../sim/math'

/**
 * Provider of input for an AI‑controlled kart.
 * The `nextInput` method receives the elapsed time `dt`, the current world state
 * (so the bot can query the track, checkpoints, etc.), and the bot's own
 * `KartState`. It returns a {@link KartInput} that will be fed to the physics
 * simulation.
 */
export interface BotInputProvider {
  /**
   * Compute the next input for the bot.
   * @param dt – time delta since the previous frame (seconds).
   * @param world – the current {@link RaceWorld} (contains track & race data).
   * @param kart – the bot's own {@link KartState}.
   */
  nextInput(dt: number, world: RaceWorld, kart: KartState): KartInput
}

/**
 * A very simple bot that steers towards the next checkpoint.
 * It keeps throttle at a constant 0.8 and adjusts steering proportionally to the
 * angle between the kart heading and the direction to the target checkpoint.
 */
export class SimpleBot implements BotInputProvider {
  // Index of the next checkpoint the bot is aiming for.
  private targetIdx: number = 1 // start after the start/finish line (index 0)

  nextInput(_dt: number, world: RaceWorld, kart: KartState): KartInput {
    // Guard against missing checkpoints.
    const checkpoints = world.raceManager.checkpoints
    if (!checkpoints.length) {
      return { ...NEUTRAL_INPUT, throttle: 0.5 }
    }

    // Find the next checkpoint that hasn't been passed yet.
    const lastPassed = world.raceManager.state.lastPassedCheckpoint
    this.targetIdx = (lastPassed + 1) % checkpoints.length
    const target = checkpoints[this.targetIdx]
    if (!target) {
      return { ...NEUTRAL_INPUT, throttle: 0.5 }
    }

    // Vector from kart to target checkpoint centre.
    const dir: Vec2 = {
      x: target.position.x - kart.position.x,
      z: target.position.z - kart.position.z,
    }

    // Desired heading (0 faces +z, see headingOf) and smallest signed difference.
    const desiredAngle = headingOf(dir.x, dir.z)
    const delta = wrapAngle(desiredAngle - kart.heading)

    // Positive steer turns right, which lowers the heading, so steer against delta.
    const steer = clamp(-delta * 2, -1, 1) // gain = 2

    // Constant throttle, no brake.
    return { ...NEUTRAL_INPUT, throttle: 0.8, steer }
  }
}
