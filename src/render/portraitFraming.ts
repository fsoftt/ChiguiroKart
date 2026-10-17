import type { Vec3 } from '../sim/math'

/** Camera placement for a character portrait (head and shoulders, 3/4 front view). */
export interface PortraitFraming {
  position: Vec3
  target: Vec3
  fov: number
}

/** Distance from the head (m), vertical field of view (deg) and view angles for portraits. */
export const PORTRAIT = {
  distance: 1.9,
  fov: 32,
  /** Yaw from straight ahead of the kart (rad); positive looks at the driver's left side. */
  yaw: 0.55,
  /** Camera height above the head, as a share of the distance. */
  lift: 0.12,
  /** The look target sits this far below the head so the shoulders fit (m). */
  lookDrop: 0.12,
  size: 128,
} as const

/** Where to put the camera so a head at `head` fills a portrait, seen from the kart's front. */
export function portraitFraming(head: Vec3, heading = 0): PortraitFraming {
  const angle = heading + PORTRAIT.yaw
  const { distance, lift, lookDrop, fov } = PORTRAIT
  return {
    position: {
      x: head.x + Math.sin(angle) * distance,
      y: head.y + distance * lift,
      z: head.z + Math.cos(angle) * distance,
    },
    target: { x: head.x, y: head.y - lookDrop, z: head.z },
    fov,
  }
}
