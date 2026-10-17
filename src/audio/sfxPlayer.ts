import type { AudioEngine } from './audioEngine'
import { recipeDuration, sfxRecipes, type SfxId, type SfxLayer } from './sfxRecipes'
import type { VoiceLimiter } from './voiceLimiter'

const SILENCE = 0.0001
/** Seconds of white noise in the shared buffer. */
const NOISE_SECONDS = 2

/** Two seconds of white noise, shared by every noise layer and the looped sounds. */
export function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * NOISE_SECONDS), ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  return buffer
}

export interface PlayOptions {
  /** Loudness multiplier (default 1). */
  gain?: number
  /** Frequency multiplier (default 1). */
  pitch?: number
  /** Seconds from now (default 0). */
  delay?: number
}

/** Plays recipe layers as one-shot oscillators and noise bursts, within the voice cap. */
export class SfxPlayer {
  private readonly noiseBuffer: AudioBuffer

  constructor(
    private readonly engine: AudioEngine,
    private readonly limiter: VoiceLimiter,
    private readonly ctx: AudioContext,
  ) {
    this.noiseBuffer = createNoiseBuffer(ctx)
  }

  play(id: SfxId, options: PlayOptions = {}): void {
    this.playLayers(id, sfxRecipes[id], options)
  }

  /** Plays an arbitrary list of layers; `key` groups sounds for the voice cap. */
  playLayers(key: string, layers: readonly SfxLayer[], options: PlayOptions = {}): void {
    const out = this.engine.sfx
    const gain = options.gain ?? 1
    if (!out || gain <= 0.001) return
    const start = this.ctx.currentTime + (options.delay ?? 0)
    if (
      !this.limiter.tryAcquire(
        key,
        this.ctx.currentTime,
        recipeDuration(layers) + (options.delay ?? 0),
      )
    ) {
      return
    }
    for (const layer of layers) this.renderLayer(out, layer, start, gain, options.pitch ?? 1)
  }

  private renderLayer(
    out: AudioNode,
    layer: SfxLayer,
    start: number,
    gain: number,
    pitch: number,
  ): void {
    const ctx = this.ctx
    const t0 = start + (layer.delay ?? 0)
    const t1 = t0 + layer.dur
    const envelope = ctx.createGain()
    const peak = layer.gain * gain
    envelope.gain.setValueAtTime(SILENCE, t0)
    envelope.gain.linearRampToValueAtTime(peak, t0 + Math.min(layer.attack ?? 0.005, layer.dur / 2))
    envelope.gain.exponentialRampToValueAtTime(SILENCE, t1)
    envelope.connect(out)

    let source: AudioScheduledSourceNode
    let tail: AudioNode
    if (layer.kind === 'tone') {
      const osc = ctx.createOscillator()
      osc.type = layer.wave
      osc.frequency.setValueAtTime(layer.f0 * pitch, t0)
      if (layer.f1 !== undefined) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(layer.f1 * pitch, 1), t1)
      }
      source = osc
      tail = osc
      if (layer.filter) {
        const filter = ctx.createBiquadFilter()
        filter.type = layer.filter.type
        filter.frequency.value = layer.filter.freq * pitch
        filter.Q.value = layer.filter.q ?? 1
        osc.connect(filter)
        tail = filter
      }
    } else {
      const buffer = ctx.createBufferSource()
      buffer.buffer = this.noiseBuffer
      const filter = ctx.createBiquadFilter()
      filter.type = layer.filter
      filter.Q.value = layer.q ?? 1
      filter.frequency.setValueAtTime(layer.f0 * pitch, t0)
      if (layer.f1 !== undefined) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(layer.f1 * pitch, 1), t1)
      }
      buffer.connect(filter)
      source = buffer
      tail = filter
      const maxOffset = Math.max(NOISE_SECONDS - layer.dur - 0.01, 0)
      buffer.start(t0, Math.random() * maxOffset)
    }
    tail.connect(envelope)
    if (layer.kind === 'tone') source.start(t0)
    source.stop(t1 + 0.05)
    source.onended = () => {
      envelope.disconnect()
    }
  }
}
