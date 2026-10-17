import type { DriftConfig } from '../config/drift'
import type { KartPhysicsConfig } from '../config/kartPhysics'
import type { KartInput } from '../input/kartInput'
import { stepKart } from './kart/kartPhysics'
import { createKartState, type KartState } from './kart/kartState'
import { resolveTrackCollision } from './kart/trackCollision'
import { RaceManager, type RaceManagerOptions } from './race/raceManager'
import { getSurfaceProperties } from './race/surface'
import type { Track } from './track'

/** A kart in the race together with its own race progress (laps, checkpoints, respawns). */
export interface Racer {
  kart: KartState
  readonly race: RaceManager
}

export function createRacer(track: Track, raceOptions?: RaceManagerOptions): Racer {
  const { position, heading } = track.startPose()
  return {
    kart: createKartState(position, heading),
    race: new RaceManager(track.checkpoints, raceOptions),
  }
}

/** Puts the racer back on the grid with a fresh race state. */
export function resetRacer(racer: Racer, track: Track): void {
  const { position, heading } = track.startPose()
  racer.kart = createKartState(position, heading)
  racer.race.reset()
}

/**
 * Advances one racer by `dt`: race rules first, then physics on the surface under the kart.
 * Player and bots go through this same pipeline.
 */
export function stepRacer(
  racer: Racer,
  input: KartInput,
  track: Track,
  physics: KartPhysicsConfig,
  drift: DriftConfig,
  dt: number,
): void {
  const { kart, race } = racer
  const groundHeight = (x: number, z: number): number => track.groundHeight(x, z)

  race.update(kart, input, drift, groundHeight, dt)

  // Lock pedals during countdown so the kart stays parked on the grid
  const drivingInput =
    race.state.phase === 'countdown' ? { ...input, throttle: 0, brake: 0 } : input

  const surfaceProps = getSurfaceProperties(track.surfaceAt(kart.position.x, kart.position.z))
  const effectivePhysics: KartPhysicsConfig = {
    ...physics,
    maxSpeed: physics.maxSpeed * surfaceProps.speedMultiplier,
    acceleration: physics.acceleration * surfaceProps.accelerationMultiplier,
    lateralGrip: physics.lateralGrip * surfaceProps.gripMultiplier,
  }

  stepKart(kart, drivingInput, effectivePhysics, drift, groundHeight, dt)
  resolveTrackCollision(kart, track, physics, dt)
}
