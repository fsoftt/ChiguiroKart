/** Facts that decide whether the race can be paused right now. */
export interface PauseContext {
  racing: boolean
  /** The race phase of the player: not paused at the results. */
  finished: boolean
  /** The cup standings are on screen. */
  locked: boolean
}

export function canPause(context: PauseContext): boolean {
  return context.racing && !context.finished && !context.locked
}

/** Pause state of a race. While paused the simulation clock gets no time at all. */
export class PauseState {
  private paused = false

  get isPaused(): boolean {
    return this.paused
  }

  /** Pauses if allowed; returns whether the game is paused afterwards. */
  pause(context: PauseContext): boolean {
    if (canPause(context)) this.paused = true
    return this.paused
  }

  resume(): void {
    this.paused = false
  }

  /** Seconds the simulation and the timers may advance for a frame of `dt` seconds. */
  frameSeconds(dt: number): number {
    return this.paused ? 0 : dt
  }
}

/** Standard-mapping index of the gamepad Start button. */
export const GAMEPAD_START_BUTTON = 9

/** True only on the frame a button goes from released to pressed. */
export function risingEdge(previous: boolean, current: boolean): boolean {
  return current && !previous
}
