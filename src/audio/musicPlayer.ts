import { degreeToMidi, midiToFrequency, stepSeconds } from './audioMath'
import type { AudioEngine } from './audioEngine'
import { StepSequencer, TICK_INTERVAL_MS } from './sequencer'
import { createNoiseBuffer } from './sfxPlayer'
import {
  musicThemes,
  rhythmStyles,
  type LeadNote,
  type MusicTheme,
  type RhythmStyle,
  type ThemeId,
} from '../config/music'

const SILENCE = 0.0001
/** Seconds the old theme takes to fade out when another one starts. */
const FADE_OUT = 0.5
/** Chord stab intervals as scale-degree offsets from the chord root (a triad). */
const TRIAD = [0, 2, 4] as const

/** One playing theme: its gain node (for fades), its sequencer and its derived data. */
interface Session {
  id: ThemeId
  theme: MusicTheme
  style: RhythmStyle
  out: GainNode
  sequencer: StepSequencer
  /** Lead notes by step inside the motif. */
  leadByStep: Map<number, LeadNote>
}

/**
 * Plays the data-driven themes of `config/music.ts` with a lookahead step sequencer: a
 * 25 ms timer schedules every step starting within the next 100 ms on the audio clock.
 */
export class MusicPlayer {
  private session: Session | null = null
  private timer: ReturnType<typeof setInterval> | null = null
  private tempoScale = 1
  private readonly noise: AudioBuffer

  constructor(
    private readonly ctx: AudioContext,
    private readonly engine: AudioEngine,
  ) {
    this.noise = createNoiseBuffer(ctx)
  }

  get current(): ThemeId | null {
    return this.session?.id ?? null
  }

  /** Plays theme `id` (fading out the previous one), or silence for null. */
  setTheme(id: ThemeId | null, tempoScale = 1): void {
    this.tempoScale = tempoScale
    if (id === this.session?.id) return
    this.fadeOutCurrent()
    if (id === null || !this.engine.music) {
      this.stopTimer()
      return
    }
    this.session = this.createSession(id, this.engine.music)
    this.session.sequencer.start(this.ctx.currentTime + 0.08)
    if (this.timer === null) {
      this.timer = setInterval(() => this.tick(), TICK_INTERVAL_MS)
    }
  }

  /** Changes the speed of the current theme (final lap). */
  setTempoScale(scale: number): void {
    this.tempoScale = scale
  }

  private tick(): void {
    this.session?.sequencer.tick(this.ctx.currentTime)
  }

  private stopTimer(): void {
    if (this.timer !== null) clearInterval(this.timer)
    this.timer = null
  }

  private fadeOutCurrent(): void {
    const old = this.session
    this.session = null
    if (!old) return
    const now = this.ctx.currentTime
    old.out.gain.cancelScheduledValues(now)
    old.out.gain.setTargetAtTime(0, now, FADE_OUT / 4)
    setTimeout(() => old.out.disconnect(), (FADE_OUT + 1.5) * 1000)
  }

  private createSession(id: ThemeId, bus: AudioNode): Session {
    const theme = musicThemes[id]
    const style = rhythmStyles[theme.style]
    const out = this.ctx.createGain()
    out.gain.value = 0.9
    out.connect(bus)
    const leadByStep = new Map<number, LeadNote>()
    for (const note of theme.lead) leadByStep.set(note[0], note)
    const session: Session = {
      id,
      theme,
      style,
      out,
      leadByStep,
      sequencer: new StepSequencer(
        (step, time) => this.scheduleStep(session, step, time),
        () => stepSeconds(theme.tempo, this.tempoScale),
      ),
    }
    return session
  }

