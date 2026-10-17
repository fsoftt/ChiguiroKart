/** Pure helpers of the audio system: notes, scales, engine mapping, distances and volumes. */
import {
  defaultVolumes,
  engineTuning,
  hearingRange,
  type AudioVolumes,
  type EngineProfile,
} from '../config/audio'
import { clamp, lerp } from '../sim/math'

export type ScaleName = 'major' | 'minor' | 'dorian' | 'mixolydian' | 'phrygian'

/** Semitone offsets of the seven degrees of each scale. */
export const SCALES: Record<ScaleName, readonly number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
}

/** Frequency (Hz) of a MIDI note (69 = A4 = 440 Hz). */
export function midiToFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

/** MIDI note of a scale degree (0 = root); degrees below 0 or above 6 wrap by octaves. */
export function degreeToMidi(root: number, scale: ScaleName, degree: number): number {
  const steps = SCALES[scale]
  const octave = Math.floor(degree / steps.length)
  const index = degree - octave * steps.length
  return root + octave * 12 + (steps[index] ?? 0)
}

/** Seconds of one sequencer step; `tempo` is in beats per minute, four steps per beat. */
export function stepSeconds(tempo: number, tempoScale = 1): number {
  return 60 / (tempo * tempoScale) / 4
}

/** What the engine oscillators should do right now. */
export interface EngineTarget {
  frequency: number
  cutoff: number
  gain: number
  squareMix: number
}

export interface EngineInput {
  /** Forward speed over top speed; the sign is ignored. */
  speedRatio: number
  /** 0..1 */
  throttle: number
  airborne: boolean
  /** Active nitro level 0..3. */
  nitroLevel: number
  /** False while the race is not on (menu): the engine is silent. */
  active: boolean
  /** True once the kart has crossed the finish line: it coasts quietly. */
  finished: boolean
}

const tuning = engineTuning

/** Engine pitch, brightness and loudness from the kart state and the character's voice. */
export function engineTarget(input: EngineInput, profile: EngineProfile): EngineTarget {
  const ratio = clamp(Math.abs(input.speedRatio), 0, 1.3)
  const level = clamp(Math.round(input.nitroLevel), 0, 3)
  const speedPart = (tuning.topFrequencyRatio - 1) * ratio ** tuning.speedCurve
  const rise = 1 + speedPart + tuning.throttleRise * input.throttle + (tuning.nitroRise[level] ?? 0)
  let frequency = tuning.idleFrequency * profile.pitch * rise
  let cutoff =
    lerp(tuning.idleCutoff, tuning.topCutoff, clamp(ratio, 0, 1)) *
    profile.brightness *
    (tuning.nitroBrightness[level] ?? 1)
  let gain = lerp(tuning.idleGain, tuning.driveGain, clamp(ratio * 3 + input.throttle * 0.3, 0, 1))
  if (input.airborne) {
    frequency *= tuning.airPitch
    cutoff *= tuning.airCutoff
    gain *= tuning.airGain
  }
  if (input.finished) gain *= 0.4
  if (!input.active) gain = 0
  return { frequency, cutoff, gain, squareMix: profile.squareMix }
}

/** Loudness 0..1 of a sound `distance` metres from the player: full when near, silent when far. */
export function distanceGain(distance: number): number {
  const { near, far } = hearingRange
  if (distance <= near) return 1
  if (distance >= far) return 0
  const t = (distance - near) / (far - near)
  return (1 - t) * (1 - t)
}

/** Volumes from the URL: `?volumen=0.5` scales the master volume, `?volumen=0` mutes. */
export function volumesFromSearch(search: string): AudioVolumes {
  const raw = new URLSearchParams(search).get('volumen')
  const value = raw === null || raw.trim() === '' ? Number.NaN : Number(raw)
  if (!Number.isFinite(value)) return { ...defaultVolumes }
  return { ...defaultVolumes, master: defaultVolumes.master * clamp(value, 0, 1) }
}
