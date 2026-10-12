import type { DriftConfig } from '../config/drift'
import type { KartPhysicsConfig } from '../config/kartPhysics'
import type { KartInput } from '../input/kartInput'
import { stepKart } from './kart/kartPhysics'
import { createKartState, type KartState } from './kart/kartState'
import { resolveTrackCollision } from './kart/trackCollision'
import { Track, type TrackDefinition } from './track'

/** The whole simulated race. Pure logic: no rendering, DOM or network. */
export class RaceWorld {
  readonly track: Track
  kart: KartState

  constructor(
    trackDefinition: TrackDefinition,
    readonly physics: KartPhysicsConfig,
    readonly drift: DriftConfig,
  ) {
    this.track = new Track(trackDefinition)
    this.kart = this.spawnKart()
  }

  step(input: KartInput, dt: number): void {
    stepKart(
      this.kart,
      input,
      this.physics,
      this.drift,
      (x, z) => this.track.groundHeight(x, z),
      dt,
    )
    resolveTrackCollision(this.kart, this.track, this.physics, dt)
  }

  resetKart(): void {
    this.kart = this.spawnKart()
  }

  private spawnKart(): KartState {
    const { position, heading } = this.track.startPose()
    return createKartState(position, heading)
  }
}
