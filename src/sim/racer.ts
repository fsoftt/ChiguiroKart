import type { CharacterId } from '../config/characters'
import { characters, characterTuning } from '../config/characters'
import { defaultGrid, type GridConfig } from '../config/grid'
import type { DriftConfig } from '../config/drift'
import type { KartPhysicsConfig } from '../config/kartPhysics'
import type { KartInput } from '../input/kartInput'
import { stepKart } from './kart/kartPhysics'
import { createKartState, type KartState } from './kart/kartState'
import { resolveTrackCollision } from './kart/trackCollision'
import { defaultItems, type ItemsConfig } from '../config/items'
import { defaultHazards, type HazardsConfig } from '../config/hazards'
import { applyBoostPads } from './hazards/boostPads'
import { applyJumps } from './hazards/jumps'
import { endDrift } from './kart/drift'
import { createRacerItems, type RacerItems } from './items/itemTypes'
import { statusModifiers } from './items/statusModifiers'
import { RaceManager, type RaceManagerOptions } from './race/raceManager'
import { getSurfaceProperties } from './race/surface'
import { NEUTRAL_INPUT } from '../input/kartInput'
import { characterPerks, characterPhysics, slipstream, surfaceFor } from './characters'
import { clamp, forwardOf, rightOf } from './math'
import type { Pose, Track } from './track'

/** A kart in the race together with its own race progress (laps, checkpoints, respawns). */
export interface Racer {
  kart: KartState
  readonly race: RaceManager
  /** Starting grid slot (0 = pole position). */
  readonly slot: number
  /** Who drives this kart: sets its stats and passive perk (see `config/characters`). */
  character: CharacterId
  /**
   * Multiplies top speed and acceleration (1 = the kart's normal limits). The player keeps 1;
   * bots use it for their difficulty and the rubber band.
   */
  speedScale: number
  /** Uchuvas, held power and temporary effects (written by `ItemSystem`). */
  items: RacerItems
}

/**
 * Pose of a starting grid slot: two karts per row, staggered either side of the centerline,
 * each row further behind the start line along the start heading. Even slots sit on the left.
 */
export function gridPose(track: Track, slot: number, grid: GridConfig = defaultGrid): Pose {
  const start = track.startPose()
  const row = Math.floor(slot / 2)
  const right = slot % 2
  const back = row * grid.rowSpacing + right * grid.stagger
  const side = (right === 1 ? 1 : -1) * grid.lateralOffset
  const forward = forwardOf(start.heading)
  const rightVec = rightOf(start.heading)
  const x = start.position.x - forward.x * back + rightVec.x * side
  const z = start.position.z - forward.z * back + rightVec.z * side
  return { position: { x, y: track.groundHeight(x, z), z }, heading: start.heading }
}

export function createRacer(
  track: Track,
  raceOptions?: RaceManagerOptions,
  slot = 0,
  character: CharacterId = 'chiguiro',
): Racer {
  const { position, heading } = gridPose(track, slot)
  return {
    slot,
    character,
    speedScale: 1,
    items: createRacerItems(),
    kart: createKartState(position, heading),
    race: new RaceManager(track.checkpoints, raceOptions),
  }
}

/** Puts the racer back on its grid slot with a fresh race state (same character). */
export function resetRacer(racer: Racer, track: Track): void {
  const { position, heading } = gridPose(track, racer.slot)
  racer.kart = createKartState(position, heading)
  racer.items = createRacerItems()
  racer.race.reset()
}

/**
 * Advances one racer by `dt`: race rules first, then physics on the surface under the kart.
 * Player and bots go through this same pipeline. `others` are the racers visible to this one
 * (needed by position-based perks such as the Jaguar's slipstream).
 */
export function stepRacer(
  racer: Racer,
  input: KartInput,
  track: Track,
  physics: KartPhysicsConfig,
  drift: DriftConfig,
  dt: number,
  items: ItemsConfig = defaultItems,
  others: readonly Racer[] = [],
  hazards: HazardsConfig = defaultHazards,
): void {
  const { kart, race } = racer
  const groundHeight = (x: number, z: number): number => track.groundHeight(x, z)

  race.update(kart, input, drift, groundHeight, dt)

  const modifiers = statusModifiers(racer.items, items)
  if (modifiers.noControl) loseControl(racer, items, dt)

  // Lock pedals during countdown so the kart stays parked on the grid; a hit kart has no control
  const drivingInput = modifiers.noControl
    ? { ...NEUTRAL_INPUT }
    : race.state.phase === 'countdown'
      ? { ...input, throttle: 0, brake: 0 }
      : { ...input, steer: clamp(input.steer + modifiers.steerOffset, -1, 1) }

  const surface = track.surfaceAt(kart.position.x, kart.position.z)
  const surfaceProps = surfaceFor(racer.character, surface, getSurfaceProperties(surface))
  const scale = racer.speedScale * modifiers.speedFactor
  const slip = slipstream(racer, others)
  const { depredador } = characterTuning.perks
  const stats = characterPhysics(physics, characters[racer.character].stats)
  const effectivePhysics: KartPhysicsConfig = {
    ...stats,
    maxSpeed:
      stats.maxSpeed * surfaceProps.speedMultiplier * scale * (1 + slip * depredador.speedBonus),
    acceleration:
      stats.acceleration *
      surfaceProps.accelerationMultiplier *
      scale *
      (1 + slip * depredador.accelerationBonus),
    lateralGrip: stats.lateralGrip * surfaceProps.gripMultiplier * modifiers.gripFactor,
  }

  // Turbo strips and launch ramps: only once the race has started, so parked karts are untouched
  if (race.state.phase === 'racing') {
    applyBoostPads(kart, track, drift, hazards)
    applyJumps(kart, track, drivingInput.jump, dt)
  }

  stepKart(
    kart,
    drivingInput,
    effectivePhysics,
    drift,
    groundHeight,
    dt,
    characterPerks(racer.character),
  )
  resolveTrackCollision(kart, track, physics, dt)
}

/** A hit kart slides to a stop and its drift ends. */
function loseControl(racer: Racer, items: ItemsConfig, dt: number): void {
  const { kart } = racer
  endDrift(kart)
  const damping = Math.exp(-items.hit.hitDamping * dt)
  kart.velocity.x *= damping
  kart.velocity.z *= damping
}
