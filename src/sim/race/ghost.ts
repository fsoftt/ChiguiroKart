import type { DriftDirection } from '../kart/driftState'
import type { KartState } from '../kart/kartState'
import { lerp, lerpAngle, wrapAngle } from '../math'
import type { RaceState } from './raceState'
import type { StorageLike } from './records'

/** Simulation steps between two recorded samples (60 Hz / 3 = 20 Hz). */
export const GHOST_SAMPLE_STEPS = 3
/** Simulation rate the recorder assumes. */
export const GHOST_SIM_HZ = 60
/** Seconds between two samples. */
export const GHOST_SAMPLE_INTERVAL = GHOST_SAMPLE_STEPS / GHOST_SIM_HZ
/** Format version, part of the storage key and of the payload. */
export const GHOST_VERSION = 1
/** Upper bound of samples accepted when loading (about 16 minutes at 20 Hz). */
const MAX_SAMPLES = 20000
/** Positions are stored in centimeters and headings in milliradians. */
const POSITION_UNIT = 100
const HEADING_UNIT = 1000
const INTERVAL_TOLERANCE = 1e-6
const FLAG_ON_GROUND = 1
const DRIFT_SHIFT = 1
/** Numbers stored per sample: x, y, z, heading, flags. */
const FIELDS = 5

/** One recorded pose, already quantized (meters and radians). */
export interface GhostSample {
  x: number
  y: number
  z: number
  heading: number
  onGround: boolean
  /** -1, 0 or 1: side the kart is drifting to (0 = not drifting). */
  drift: DriftDirection
}

/** A recorded run: samples every `GHOST_SAMPLE_INTERVAL` seconds from the green light. */
export interface Ghost {
  track: string
  /** Total race time in seconds when the run finished. */
  totalTime: number
  lapTimes: number[]
  samples: GhostSample[]
}

/** Interpolated pose of a ghost at some race time. */
export interface GhostPose extends GhostSample {
  /** Approximate ground speed (m/s), for wheel animation. */
  speed: number
}

function quantize(value: number, unit: number): number {
  // `+ 0` turns -0 into 0
  return Math.round(value * unit) / unit + 0
}

function sampleFrom(kart: KartState): GhostSample {
  return {
    x: quantize(kart.position.x, POSITION_UNIT),
    y: quantize(kart.position.y, POSITION_UNIT),
    z: quantize(kart.position.z, POSITION_UNIT),
    heading: quantize(wrapAngle(kart.heading), HEADING_UNIT),
    onGround: kart.onGround,
    drift: kart.drift.direction,
  }
}

/** Records the player's pose every `GHOST_SAMPLE_STEPS` steps while the race is running. */
export class GhostRecorder {
  private readonly samples: GhostSample[] = []
  private steps = 0

  /** Call once per simulation step after the kart moved; ignores steps outside 'racing'. */
  record(kart: KartState, race: RaceState): void {
    if (race.phase !== 'racing') return
    if (this.steps % GHOST_SAMPLE_STEPS === 0) this.samples.push(sampleFrom(kart))
    this.steps++
  }

  get sampleCount(): number {
    return this.samples.length
  }

  reset(): void {
    this.samples.length = 0
    this.steps = 0
  }

  /** The finished run, or null if nothing was recorded. */
  finish(track: string, race: RaceState): Ghost | null {
    if (this.samples.length === 0) return null
    return {
      track,
      totalTime: race.totalRaceTime,
      lapTimes: [...race.lapTimes],
      samples: this.samples.map((sample) => ({ ...sample })),
    }
  }
}

/** Time covered by the samples, in seconds. */
export function ghostDuration(ghost: Ghost): number {
  return Math.max(ghost.samples.length - 1, 0) * GHOST_SAMPLE_INTERVAL
}

/**
 * Pose of the ghost `time` seconds after the green light, interpolated between samples.
 * Negative times give the first sample; null once the recording is over.
 */
export function ghostPoseAt(ghost: Ghost, time: number): GhostPose | null {
  const first = ghost.samples[0]
  if (!first) return null
  if (time > ghostDuration(ghost)) return null
  const position = Math.max(time, 0) / GHOST_SAMPLE_INTERVAL
  const index = Math.min(Math.floor(position), ghost.samples.length - 1)
  const a = ghost.samples[index] ?? first
  const b = ghost.samples[index + 1] ?? a
  const t = Math.min(position - index, 1)
  const x = lerp(a.x, b.x, t)
  const z = lerp(a.z, b.z, t)
  return {
    x,
    y: lerp(a.y, b.y, t),
    z,
    heading: lerpAngle(a.heading, b.heading, t),
    // Discrete flags come from the sample just passed
    onGround: a.onGround,
    drift: a.drift,
    speed: Math.hypot(b.x - a.x, b.z - a.z) / GHOST_SAMPLE_INTERVAL,
  }
}

/**
 * Time difference (seconds) against the ghost at the end of lap `lapIndex` (0-based),
 * given the player's cumulative time then. Negative = ahead of the ghost; null if unknown.
 */
export function lapDelta(
  ghost: Ghost,
  lapIndex: number,
  playerLapTimes: readonly number[],
): number | null {
  if (lapIndex >= ghost.lapTimes.length || lapIndex >= playerLapTimes.length) return null
  let player = 0
  let ghostTime = 0
  for (let i = 0; i <= lapIndex; i++) {
    player += playerLapTimes[i] ?? 0
    ghostTime += ghost.lapTimes[i] ?? 0
  }
  return player - ghostTime
}

