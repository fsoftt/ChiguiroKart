/**
 * Pure transition detection for the race audio: compares the previous and the current frame
 * snapshot and says which one-off sounds to play. No Web Audio in here, so it is unit tested.
 */
import {
  BUMP_SPEED_DROP,
  FINAL_LAP_TEMPO,
  FULL_LANDING_AIR_TIME,
  MIN_LANDING_AIR_TIME,
  WIN_PLACE,
} from '../config/audio'
import { FALLBACK_THEME, type ThemeId } from '../config/music'
import type { TrackId } from '../config/tracks/catalog'
import { clamp } from '../sim/math'
import type { DriftDirection, NitroLevel } from '../sim/kart/driftState'
import type { RacePhase } from '../sim/race/raceState'
import { detectChainBreak, detectNitroStart } from '../render/effects/effectsLogic'

/** What the audio needs to know about the player each frame. */
export interface AudioFrame {
  /** False while the menu is up. */
  racing: boolean
  phase: RacePhase
  /** Seconds left of the countdown. */
  countdown: number
  currentLap: number
  totalLaps: number
  /** Laps completed so far. */
  lapsDone: number
  /** Player's place, 1 = first. */
  rank: number
  onGround: boolean
  /** Seconds in the air in the current jump. */
  airTime: number
  /** Forward speed over top speed (negative when reversing). */
  speedRatio: number
  throttle: number
  driftDirection: DriftDirection
  driftCharge: number
  chainBroken: boolean
  boostLevel: NitroLevel
  boostTimeLeft: number
}

export type AudioCue =
  | { type: 'countdown'; count: number }
  | { type: 'go' }
  | { type: 'lap' }
  | { type: 'finalLap' }
  | { type: 'finish'; win: boolean }
  | { type: 'nitro'; level: 1 | 2 | 3 }
  | { type: 'chainBreak' }
  | { type: 'jump' }
  | { type: 'landing'; strength: number }
  | { type: 'bump'; strength: number }

/** One-off sounds caused by the change from `previous` to `current`. */
export function detectCues(previous: AudioFrame | null, current: AudioFrame): AudioCue[] {
  const cues: AudioCue[] = []
  if (!current.racing) return cues

  // Countdown beeps: on entering the countdown, then each time the whole second drops
  if (current.phase === 'countdown') {
    const count = Math.ceil(current.countdown)
    const fresh =
      !previous ||
      !previous.racing ||
      previous.phase !== 'countdown' ||
      current.countdown > previous.countdown
    const dropped = previous !== null && count < Math.ceil(previous.countdown)
    if ((fresh || dropped) && count >= 1) cues.push({ type: 'countdown', count })
    return cues
  }
  if (!previous || !previous.racing) return cues
  if (previous.phase === 'countdown') {
    if (current.phase === 'racing') cues.push({ type: 'go' })
    return cues
  }

  if (previous.phase === 'racing' && current.phase === 'finished') {
    cues.push({ type: 'finish', win: current.rank <= WIN_PLACE })
    return cues
  }
  if (previous.phase !== 'racing' || current.phase !== 'racing') return cues

  if (current.lapsDone > previous.lapsDone) {
    const finalLap =
      current.currentLap >= current.totalLaps && previous.currentLap < current.totalLaps
    cues.push({ type: finalLap ? 'finalLap' : 'lap' })
  }
  const nitro = detectNitroStart(
    { level: previous.boostLevel, timeLeft: previous.boostTimeLeft },
    { level: current.boostLevel, timeLeft: current.boostTimeLeft },
  )
  if (nitro !== 0) cues.push({ type: 'nitro', level: nitro })
  if (
    detectChainBreak({ chainBroken: previous.chainBroken }, { chainBroken: current.chainBroken })
  ) {
    cues.push({ type: 'chainBreak' })
  }
  if (previous.onGround && !current.onGround) cues.push({ type: 'jump' })
  if (!previous.onGround && current.onGround && previous.airTime >= MIN_LANDING_AIR_TIME) {
    cues.push({
      type: 'landing',
      strength: clamp(previous.airTime / FULL_LANDING_AIR_TIME, 0.3, 1),
    })
  }
  const drop = previous.speedRatio - current.speedRatio
  if (previous.onGround && current.onGround && drop > BUMP_SPEED_DROP) {
    cues.push({ type: 'bump', strength: clamp(drop / (BUMP_SPEED_DROP * 3), 0.4, 1) })
  }
  return cues
}

/** Which music should be playing: the menu theme, silence, or the track's theme. */
export function desiredMusic(
  frame: AudioFrame,
  trackId: TrackId | null,
): { theme: ThemeId | null; tempoScale: number } {
  if (!frame.racing) return { theme: 'menu', tempoScale: 1 }
  if (frame.phase !== 'racing') return { theme: null, tempoScale: 1 }
  const finalLap = frame.currentLap >= frame.totalLaps && frame.totalLaps > 1
  return { theme: trackId ?? FALLBACK_THEME, tempoScale: finalLap ? FINAL_LAP_TEMPO : 1 }
}

/** Drift squeal runs while sliding on the ground. */
export function isDriftSqueal(frame: AudioFrame): boolean {
  return frame.racing && frame.phase === 'racing' && frame.driftDirection !== 0 && frame.onGround
}