  private scheduleStep(session: Session, step: number, time: number): void {
    const { theme, style } = session
    const perBar = style.stepsPerBar
    const stepLength = stepSeconds(theme.tempo, this.tempoScale)
    const bar = Math.floor(step / perBar)
    const inBar = step % perBar
    const chord = theme.chords[bar % theme.chords.length] ?? 0

    const kick = style.kick[inBar] ?? 0
    if (kick > 0) this.kick(session.out, time, kick)
    const snare = style.snare[inBar] ?? 0
    if (snare > 0) this.snare(session.out, time, snare)
    const hat = style.hat[inBar] ?? 0
    if (hat > 0) this.hat(session.out, time, hat)
    const perc = style.perc[inBar] ?? 0
    if (perc > 0) this.perc(session.out, time, perc)

    const bassOffset = style.bass[inBar]
    if (bassOffset !== null && bassOffset !== undefined) {
      const midi = degreeToMidi(theme.root - 12, theme.scale, chord + bassOffset)
      this.note(session.out, 'triangle', midi, time, stepLength * 2.2, 0.32, 500)
    }
    const stab = style.stab[inBar] ?? 0
    if (stab > 0) {
      for (const offset of TRIAD) {
        const midi = degreeToMidi(theme.root, theme.scale, chord + offset)
        this.note(session.out, 'square', midi, time, stepLength * 1.4, 0.035 * stab, 1500)
      }
    }
    const motifStep = step % (theme.leadBars * perBar)
    const lead = session.leadByStep.get(motifStep)
    if (lead) {
      const midi = degreeToMidi(theme.root + 12, theme.scale, lead[1])
      this.note(session.out, theme.leadWave, midi, time, lead[2] * stepLength * 0.95, 0.11, 3200)
    }
  }

  /** A pitched note with a short attack and a decay to silence over `dur`. */
  private note(
    out: AudioNode,
    wave: OscillatorType,
    midi: number,
    time: number,
    dur: number,
    gain: number,
    cutoff: number,
  ): void {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.type = wave
    osc.frequency.value = midiToFrequency(midi)
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    const env = ctx.createGain()
    env.gain.setValueAtTime(SILENCE, time)
    env.gain.linearRampToValueAtTime(gain, time + 0.012)
    env.gain.exponentialRampToValueAtTime(SILENCE, time + dur)
    osc.connect(filter).connect(env).connect(out)
    osc.start(time)
    osc.stop(time + dur + 0.02)
    osc.onended = () => env.disconnect()
  }

  private noiseBurst(
    out: AudioNode,
    type: BiquadFilterType,
    freq: number,
    time: number,
    dur: number,
    gain: number,
  ): void {
    const ctx = this.ctx
    const source = ctx.createBufferSource()
    source.buffer = this.noise
    const filter = ctx.createBiquadFilter()
    filter.type = type
    filter.frequency.value = freq
    const env = ctx.createGain()
    env.gain.setValueAtTime(gain, time)
    env.gain.exponentialRampToValueAtTime(SILENCE, time + dur)
    source.connect(filter).connect(env).connect(out)
    source.start(time, Math.random())
    source.stop(time + dur + 0.02)
    source.onended = () => env.disconnect()
  }

  private kick(out: AudioNode, time: number, velocity: number): void {
    const ctx = this.ctx
    const osc = ctx.createOscillator()
    osc.frequency.setValueAtTime(150, time)
    osc.frequency.exponentialRampToValueAtTime(45, time + 0.12)
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.55 * velocity, time)
    env.gain.exponentialRampToValueAtTime(SILENCE, time + 0.2)
    osc.connect(env).connect(out)
    osc.start(time)
    osc.stop(time + 0.22)
    osc.onended = () => env.disconnect()
  }

  private snare(out: AudioNode, time: number, velocity: number): void {
    this.noiseBurst(out, 'bandpass', 1900, time, 0.13, 0.22 * velocity)
    this.note(out, 'triangle', 55, time, 0.08, 0.12 * velocity, 1200)
  }

  private hat(out: AudioNode, time: number, velocity: number): void {
    this.noiseBurst(out, 'highpass', 7000, time, 0.04, 0.07 * velocity)
  }

  private perc(out: AudioNode, time: number, velocity: number): void {
    this.noiseBurst(out, 'bandpass', 2600, time, 0.05, 0.12 * velocity)
    this.note(out, 'sine', 84, time, 0.06, 0.1 * velocity, 4000)
  }
}
