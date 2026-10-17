/** Pure logic that decides how the driver's looping clips are blended (no Three.js). */
import { clamp, damp } from '../sim/math'
import type { PowerId } from '../sim/items/itemTypes'
import { loopClips, type ActionClip, type LoopClip } from './characters/rig'

export type ClipWeights = Record<LoopClip, number>
export type RaceResult = 'victory' | 'defeat'

/** What the animation needs to know about a racer this frame. */
export interface DriverAnimInput {
  /** -1 (left) .. 1 (right). */
  steer: number
  /** -1 drifting left, 1 drifting right, 0 not drifting. */
  driftDirection: number
  boostActive: boolean
  /** Seconds off the ground in the current jump (0 on the ground). */
  airTime: number
  /** True while the racer is spinning out or flipping from a hit. */
  hit: boolean
  /** Set once the race is over; overrides everything else. */
  result: RaceResult | null
}

/** The air pose only shows after this long off the ground, so ramps and bumps do not flicker. */
export const AIR_DELAY = 0.15
/** How fast the weights follow their targets (1/s). */
export const WEIGHT_SMOOTHING = 12
/** Share of the steering clips that stays while drifting. */
const DRIFT_STEER_SHARE = 0.4

export function zeroWeights(): ClipWeights {
  const weights = {} as ClipWeights
  for (const clip of loopClips) weights[clip] = 0
  return weights
}

/** Target weight of every looping clip; they add up to 1. */
export function driverAnimWeights(input: DriverAnimInput): ClipWeights {
  const weights = zeroWeights()
  if (input.result) {
    weights[input.result] = 1
    return weights
  }
  if (input.hit) {
    weights.hit = 1
    return weights
  }
  if (input.airTime > AIR_DELAY) {
    weights.air = 1
    return weights
  }
  const steer = clamp(input.steer, -1, 1)
  const drifting = input.driftDirection !== 0
  const steerShare = drifting ? DRIFT_STEER_SHARE : 1
  weights.steerLeft = Math.max(0, -steer) * steerShare
  weights.steerRight = Math.max(0, steer) * steerShare
  weights.drift = drifting ? 1 : 0
  weights.boost = input.boostActive ? 1 : 0
  const total = loopClips.reduce((sum, clip) => sum + weights[clip], 0)
  weights.idle = Math.max(0, 1 - total)
  const sum = total + weights.idle
  for (const clip of loopClips) weights[clip] /= sum
  return weights
}

/** Moves `current` toward `target` (frame-rate independent); `dt = 0` changes nothing. */
export function smoothWeights(
  current: ClipWeights,
  target: ClipWeights,
  dt: number,
  smoothing = WEIGHT_SMOOTHING,
): void {
  for (const clip of loopClips) current[clip] = damp(current[clip], target[clip], smoothing, dt)
}

const ACTION_FADE_IN = 0.08
const ACTION_FADE_OUT = 0.2

/** Weight (0..1) of a one-shot action `time` seconds into a clip of `duration` seconds. */
export function actionWeight(time: number, duration: number): number {
  if (duration <= 0 || time < 0 || time >= duration) return 0
  const fadeIn = clamp(time / ACTION_FADE_IN, 0, 1)
  const fadeOut = clamp((duration - time) / ACTION_FADE_OUT, 0, 1)
  return Math.min(fadeIn, fadeOut)
}

/** Powers dropped behind the kart whatever the player holds. */
const DROPPED_BEHIND: readonly PowerId[] = ['tejo', 'mango']

/** Which throw gesture a racer makes when using `power`. */
export function throwActionFor(power: PowerId, lookBack: boolean): ActionClip {
  return lookBack || DROPPED_BEHIND.includes(power) ? 'throwBack' : 'throwForward'
}
