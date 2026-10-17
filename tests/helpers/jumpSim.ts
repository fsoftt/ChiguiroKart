import { defaultDrift } from '../../src/config/drift'
import { defaultKartPhysics } from '../../src/config/kartPhysics'
import { NEUTRAL_INPUT, type KartInput } from '../../src/input/kartInput'
import { applyJumps, insideLip } from '../../src/sim/hazards/jumps'
import { stepKart } from '../../src/sim/kart/kartPhysics'
import { createKartState } from '../../src/sim/kart/kartState'
import { resolveTrackCollision } from '../../src/sim/kart/trackCollision'
import { forwardOf } from '../../src/sim/math'
import type { Jump, Track } from '../../src/sim/track'

const DT = 1 / 60
/** Respawn height of the fall rule. */
export const FALL_HEIGHT = -5

export interface JumpRun {
  /** Went below the fall respawn height. */
  fell: boolean
  minY: number
  /** Highest vertical speed seen (m/s). */
  peakVy: number
  /** Airborne seconds of the first jump. */
  airTime: number
  /** Boost level when it first touched the ground again after the jump. */
  landingBoostLevel: number
  landed: boolean
  /** Distance along the heading between the lip edge and where it came down (m). */
  landedPast: number
}

/** When the jump button is pressed: never, on entering the lip zone, or N seconds after launch. */
export type Hop = 'none' | 'lip' | number

/**
 * Drives a kart straight along the jump heading at a constant speed, starting `leadIn` metres
 * before the lip edge, with the real physics, jump launch and wall collision.
 */
export function runJump(
  track: Track,
  jump: Jump,
  speed: number,
  leadIn = 8,
  hop: Hop = 'none',
): JumpRun {
  const forward = forwardOf(jump.heading)
  const x = jump.position.x - forward.x * leadIn
  const z = jump.position.z - forward.z * leadIn
  const kart = createKartState({ x, y: track.groundHeight(x, z), z }, jump.heading)
  const run: JumpRun = {
    fell: false,
    minY: kart.position.y,
    peakVy: 0,
    airTime: 0,
    landingBoostLevel: 0,
    landed: false,
    landedPast: 0,
  }
  let launched = false
  let airSteps = 0
  let wasInLip = false
  const ground = (px: number, pz: number): number => track.groundHeight(px, pz)
  for (let step = 0; step < 60 * 6; step++) {
    if (kart.onGround) {
      kart.velocity.x = forward.x * speed
      kart.velocity.z = forward.z * speed
    }
    const inLip = kart.onGround && insideLip(jump, kart.position.x, kart.position.z)
    let press = hop === 'lip' && inLip && !wasInLip
    wasInLip = inLip
    if (typeof hop === 'number' && launched) press = airSteps === Math.round(hop / DT)
    if (launched) airSteps++
    const input: KartInput = { ...NEUTRAL_INPUT, jump: press }
    applyJumps(kart, track, press, DT)
    const wasAirborne = !kart.onGround
    stepKart(kart, input, defaultKartPhysics, defaultDrift, ground, DT)
    resolveTrackCollision(kart, track, defaultKartPhysics, DT)
    run.minY = Math.min(run.minY, kart.position.y)
    run.peakVy = Math.max(run.peakVy, kart.velocity.y)
    if (!kart.onGround) launched = true
    if (kart.position.y < FALL_HEIGHT) {
      run.fell = true
      break
    }
    if (launched && kart.onGround && wasAirborne && !run.landed) {
      run.landed = true
      run.landingBoostLevel = kart.boost.level
      run.landedPast =
        (kart.position.x - jump.position.x) * forward.x +
        (kart.position.z - jump.position.z) * forward.z
      break
    }
    if (!launched && step > 60 * 3) break
  }
  return run
}
