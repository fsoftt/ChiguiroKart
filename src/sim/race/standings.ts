import type { Racer } from '../racer'

/**
 * Fraction (max 1) of the way from checkpoint k to k+1. Distances are measured along each
 * gate's forward direction, so a kart's lateral offset on the track does not skew it.
 */
function segmentFraction(racer: Racer): number {
  const { checkpoints, state } = racer.race
  const count = checkpoints.length
  const from = checkpoints[state.lastPassedCheckpoint]
  const to = checkpoints[(state.lastPassedCheckpoint + 1) % count]
  if (!from || !to) return 0
  const { x, z } = racer.kart.position
  const fromDist = (x - from.position.x) * from.forward.x + (z - from.position.z) * from.forward.z
  const toDist = (to.position.x - x) * to.forward.x + (to.position.z - z) * to.forward.z
  const span = fromDist + toDist
  if (span <= 0) return 0
  // Not clamped below: karts behind the checkpoint rank by how far back they are
  return Math.min(1, fromDist / span)
}

/**
 * Monotonic scalar of how far along the race a kart is:
 * `completedLaps * N + lastPassedCheckpoint + fraction along the next segment`.
 */
export function raceProgress(racer: Racer): number {
  const count = racer.race.checkpoints.length
  if (count === 0) return 0
  const { lapTimes, lastPassedCheckpoint } = racer.race.state
  return lapTimes.length * count + lastPassedCheckpoint + segmentFraction(racer)
}

function compareRacers(a: Racer, b: Racer): number {
  const aDone = a.race.state.phase === 'finished'
  const bDone = b.race.state.phase === 'finished'
  if (aDone !== bDone) return aDone ? -1 : 1
  if (aDone) {
    const byTime = a.race.state.totalRaceTime - b.race.state.totalRaceTime
    if (byTime !== 0) return byTime
  } else {
    const byProgress = raceProgress(b) - raceProgress(a)
    if (byProgress !== 0) return byProgress
  }
  return a.slot - b.slot
}

/** Racers sorted leader first; finished racers go first by time, the rest by progress. */
export function computeStandings(racers: readonly Racer[]): Racer[] {
  return [...racers].sort(compareRacers)
}

/** 1-based position of `racer` among `racers` (0 if it is not in the list). */
export function racePosition(racer: Racer, racers: readonly Racer[]): number {
  return computeStandings(racers).indexOf(racer) + 1
}
