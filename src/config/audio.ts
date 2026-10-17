/** Audio tuning (docs/diseno.md §2.6): volumes, engine sound, voices and power sounds. */
import type { CharacterId } from './characters'
import type { PowerId } from '../sim/items/itemTypes'

/** Linear gains 0..1. Music sits below the effects so it never masks the engine. */
export interface AudioVolumes {
  master: number
  music: number
  sfx: number
}

export const defaultVolumes: AudioVolumes = { master: 0.8, music: 0.5, sfx: 0.8 }

/** Seconds a volume change takes to settle (time constant of `setTargetAtTime`). */
export const VOLUME_SMOOTHING = 0.05

/** Most sounds alive at once, and most of the same kind (a quick burst gets thinned out). */
export const MAX_VOICES = 28
export const MAX_VOICES_PER_KEY = 4

/** Engine voice of one character: pitch multiplier and how much of the square wave is mixed in. */
export interface EngineProfile {
  pitch: number
  /** 0 = pure saw, 1 = pure square. */
  squareMix: number
  /** Filter cutoff multiplier (brighter or duller). */
  brightness: number
}

export const engineProfiles: Record<CharacterId, EngineProfile> = {
  chiguiro: { pitch: 1, squareMix: 0.45, brightness: 1 },
  oso: { pitch: 0.78, squareMix: 0.6, brightness: 0.85 },
  titi: { pitch: 1.35, squareMix: 0.3, brightness: 1.15 },
  condor: { pitch: 1.1, squareMix: 0.25, brightness: 1.2 },
  jaguar: { pitch: 0.92, squareMix: 0.7, brightness: 1.05 },
  guacamaya: { pitch: 1.25, squareMix: 0.5, brightness: 1.1 },
  delfin: { pitch: 1.15, squareMix: 0.2, brightness: 1.25 },
  perezoso: { pitch: 0.7, squareMix: 0.4, brightness: 0.75 },
}

/** How speed, throttle, nitro and air time shape the engine. */
export const engineTuning = {
  /** Frequency (Hz) of the idle rumble before the character pitch. */
  idleFrequency: 46,
  /** Frequency multiplier at top speed. */
  topFrequencyRatio: 3.6,
  /** Curve exponent of the speed ratio (below 1 = pitch rises fast at first). */
  speedCurve: 0.85,
  /** Extra pitch fraction while the throttle is held. */
  throttleRise: 0.12,
  /** Extra pitch fraction per nitro level 0..3. */
  nitroRise: [0, 0.1, 0.18, 0.26],
  /** Filter cutoff (Hz) at idle and at top speed. */
  idleCutoff: 260,
  topCutoff: 1500,
  /** Extra cutoff multiplier per nitro level 0..3. */
  nitroBrightness: [1, 1.3, 1.6, 2],
  /** Multipliers while airborne: the wheels spin free. */
  airPitch: 0.86,
  airCutoff: 0.6,
  airGain: 0.5,
  /** Gain at idle (countdown) and when driving; kept low, the engine is a bed. */
  idleGain: 0.16,
  driveGain: 0.26,
  /** Seconds the engine follows its targets. */
  smoothing: 0.06,
}

/** Drift squeal: filtered noise whose pitch follows the charge bar. */
export const driftSound = {
  minFrequency: 1400,
  maxFrequency: 3200,
  gain: 0.12,
  /** Speed ratio below which there is no squeal. */
  minSpeedRatio: 0.15,
}

/** Sounds of other racers and the world fade out with the distance to the player (m). */
export const hearingRange = { near: 6, far: 70 }

/** A speed drop above this (ratio of top speed within one frame) counts as a wall bump. */
export const BUMP_SPEED_DROP = 0.18
/** Air time (s) at which a landing thud is at full strength. */
export const FULL_LANDING_AIR_TIME = 0.9
/** Landings after less air time than this make no sound (kerbs and small bumps). */
export const MIN_LANDING_AIR_TIME = 0.12
/** Place that still counts as a win for the fanfare and the character's voice. */
export const WIN_PLACE = 3
/** Tempo multiplier of the music on the final lap. */
export const FINAL_LAP_TEMPO = 1.08

export type PowerSoundKind =
  'throw' | 'heavy' | 'drop' | 'buzz' | 'shield' | 'swarm' | 'rain' | 'zap' | 'mask'

/** Which sound each power makes when used. */
export const powerSounds: Record<PowerId, PowerSoundKind> = {
  coco: 'throw',
  tejo: 'heavy',
  mango: 'throw',
  panela: 'drop',
  armadillo: 'shield',
  avispa: 'buzz',
  colibri: 'buzz',
  mosquitos: 'swarm',
  sombrero: 'drop',
  hormigas: 'swarm',
  aguacero: 'rain',
  rayo: 'zap',
  mascara: 'mask',
}

/** Voice of a character: a short chirp built from a few syllables. */
export interface VoiceProfile {
  wave: OscillatorType
  /** Base frequency (Hz). */
  pitch: number
  /** Frequency ratio from the start to the end of a syllable (below 1 falls). */
  glide: number
  syllables: number
  /** Seconds per syllable. */
  length: number
  /** Formant (bandpass) frequency and Q that give it a vowel-like color. */
  formant: number
  q: number
  /** Noise mixed in (growls, screeches), 0..1. */
  noise: number
}

export const voiceProfiles: Record<CharacterId, VoiceProfile> = {
  chiguiro: {
    wave: 'sawtooth',
    pitch: 330,
    glide: 0.8,
    syllables: 2,
    length: 0.11,
    formant: 900,
    q: 4,
    noise: 0,
  },
  oso: {
    wave: 'sawtooth',
    pitch: 95,
    glide: 0.8,
    syllables: 1,
    length: 0.4,
    formant: 450,
    q: 2,
    noise: 0.35,
  },
  titi: {
    wave: 'square',
    pitch: 1500,
    glide: 1.25,
    syllables: 4,
    length: 0.06,
    formant: 2400,
    q: 5,
    noise: 0,
  },
  condor: {
    wave: 'sawtooth',
    pitch: 1100,
    glide: 0.5,
    syllables: 1,
    length: 0.45,
    formant: 1800,
    q: 3,
    noise: 0.5,
  },
  jaguar: {
    wave: 'sawtooth',
    pitch: 130,
    glide: 0.6,
    syllables: 1,
    length: 0.5,
    formant: 700,
    q: 2.5,
    noise: 0.55,
  },
  guacamaya: {
    wave: 'square',
    pitch: 800,
    glide: 1.4,
    syllables: 2,
    length: 0.12,
    formant: 1500,
    q: 6,
    noise: 0.1,
  },
  delfin: {
    wave: 'sine',
    pitch: 1900,
    glide: 1.4,
    syllables: 3,
    length: 0.09,
    formant: 3000,
    q: 1,
    noise: 0,
  },
  perezoso: {
    wave: 'triangle',
    pitch: 210,
    glide: 0.85,
    syllables: 1,
    length: 0.55,
    formant: 500,
    q: 1.5,
    noise: 0,
  },
}
