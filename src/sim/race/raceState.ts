export type RacePhase = 'countdown' | 'racing' | 'finished'

export interface RaceState {
  phase: RacePhase
  /** Countdown time in seconds remaining until green light (e.g. 3.0 -> 0). */
  countdown: number
  /** Total laps required to finish the race (e.g. 3). */
  totalLaps: number
  /** Current lap number (1-indexed: 1, 2, 3). */
  currentLap: number
  /** Times in seconds for each completed lap. */
  lapTimes: number[]
  /** Elapsed time in seconds for the current in-progress lap. */
  currentLapTime: number
  /** Total elapsed racing time (excluding countdown). */
  totalRaceTime: number
  /** Best completed lap time in seconds, or null if no lap completed yet. */
  bestLapTime: number | null
  /** Index of the last passed checkpoint. */
  lastPassedCheckpoint: number
  /** Mandatory checkpoints passed in the current lap. */
  passedMandatoryCheckpoints: Set<number>
  /** Remaining duration of engine stall if player revved prematurely. */
  engineStallRemaining: number
  /** Whether start boost has already been evaluated/awarded. */
  startBoostEvaluated: boolean
  /** Whether player is driving in reverse direction relative to track. */
  wrongWay: boolean
}

export function createRaceState(totalLaps = 3): RaceState {
  return {
    phase: 'countdown',
    countdown: 3.0,
    totalLaps,
    currentLap: 1,
    lapTimes: [],
    currentLapTime: 0,
    totalRaceTime: 0,
    bestLapTime: null,
    lastPassedCheckpoint: 0,
    passedMandatoryCheckpoints: new Set<number>([0]),
    engineStallRemaining: 0,
    startBoostEvaluated: false,
    wrongWay: false,
  }
}
