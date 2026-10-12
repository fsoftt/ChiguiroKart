/** Exponentially decays a kick value toward zero. */
export function decayKick(kick: number, rate: number, dt: number): number {
  return kick * Math.exp(-rate * dt)
}

/** Time-limited camera shake whose strength fades linearly to zero. */
export interface ShakeState {
  /** Peak offset (m) at the start of the current shake. */
  intensity: number
  remaining: number
  duration: number
}

export function createShake(): ShakeState {
  return { intensity: 0, remaining: 0, duration: 1 }
}

/** Current strength (m). */
export function shakeAmplitude(shake: ShakeState): number {
  return shake.remaining > 0 ? shake.intensity * (shake.remaining / shake.duration) : 0
}

/** Starts a shake. A weaker shake never replaces a stronger one that is still running. */
export function startShake(shake: ShakeState, intensity: number, seconds: number): void {
  if (seconds <= 0 || intensity < shakeAmplitude(shake)) return
  shake.intensity = intensity
  shake.remaining = seconds
  shake.duration = seconds
}

export function stepShake(shake: ShakeState, dt: number): void {
  shake.remaining = Math.max(0, shake.remaining - dt)
}

/** Horizontal and vertical shake offset (m) at `time`, using two out-of-phase oscillators. */
export function shakeOffset(
  shake: ShakeState,
  time: number,
  frequency: number,
  out: { x: number; y: number },
): void {
  const amplitude = shakeAmplitude(shake)
  const phase = time * frequency * 2 * Math.PI
  out.x = Math.sin(phase) * amplitude
  out.y = Math.cos(phase * 1.31 + 1.7) * amplitude
}
