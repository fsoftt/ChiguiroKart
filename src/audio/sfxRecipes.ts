/**
 * Sound effects as data: each one is a list of layers (an oscillator or filtered noise with
 * a pitch sweep and an envelope) that `SfxPlayer` turns into Web Audio nodes. Times are in
 * seconds, frequencies in Hz.
 */
import { voiceProfiles, type PowerSoundKind, type VoiceProfile } from '../config/audio'
import type { CharacterId } from '../config/characters'
import { midiToFrequency } from './audioMath'

interface LayerBase {
  /** Seconds after the sound starts. */
  delay?: number
  dur: number
  gain: number
  /** Seconds to reach full gain (default 5 ms). */
  attack?: number
}

export interface ToneLayer extends LayerBase {
  kind: 'tone'
  wave: OscillatorType
  f0: number
  /** End frequency; omitted = constant pitch. */
  f1?: number
  filter?: { type: BiquadFilterType; freq: number; q?: number }
}

export interface NoiseLayer extends LayerBase {
  kind: 'noise'
  filter: BiquadFilterType
  f0: number
  f1?: number
  q?: number
}

export type SfxLayer = ToneLayer | NoiseLayer

export type SfxId =
  | 'jump'
  | 'landing'
  | 'bump'
  | 'box'
  | 'uchuva'
  | 'nitro1'
  | 'nitro2'
  | 'nitro3'
  | 'chainBreak'
  | 'beepLow'
  | 'beepGo'
  | 'lap'
  | 'finalLap'
  | 'fanfareWin'
  | 'fanfareLose'
  | 'hit'
  | 'block'
  | 'explosion'
  | 'lightning'
  | 'stolen'
  | 'iceBreak'
  | 'click'
  | 'confirm'
  | `power-${PowerSoundKind}`

function tone(
  wave: OscillatorType,
  f0: number,
  dur: number,
  gain: number,
  extra: Partial<ToneLayer> = {},
): ToneLayer {
  return { kind: 'tone', wave, f0, dur, gain, ...extra }
}

function noise(
  filter: BiquadFilterType,
  f0: number,
  dur: number,
  gain: number,
  extra: Partial<NoiseLayer> = {},
): NoiseLayer {
  return { kind: 'noise', filter, f0, dur, gain, ...extra }
}

/** A jingle: notes (MIDI) one after another, each with a soft triangle octave on top. */
function jingle(
  midis: readonly number[],
  step: number,
  noteLength: number,
  wave: OscillatorType,
  gain: number,
): SfxLayer[] {
  const layers: SfxLayer[] = []
  midis.forEach((midi, i) => {
    const freq = midiToFrequency(midi)
    layers.push(tone(wave, freq, noteLength, gain, { delay: i * step }))
    layers.push(tone('triangle', freq * 2, noteLength, gain * 0.4, { delay: i * step }))
  })
  return layers
}

