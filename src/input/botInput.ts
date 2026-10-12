// src/input/botInput.ts

import type { KartInput } from './kartInput';
import type { RaceWorld } from '../sim/world';
import type { Vec2 } from '../sim/math';

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
  nextInput(dt: number, world: RaceWorld, kart: any): KartInput;
}

/**
 * A very simple bot that steers towards the next checkpoint.
 * It keeps throttle at a constant 0.8 and adjusts steering proportionally to the
 * angle between the kart heading and the direction to the target checkpoint.
 */
export class SimpleBot implements BotInputProvider {
  // Index of the next checkpoint the bot is aiming for.
  private targetIdx: number = 1; // start after the start/finish line (index 0)

  nextInput(dt: number, world: RaceWorld, kart: any): KartInput {
    // Guard against missing checkpoints.
    const checkpoints = world.raceManager.checkpoints;
    if (!checkpoints.length) {
      return { steering: 0, throttle: 0.5, brake: 0, drift: false };
    }

    // Find the next checkpoint that hasn't been passed yet.
    const lastPassed = world.raceManager.state.lastPassedCheckpoint;
    this.targetIdx = (lastPassed + 1) % checkpoints.length;
    const target = checkpoints[this.targetIdx];
    if (!target) {
      return { steering: 0, throttle: 0.5, brake: 0, drift: false };
    }

    // Vector from kart to target checkpoint centre.
    const dir: Vec2 = {
      x: target.position.x - kart.position.x,
      z: target.position.z - kart.position.z,
    };

    // Desired heading angle (radians) using atan2.
    const desiredAngle = Math.atan2(dir.z, dir.x);
    // Current kart heading (radians). kart.heading is stored as radians.
    const currentAngle = kart.heading;
    // Smallest angular difference.
    let delta = desiredAngle - currentAngle;
    // Normalize to [-π, π].
    delta = ((delta + Math.PI) % (2 * Math.PI)) - Math.PI;

    // Simple proportional steering: max steering = 1.
    const steering = Math.max(-1, Math.min(1, delta * 2)); // gain = 2

    // Constant throttle, no brake, no drift.
    return {
      steering,
      throttle: 0.8,
      brake: 0,
      drift: false,
    };
  }
}
