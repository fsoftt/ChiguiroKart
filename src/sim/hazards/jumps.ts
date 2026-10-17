import { defaultJumps, type JumpsConfig } from '../../config/jumps'
import type { KartState } from '../kart/kartState'
import { forwardOf, rightOf } from '../math'
import type { Jump, Track } from '../track'

/** A kart must move along the jump at least this fast (m/s) to be launched. */
export const MIN_LAUNCH_SPEED = 5

/**
 * A kart hopping this close above the ramp still counts as on it: hopping just before the lip
 * launches it too (and is a trick), instead of floating over the ramp.
 */
const MAX_HOP_CLEARANCE = 0.6

/** True if the position is in the lip zone: `length` m before the edge, across the road. */
export function insideLip(jump: Jump, x: number, z: number): boolean {
  const dx = x - jump.position.x
  const dz = z - jump.position.z
  const forward = forwardOf(jump.heading)
  const right = rightOf(jump.heading)
  const along = dx * forward.x + dz * forward.z
  return (
    along <= 0 && along >= -jump.length && Math.abs(dx * right.x + dz * right.z) <= jump.halfWidth
  )
}

/**
 * Throws a grounded (or low hopping) kart up if it is in a lip zone and moving forward along the jump (not
 * backwards, not crawling), and records the launch in `kart.ramp`. Pressing jump (a fresh press)
 * in the lip zone or within `trickWindow` seconds after leaving it makes the jump a trick: a bit
 * more height, and the landing gives the nitro. Without the hop the ramp gives no nitro.
 * Call it every step, before `stepKart`, with this step's jump button. Returns true on a launch.
 */
export function applyJumps(
  kart: KartState,
  track: Track,
  jumpHeld: boolean,
  dt: number,
  config: JumpsConfig = defaultJumps,
): boolean {
  const pressed = jumpHeld && !kart.jumpHeld
  const ramp = kart.ramp
  if (ramp.active) {
    ramp.age += dt
    if (pressed && !ramp.tricked && ramp.age <= config.trickWindow) trick(kart, config)
    return false
  }
  const hopping =
    !kart.onGround &&
    kart.position.y - track.groundHeight(kart.position.x, kart.position.z) <= MAX_HOP_CLEARANCE
  if (!kart.onGround && !hopping) return false
  for (const jump of track.jumps) {
    if (!insideLip(jump, kart.position.x, kart.position.z)) continue
    const forward = forwardOf(jump.heading)
    const speed = kart.velocity.x * forward.x + kart.velocity.z * forward.z
    if (speed <= MIN_LAUNCH_SPEED) continue
    kart.velocity.y = Math.max(kart.velocity.y, jump.launchSpeed)
    kart.ramp = { active: true, age: 0, tricked: false }
    if (pressed || hopping) trick(kart, config)
    return true
  }
  return false
}

function trick(kart: KartState, config: JumpsConfig): void {
  kart.ramp.tricked = true
  kart.velocity.y += config.trickBoost
}
