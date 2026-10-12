/** Rolling average of frames per second over a fixed number of frames. */
export class FpsMeter {
  private readonly frameTimes: number[] = []
  private total = 0

  constructor(private readonly windowSize = 60) {
    if (windowSize < 1) throw new RangeError('windowSize must be at least 1')
  }

  /** Records the duration of one frame, in seconds. */
  addFrame(deltaSeconds: number): void {
    if (deltaSeconds <= 0) return
    this.frameTimes.push(deltaSeconds)
    this.total += deltaSeconds
    if (this.frameTimes.length > this.windowSize) {
      this.total -= this.frameTimes.shift() ?? 0
    }
  }

  get fps(): number {
    return this.total > 0 ? this.frameTimes.length / this.total : 0
  }
}
