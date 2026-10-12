import type { CameraFeedbackConfig } from '../../config/effects'
import type { BoostState, DriftState } from '../../sim/kart/driftState'
import {
  decayKick,
  shakeOffset,
  startShake,
  stepShake,
  createShake,
  type ShakeState,
} from './cameraFeedback'
import { detectChainBreak, detectNitroStart } from './effectsLogic'

/** Mutable holder the chase camera reads once per frame. */
export interface CameraFeedback {
  fovKick: number
  shakeX: number
  shakeY: number
}

/**
 * Turns nitro starts and chain breaks into camera motion: a field-of-view kick per nitro level
 * that decays away, and a shake when the chain breaks. Keeps the previous kart state so it only
 * reacts on the frame the event happens.
 */
export class KartFeedback {
  private readonly feedback: CameraFeedback = { fovKick: 0, shakeX: 0, shakeY: 0 }
  private readonly shake: ShakeState = createShake()
  private readonly offset = { x: 0, y: 0 }
  private previousBoost: BoostState = { level: 0, timeLeft: 0, perfect: false }
  private previousDrift: DriftState = {
    direction: 0,
    charge: 0,
    nitrosInChain: 0,
    chainBroken: false,
    overchargeTime: 0,
  }

  constructor(private readonly config: CameraFeedbackConfig) {}

  /**
   * Advances the feedback and returns the value for this frame.
   * @param time total elapsed seconds, used as the shake oscillator phase
   */
  update(
    currentBoost: BoostState,
    currentDrift: DriftState,
    time: number,
    dt: number,
  ): CameraFeedback {
    const startedLevel = detectNitroStart(this.previousBoost, currentBoost)
    if (startedLevel > 0) {
      this.feedback.fovKick += this.config.fovKick[startedLevel - 1] ?? 0
    }
    if (detectChainBreak(this.previousDrift, currentDrift)) {
      startShake(this.shake, this.config.breakShakeIntensity, this.config.breakShakeSeconds)
    }

    this.feedback.fovKick = decayKick(this.feedback.fovKick, this.config.fovKickDecay, dt)
    stepShake(this.shake, dt)
    shakeOffset(this.shake, time, this.config.shakeFrequency, this.offset)
    this.feedback.shakeX = this.offset.x
    this.feedback.shakeY = this.offset.y

    this.previousBoost = { ...currentBoost }
    this.previousDrift = { ...currentDrift }
    return this.feedback
  }
}
