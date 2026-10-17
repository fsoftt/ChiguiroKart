/** Continuous sounds that run while racing: the engine and the drift squeal. */
import { driftSound, engineTuning } from '../config/audio'
import { lerp } from '../sim/math'
import type { EngineTarget } from './audioMath'
import type { AudioEngine } from './audioEngine'
import { createNoiseBuffer } from './sfxPlayer'

/** Two detuned oscillators (saw and square) through a lowpass that follows the speed. */
export class EngineSound {
  private readonly saw: OscillatorNode
  private readonly square: OscillatorNode
  private readonly sawGain: GainNode
  private readonly squareGain: GainNode
  private readonly filter: BiquadFilterNode
  private readonly output: GainNode

  constructor(
    private readonly ctx: AudioContext,
    engine: AudioEngine,
  ) {
    this.saw = ctx.createOscillator()
    this.saw.type = 'sawtooth'
    this.square = ctx.createOscillator()
    this.square.type = 'square'
    this.square.detune.value = 9
    this.sawGain = ctx.createGain()
    this.squareGain = ctx.createGain()
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'lowpass'
    this.filter.Q.value = 2.5
    this.output = ctx.createGain()
    this.output.gain.value = 0
    this.saw.connect(this.sawGain).connect(this.filter)
    this.square.connect(this.squareGain).connect(this.filter)
    this.filter.connect(this.output)
    if (engine.sfx) this.output.connect(engine.sfx)
    this.saw.start()
    this.square.start()
  }

  update(target: EngineTarget): void {
    const now = this.ctx.currentTime
    const tc = engineTuning.smoothing
    this.saw.frequency.setTargetAtTime(target.frequency, now, tc)
    this.square.frequency.setTargetAtTime(target.frequency * 0.5, now, tc)
    this.filter.frequency.setTargetAtTime(target.cutoff, now, tc)
    this.sawGain.gain.setTargetAtTime(1 - target.squareMix, now, tc)
    this.squareGain.gain.setTargetAtTime(target.squareMix * 0.6, now, tc)
    this.output.gain.setTargetAtTime(target.gain, now, tc * 2)
  }

  /** Silences the engine (menu). */
  mute(): void {
    this.output.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05)
  }
}

/** Looped filtered noise whose pitch rises with the drift charge. */
export class DriftSound {
  private readonly filter: BiquadFilterNode
  private readonly output: GainNode

  constructor(
    private readonly ctx: AudioContext,
    engine: AudioEngine,
  ) {
    const source = ctx.createBufferSource()
    source.buffer = createNoiseBuffer(ctx)
    source.loop = true
    this.filter = ctx.createBiquadFilter()
    this.filter.type = 'bandpass'
    this.filter.Q.value = 3
    this.output = ctx.createGain()
    this.output.gain.value = 0
    source.connect(this.filter).connect(this.output)
    if (engine.sfx) this.output.connect(engine.sfx)
    source.start()
  }

  /** `charge` is the drift bar 0..1; `active` is true while sliding on the ground. */
  update(active: boolean, charge: number, speedRatio: number): void {
    const now = this.ctx.currentTime
    const speedPart = Math.min(Math.abs(speedRatio) / driftSound.minSpeedRatio, 1)
    const gain = active ? driftSound.gain * speedPart : 0
    this.output.gain.setTargetAtTime(gain, now, 0.04)
    this.filter.frequency.setTargetAtTime(
      lerp(driftSound.minFrequency, driftSound.maxFrequency, Math.min(Math.max(charge, 0), 1)),
      now,
      0.05,
    )
  }
}
