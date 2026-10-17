/** Tuning of ramp launches and the hop ("trick") that earns the landing nitro. */
export interface JumpsConfig {
  /** Seconds after leaving a lip during which a hop still counts as a trick. */
  trickWindow: number
  /** Extra vertical speed a trick adds to the launch (m/s). */
  trickBoost: number
}

export const defaultJumps: JumpsConfig = {
  trickWindow: 0.15,
  trickBoost: 2,
}
