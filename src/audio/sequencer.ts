/**
 * Lookahead step scheduler (the "tale of two clocks" pattern): a coarse timer calls `tick`
 * every ~25 ms and every step that starts within the next ~100 ms is handed to `schedule`
 * with its exact audio-clock time. No Web Audio here, so the timing math is testable.
 */

/** How far ahead (s) steps are scheduled, and how often (ms) `tick` should be called. */
export const SCHEDULE_AHEAD = 0.1
export const TICK_INTERVAL_MS = 25

export class StepSequencer {
  /** Index of the next step to schedule (counts up forever; patterns take it modulo). */
  nextStep = 0
  /** Audio-clock time (s) at which `nextStep` starts. */
  nextTime = 0

  constructor(
    /** Called once per step with its index and its start time. */
    private readonly schedule: (step: number, time: number) => void,
    /** Length (s) of the step that starts now; read every step so tempo changes follow. */
    private readonly stepLength: (step: number) => number,
    private readonly lookahead = SCHEDULE_AHEAD,
  ) {}

  /** Restarts the sequence at step 0 beginning at `time`. */
  start(time: number): void {
    this.nextStep = 0
    this.nextTime = time
  }

  /** Schedules every step that begins before `now + lookahead`. Returns how many. */
  tick(now: number): number {
    let count = 0
    // A long stall (hidden tab) must not flood the audio graph with stale steps
    if (this.nextTime < now - 0.5) this.nextTime = now
    while (this.nextTime < now + this.lookahead) {
      this.schedule(this.nextStep, this.nextTime)
      this.nextTime += this.stepLength(this.nextStep)
      this.nextStep++
      count++
    }
    return count
  }
}
