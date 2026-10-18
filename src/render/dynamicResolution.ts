/** Frame time above which the picture is too heavy for 30 FPS (ms). */
export const SLOW_FRAME_MS = 33
/** Frame time under which there is room to render sharper again (ms). */
export const FAST_FRAME_MS = 22
/** Lowest pixel ratio the controller goes to. */
export const MIN_PIXEL_RATIO = 0.75
/** How much each step changes the pixel ratio. */
export const PIXEL_RATIO_STEP = 0.25
/** Seconds the average has to stay slow before the ratio drops, and fast before it rises. */
export const SLOW_SECONDS = 3
export const FAST_SECONDS = 6
/** Frames after a change are not measured (the canvas is reallocated), in seconds. */
export const SETTLE_SECONDS = 1
/** A longer frame is a paused or hidden tab, not a slow picture. */
const MAX_FRAME_SECONDS = 0.5
/** Each failed attempt to go sharper doubles the wait for the next one, up to this (s). */
const MAX_FAST_SECONDS = 60

/**
 * Keeps the frame rate by trading resolution. Feed it every frame's duration; it returns the
 * pixel ratio to use when that changes. It lowers the ratio stepwise when frames stay over
 * `SLOW_FRAME_MS` and raises it back (up to the quality preset's ratio, `ceiling`) when they
 * stay under `FAST_FRAME_MS`. It never goes below `MIN_PIXEL_RATIO`, nor above the ceiling,
 * so the player's quality choice is only ever adjusted downwards within that preset.
 */
export class DynamicResolution {
  private ceilingRatio: number
  private ratio: number
  private slowTime = 0
  private fastTime = 0
  private settle = 0
  /** Seconds of headroom needed before a raise; grows when a raise did not hold. */
  private raiseAfter = FAST_SECONDS
  private lastMove: 'up' | 'down' | null = null
  /** Exponentially smoothed frame time in ms (0 = no data yet). */
  private average = 0

  constructor(ceiling: number) {
    this.ceilingRatio = Math.max(MIN_PIXEL_RATIO, ceiling)
    this.ratio = this.ceilingRatio
  }

  /** The pixel ratio the controller wants now. */
  get pixelRatio(): number {
    return this.ratio
  }

  /** The ratio the preset allows (device ratio capped by the quality). */
  get ceiling(): number {
    return this.ceilingRatio
  }

  /** New preset or device: starts again from its full ratio. */
  setCeiling(ceiling: number): void {
    this.ceilingRatio = Math.max(MIN_PIXEL_RATIO, ceiling)
    this.ratio = this.ceilingRatio
    this.raiseAfter = FAST_SECONDS
    this.lastMove = null
    this.reset()
  }

  /** Forgets the measurements (after a pause, a track change or a ratio change). */
  reset(): void {
    this.slowTime = 0
    this.fastTime = 0
    this.average = 0
    this.settle = SETTLE_SECONDS
  }

  /**
   * One frame lasting `seconds`. Returns the new pixel ratio if it changed, otherwise null.
   */
  update(seconds: number): number | null {
    if (!(seconds > 0) || seconds > MAX_FRAME_SECONDS) {
      // Paused, hidden or the first frame after loading: not a measure of the picture
      this.slowTime = 0
      this.fastTime = 0
      this.average = 0
      return null
    }
    if (this.settle > 0) {
      this.settle -= seconds
      return null
    }
    const ms = seconds * 1000
    this.average = this.average === 0 ? ms : this.average + (ms - this.average) * 0.1
    if (this.average > SLOW_FRAME_MS) {
      this.slowTime += seconds
      this.fastTime = 0
    } else if (this.average < FAST_FRAME_MS) {
      this.fastTime += seconds
      this.slowTime = 0
    } else {
      this.slowTime = 0
      this.fastTime = 0
    }
    if (this.slowTime >= SLOW_SECONDS && this.ratio > MIN_PIXEL_RATIO) {
      return this.change(Math.max(MIN_PIXEL_RATIO, this.ratio - PIXEL_RATIO_STEP))
    }
    if (this.fastTime >= this.raiseAfter && this.ratio < this.ceilingRatio) {
      return this.change(Math.min(this.ceilingRatio, this.ratio + PIXEL_RATIO_STEP))
    }
    return null
  }

  private change(next: number): number {
    const move = next < this.ratio ? 'down' : 'up'
    // Going back down right after going up: that sharpness was too much, wait longer next time
    if (move === 'down' && this.lastMove === 'up') {
      this.raiseAfter = Math.min(this.raiseAfter * 2, MAX_FAST_SECONDS)
    }
    this.lastMove = move
    this.ratio = next
    this.reset()
    return next
  }
}