/** Whether a run of `totalTime` should replace the stored ghost (none stored, or slower). */
export function isBetterGhost(existing: Ghost | null, totalTime: number): boolean {
  return Number.isFinite(totalTime) && (!existing || totalTime < existing.totalTime)
}

interface StoredGhost {
  v: number
  track: string
  /** Total time in milliseconds. */
  t: number
  /** Lap times in milliseconds. */
  l: number[]
  /** Seconds between samples. */
  dt: number
  /** Delta-encoded integers: x, y, z (cm), heading (mrad), flags per sample. */
  s: number[]
}

function flagsOf(sample: GhostSample): number {
  return (sample.onGround ? FLAG_ON_GROUND : 0) | ((sample.drift + 1) << DRIFT_SHIFT)
}

/** Compact JSON: quantized integers, positions and heading stored as deltas. */
export function serializeGhost(ghost: Ghost): string {
  const s: number[] = []
  const previous = [0, 0, 0, 0]
  for (const sample of ghost.samples) {
    const current = [
      Math.round(sample.x * POSITION_UNIT),
      Math.round(sample.y * POSITION_UNIT),
      Math.round(sample.z * POSITION_UNIT),
      Math.round(sample.heading * HEADING_UNIT),
    ]
    for (let i = 0; i < current.length; i++) {
      s.push((current[i] ?? 0) - (previous[i] ?? 0))
      previous[i] = current[i] ?? 0
    }
    s.push(flagsOf(sample))
  }
  const stored: StoredGhost = {
    v: GHOST_VERSION,
    track: ghost.track,
    t: Math.round(ghost.totalTime * 1000),
    l: ghost.lapTimes.map((lap) => Math.round(lap * 1000)),
    dt: GHOST_SAMPLE_INTERVAL,
    s,
  }
  return JSON.stringify(stored)
}

function isIntegerArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => Number.isInteger(item))
}

/** Parses a stored ghost; returns null for anything corrupted, old or from another track. */
export function deserializeGhost(raw: string, track?: string): Ghost | null {
  try {
    const data: unknown = JSON.parse(raw)
    if (typeof data !== 'object' || data === null) return null
    const stored = data as Partial<StoredGhost>
    if (stored.v !== GHOST_VERSION) return null
    if (typeof stored.track !== 'string' || (track !== undefined && stored.track !== track)) {
      return null
    }
    if (typeof stored.t !== 'number' || !Number.isFinite(stored.t) || stored.t <= 0) return null
    if (!isIntegerArray(stored.l) || !isIntegerArray(stored.s)) return null
    if (typeof stored.dt !== 'number') return null
    if (Math.abs(stored.dt - GHOST_SAMPLE_INTERVAL) > INTERVAL_TOLERANCE) return null
    const numbers = stored.s
    if (numbers.length === 0 || numbers.length % FIELDS !== 0) return null
    if (numbers.length / FIELDS > MAX_SAMPLES) return null

    const samples: GhostSample[] = []
    const sum = [0, 0, 0, 0]
    for (let i = 0; i < numbers.length; i += FIELDS) {
      for (let k = 0; k < sum.length; k++) sum[k] = (sum[k] ?? 0) + (numbers[i + k] ?? 0)
      const flags = numbers[i + 4] ?? 0
      const drift = (flags >> DRIFT_SHIFT) - 1
      if (flags < 0 || (drift !== -1 && drift !== 0 && drift !== 1)) return null
      samples.push({
        x: (sum[0] ?? 0) / POSITION_UNIT,
        y: (sum[1] ?? 0) / POSITION_UNIT,
        z: (sum[2] ?? 0) / POSITION_UNIT,
        heading: (sum[3] ?? 0) / HEADING_UNIT,
        onGround: (flags & FLAG_ON_GROUND) !== 0,
        drift,
      })
    }
    return {
      track: stored.track,
      totalTime: stored.t / 1000,
      lapTimes: stored.l.map((lap) => lap / 1000),
      samples,
    }
  } catch {
    return null
  }
}

/** Storage key of a track's ghost, e.g. `chiguirokart.ghost.v1.valle_de_cocora`. */
export function ghostStorageKey(track: string): string {
  const sanitized = track.toLowerCase().replace(/[^a-z0-9]/g, '_')
  return `chiguirokart.ghost.v${GHOST_VERSION}.${sanitized}`
}

function resolveStorage(custom?: StorageLike): StorageLike | null {
  if (custom) return custom
  try {
    if (typeof localStorage !== 'undefined') return localStorage
  } catch {
    // Storage can throw when blocked by the browser
  }
  return null
}

/** The stored best ghost of the track, or null if none or unreadable. */
export function loadGhost(track: string, storage?: StorageLike): Ghost | null {
  try {
    const raw = resolveStorage(storage)?.getItem(ghostStorageKey(track))
    return raw ? deserializeGhost(raw, track) : null
  } catch {
    return null
  }
}

/**
 * Stores the ghost only if it beats the one already saved (or none is saved).
 * `isNewBest` tells whether the run is a record; `saved` whether it reached the storage.
 */
export function saveGhostIfBetter(
  ghost: Ghost,
  storage?: StorageLike,
): { isNewBest: boolean; saved: boolean } {
  const store = resolveStorage(storage)
  const isNewBest = isBetterGhost(store ? loadGhost(ghost.track, store) : null, ghost.totalTime)
  if (!isNewBest || !store) return { isNewBest, saved: false }
  try {
    store.setItem(ghostStorageKey(ghost.track), serializeGhost(ghost))
    return { isNewBest, saved: true }
  } catch {
    // Quota or blocked storage: the record still counts for this session
    return { isNewBest, saved: false }
  }
}
