// src/sim/botManager.ts

import type { KartInput } from '../input/kartInput';
import type { BotInputProvider } from '../input/botInput';
import type { RaceWorld } from './world';
import type { KartPhysicsConfig } from '../config/kartPhysics';
import type { DriftConfig } from '../config/drift';
import { stepKart } from './kart/kartPhysics';
import { resolveTrackCollision } from './kart/trackCollision';
import { getSurfaceProperties } from './race/surface';
import { createDriftState, createBoostState } from './kart/driftState';

/**
 * Manages a collection of AI‑controlled karts.
 * Each bot provides a {@link BotInputProvider} that computes the next {@link KartInput}.
 * The manager updates the bots each tick using the same physics pipeline as the
 * player kart. This keeps the implementation lightweight while still allowing
 * realistic behaviour.
 */
export class BotManager {
  private bots: {
    provider: BotInputProvider;
    kart: any;
    lastInput: KartInput;
  }[] = [];

  constructor(
    private world: RaceWorld,
    private physics: KartPhysicsConfig,
    private drift: DriftConfig,
  ) {}

  /** Add a new bot instance. */
  addBot(provider: BotInputProvider) {
    const start = this.world.track.startPose();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { createKartState } = require('./kart/kartState') as typeof import('./kart/kartState');
    const kart = createKartState(start.position, start.heading);
    this.bots.push({ provider, kart, lastInput: { steering: 0, throttle: 0, brake: 0, drift: false } });
  }

  /** Update all bots for the elapsed time `dt`. */
  update(dt: number) {
    for (const entry of this.bots) {
      const input: KartInput = entry.provider.nextInput(dt, this.world, entry.kart);
      entry.lastInput = input;

      const surfaceType = this.world.track.surfaceAt(entry.kart.position.x, entry.kart.position.z);
      const surfaceProps = getSurfaceProperties(surfaceType);
      const effectivePhysics = {
        ...this.physics,
        maxSpeed: this.physics.maxSpeed * surfaceProps.speedMultiplier,
        acceleration: this.physics.acceleration * surfaceProps.accelerationMultiplier,
        lateralGrip: this.physics.lateralGrip * surfaceProps.gripMultiplier,
      };

      stepKart(entry.kart, input, effectivePhysics, this.drift, (x, z) => this.world.track.groundHeight(x, z), dt);
      resolveTrackCollision(entry.kart, this.world.track, this.physics, dt);
    }
  }

  /** Get the internal array of bot kart states (read‑only). */
  getBotKarts(): any[] {
    return this.bots.map((b) => b.kart);
  }

  /** Get the last input generated for each bot. */
  getBotInfos(): { kart: any; input: KartInput }[] {
    return this.bots.map((b) => ({ kart: b.kart, input: b.lastInput }));
  }

  /** Get the number of bots managed. */
  count(): number {
    return this.bots.length;
  }
}
