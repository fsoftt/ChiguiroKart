import { MAX_VOICES, MAX_VOICES_PER_KEY } from '../config/audio'

interface Voice {
  key: string
  end: number
}

/**
 * Polyphony cap: decides whether a new sound may start, so a burst of events (an explosion
 * chain, many pickups) cannot pile up nodes. Pure bookkeeping, driven by the audio clock.
 */
export class VoiceLimiter {
  private voices: Voice[] = []

  constructor(
    private readonly maxVoices = MAX_VOICES,
    private readonly maxPerKey = MAX_VOICES_PER_KEY,
  ) {}

  /** Number of sounds still playing at `now`. */
  active(now: number): number {
    this.voices = this.voices.filter((voice) => voice.end > now)
    return this.voices.length
  }

  /** Books a sound of kind `key` lasting `duration` s; false (and no booking) if over the cap. */
  tryAcquire(key: string, now: number, duration: number): boolean {
    if (this.active(now) >= this.maxVoices) return false
    let same = 0
    for (const voice of this.voices) if (voice.key === key) same++
    if (same >= this.maxPerKey) return false
    this.voices.push({ key, end: now + duration })
    return true
  }

  clear(): void {
    this.voices = []
  }
}
