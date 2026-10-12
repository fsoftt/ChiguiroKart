import type { DriftConfig } from '../config/drift'
import type { KartPhysicsConfig } from '../config/kartPhysics'
import type { KartInput } from '../input/kartInput'
import { stepKart } from './kart/kartPhysics'
import { createKartState, type KartState } from './kart/kartState'
import { resolveTrackCollision } from './kart/trackCollision'
import { getSurfaceProperties } from './race/surface'
import { RaceManager, type RaceManagerOptions } from './race/raceManager'
import { Track, type TrackDefinition } from './track'

/** The whole simulated race. Pure logic: no rendering, DOM or network. */
export class RaceWorld {
  readonly track: Track
  readonly raceManager: RaceManager
  kart: KartState

  constructor(
    trackDefinition: TrackDefinition,
    readonly physics: KartPhysicsConfig,
    readonly drift: DriftConfig,
    raceOptions?: RaceManagerOptions,
  ) {
    this.track = new Track(trackDefinition)
    this.raceManager = new RaceManager(this.track.checkpoints, raceOptions)
    this.kart = this.spawnKart()
  }

  step(input: KartInput, dt: number): void {
    this.raceManager.update(
      this.kart,
      input,
      this.drift,
      (x, z) => this.track.groundHeight(x, z),
      dt,
    )

    // Lock pedals during countdown so the kart stays parked on the grid
    const drivingInput =
      this.raceManager.state.phase === 'countdown' ? { ...input, throttle: 0, brake: 0 } : input

    const surfaceType = this.track.surfaceAt(this.kart.position.x, this.kart.position.z)
    const surfaceProps = getSurfaceProperties(surfaceType)
    const effectivePhysics: KartPhysicsConfig = {
      ...this.physics,
      maxSpeed: this.physics.maxSpeed * surfaceProps.speedMultiplier,
      acceleration: this.physics.acceleration * surfaceProps.accelerationMultiplier,
      lateralGrip: this.physics.lateralGrip * surfaceProps.gripMultiplier,
    }

    stepKart(
      this.kart,
      drivingInput,
      effectivePhysics,
      this.drift,
      (x, z) => this.track.groundHeight(x, z),
      dt,
    )
    resolveTrackCollision(this.kart, this.track, this.physics, dt)
  }

  resetKart(): void {
    this.kart = this.spawnKart()
    this.raceManager.reset()
  }

  private spawnKart(): KartState {
    const { position, heading } = this.track.startPose()
    return createKartState(position, heading)
  }
}
