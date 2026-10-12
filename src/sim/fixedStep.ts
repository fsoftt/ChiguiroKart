/** Tolerance so accumulated float error does not drop a step. */
const EPSILON = 1e-9

/**
 * Runs a simulation at a fixed rate, independent of the render frame rate.
 * Frames longer than `maxFrameSeconds` are clamped to avoid a spiral of death.
 */
export class FixedStep {
  private accumulator = 0

  constructor(
    readonly stepSeconds: number,
    private readonly maxFrameSeconds = 0.25,
  ) {
    if (stepSeconds <= 0) throw new RangeError('stepSeconds must be positive')
  }

  /**
   * Calls `step` once per whole step that fits in the elapsed time.
   * Returns how far the leftover time is into the next step, in [0, 1).
   */
  advance(frameSeconds: number, step: (dt: number) => void): number {
    this.accumulator += clampFrame(frameSeconds, this.maxFrameSeconds)
    while (this.accumulator + EPSILON >= this.stepSeconds) {
      step(this.stepSeconds)
      this.accumulator = Math.max(0, this.accumulator - this.stepSeconds)
    }
    return this.accumulator / this.stepSeconds
  }
}

function clampFrame(frameSeconds: number, max: number): number {
  return Math.min(Math.max(frameSeconds, 0), max)
}