export const sfxRecipes: Record<SfxId, readonly SfxLayer[]> = {
  jump: [tone('sine', 300, 0.14, 0.25, { f1: 720 })],
  landing: [
    tone('sine', 120, 0.22, 0.45, { f1: 42 }),
    noise('lowpass', 500, 0.16, 0.3, { f1: 100 }),
  ],
  bump: [noise('lowpass', 900, 0.18, 0.4, { f1: 200 }), tone('square', 140, 0.12, 0.2, { f1: 70 })],
  box: [
    tone('sine', 660, 0.14, 0.22, { f1: 990 }),
    tone('sine', 1320, 0.2, 0.18, { delay: 0.08 }),
    tone('triangle', 1980, 0.25, 0.1, { delay: 0.14 }),
  ],
  uchuva: [tone('triangle', 1175, 0.12, 0.22), tone('triangle', 1568, 0.22, 0.22, { delay: 0.07 })],
  nitro1: [
    noise('bandpass', 500, 0.5, 0.3, { f1: 1800, q: 1, attack: 0.05 }),
    tone('sawtooth', 120, 0.4, 0.12, { f1: 240, filter: { type: 'lowpass', freq: 900 } }),
  ],
  nitro2: [
    noise('bandpass', 400, 0.65, 0.36, { f1: 2800, q: 1, attack: 0.05 }),
    tone('sawtooth', 130, 0.55, 0.15, { f1: 380, filter: { type: 'lowpass', freq: 1400 } }),
    tone('sine', 90, 0.3, 0.3, { f1: 50 }),
  ],
  nitro3: [
    noise('bandpass', 300, 0.9, 0.42, { f1: 4200, q: 0.8, attack: 0.06 }),
    tone('sawtooth', 100, 0.8, 0.18, { f1: 620, filter: { type: 'lowpass', freq: 2200 } }),
    tone('square', 800, 0.3, 0.07, { f1: 1600, delay: 0.1 }),
    tone('sine', 80, 0.4, 0.4, { f1: 36 }),
  ],
  chainBreak: [
    noise('bandpass', 3000, 0.3, 0.3, { f1: 600, q: 4 }),
    tone('sawtooth', 400, 0.3, 0.14, { f1: 90 }),
  ],
  beepLow: [tone('square', 440, 0.22, 0.2, { filter: { type: 'lowpass', freq: 2000 } })],
  beepGo: [
    tone('square', 880, 0.6, 0.22, { filter: { type: 'lowpass', freq: 3000 } }),
    tone('sine', 1320, 0.6, 0.2),
  ],
  lap: jingle([79, 84], 0.1, 0.25, 'triangle', 0.25),
  finalLap: jingle([72, 76, 79, 84, 88], 0.08, 0.2, 'triangle', 0.25),
  fanfareWin: [
    ...jingle([72, 72, 72, 76, 79], 0.14, 0.2, 'square', 0.12),
    ...jingle([84], 0.7, 0.9, 'square', 0.14).map((layer) => ({
      ...layer,
      delay: (layer.delay ?? 0) + 0.7,
    })),
  ],
  fanfareLose: jingle([67, 64, 62, 55], 0.28, 0.4, 'sawtooth', 0.09).map((layer) =>
    layer.kind === 'tone' ? { ...layer, filter: { type: 'lowpass', freq: 1200 } } : layer,
  ),
  hit: [
    tone('sawtooth', 400, 0.3, 0.3, { f1: 80, filter: { type: 'lowpass', freq: 1800 } }),
    noise('bandpass', 1000, 0.25, 0.3, { f1: 200 }),
  ],
  block: [
    tone('sine', 1400, 0.3, 0.25),
    tone('sine', 2100, 0.22, 0.15),
    noise('highpass', 5000, 0.06, 0.15),
  ],
  explosion: [noise('lowpass', 2000, 1.0, 0.7, { f1: 80 }), tone('sine', 90, 0.8, 0.6, { f1: 30 })],
  lightning: [
    noise('highpass', 4000, 0.5, 0.45, { f1: 800 }),
    tone('sawtooth', 1800, 0.4, 0.16, { f1: 100 }),
    tone('sine', 60, 0.5, 0.4, { delay: 0.05 }),
  ],
  stolen: [tone('triangle', 880, 0.2, 0.22, { f1: 440 })],
  iceBreak: [noise('highpass', 3000, 0.3, 0.3), tone('sine', 2000, 0.25, 0.15, { f1: 800 })],
  click: [tone('square', 900, 0.03, 0.1, { f1: 700 })],
  confirm: [tone('square', 600, 0.05, 0.1), tone('square', 900, 0.08, 0.1, { delay: 0.05 })],
  'power-throw': [
    noise('bandpass', 600, 0.25, 0.25, { f1: 1800, q: 1 }),
    tone('sine', 300, 0.2, 0.2, { f1: 600 }),
  ],
  'power-heavy': [
    noise('bandpass', 300, 0.3, 0.3, { f1: 900, q: 1 }),
    tone('sine', 180, 0.3, 0.3, { f1: 90 }),
  ],
  'power-drop': [tone('sine', 500, 0.15, 0.3, { f1: 200 }), noise('lowpass', 800, 0.1, 0.2)],
  'power-buzz': [
    tone('sawtooth', 220, 0.5, 0.1, { f1: 330, filter: { type: 'lowpass', freq: 1500 } }),
    tone('sawtooth', 226, 0.5, 0.1, { f1: 338, filter: { type: 'lowpass', freq: 1500 } }),
  ],
  'power-shield': [
    tone('sine', 400, 0.2, 0.25, { f1: 800 }),
    tone('triangle', 1200, 0.25, 0.2, { delay: 0.1 }),
  ],
  'power-swarm': [
    noise('bandpass', 1500, 0.7, 0.2, { f1: 2500, q: 8, attack: 0.1 }),
    tone('sawtooth', 180, 0.6, 0.07),
  ],
  'power-rain': [noise('bandpass', 4000, 0.8, 0.22, { q: 0.5, attack: 0.2 })],
  'power-zap': [tone('sawtooth', 1500, 0.35, 0.22, { f1: 60 }), noise('highpass', 3000, 0.3, 0.3)],
  'power-mask': jingle([67, 72, 76, 79], 0.06, 0.12, 'square', 0.1),
}

/** Seconds a recipe lasts (for the voice cap). */
export function recipeDuration(layers: readonly SfxLayer[]): number {
  let end = 0
  for (const layer of layers) end = Math.max(end, (layer.delay ?? 0) + layer.dur)
  return end
}

export type VoiceMood = 'hit' | 'win' | 'lose'

/** Chirp of a character: a few syllables glissing up (win), down (lose) or as defined (hit). */
export function voiceRecipe(profile: VoiceProfile, mood: VoiceMood): SfxLayer[] {
  const falling = profile.glide <= 1 ? profile.glide : 1 / profile.glide
  const rising = 1 / falling
  const ratio = mood === 'win' ? rising : mood === 'lose' ? falling : profile.glide
  const length = profile.length * (mood === 'lose' ? 1.5 : 1)
  const pitch = profile.pitch * (mood === 'lose' ? 0.85 : 1)
  const layers: SfxLayer[] = []
  for (let i = 0; i < profile.syllables; i++) {
    const delay = i * length * 1.2
    const f0 = pitch * (1 + 0.08 * i * (mood === 'win' ? 1 : -1))
    layers.push(
      tone(profile.wave, f0, length, 0.22, {
        f1: f0 * ratio,
        delay,
        attack: 0.01,
        filter: { type: 'bandpass', freq: profile.formant, q: profile.q },
      }),
    )
    if (profile.noise > 0) {
      layers.push(
        noise('bandpass', profile.formant, length, profile.noise * 0.3, { q: 1.5, delay }),
      )
    }
  }
  return layers
}

export function voiceFor(character: CharacterId, mood: VoiceMood): SfxLayer[] {
  return voiceRecipe(voiceProfiles[character], mood)
}
