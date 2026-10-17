import type { Racer } from '../racer'
import type { Track } from '../track'

/**
 * The leader's current lap decides the tide: low on the lap numbers of the first tidal
 * branch's `lowLaps`, high otherwise. Does nothing on tracks without a tide.
 */
export function updateTide(track: Track, racers: readonly Racer[]): void {
  const rule = track.branches.find((branch) => branch.tide)?.tide
  if (!rule) return
  let lap = 1
  for (const racer of racers) {
    if (racer.race.state.phase === 'racing') lap = Math.max(lap, racer.race.state.currentLap)
  }
  track.setTideLow(rule.lowLaps.includes(lap))
}
