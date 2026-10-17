import type { Vec2 } from '../math'
import type { Racer } from '../racer'
import type { Track } from '../track'
import type { Pickup } from './itemTypes'

/** Pickups on the ground at the given spots, all active. */
export function createPickups(track: Track, spots: readonly Vec2[], lift: number): Pickup[] {
  return spots.map((spot) => ({
    position: { x: spot.x, y: track.groundHeight(spot.x, spot.z) + lift, z: spot.z },
    active: true,
    respawnTime: 0,
  }))
}

/** Counts down the pickups that are waiting to come back. */
export function tickRespawns(pickups: readonly Pickup[], dt: number): void {
  for (const pickup of pickups) {
    if (pickup.active) continue
    pickup.respawnTime = Math.max(0, pickup.respawnTime - dt)
    if (pickup.respawnTime === 0) pickup.active = true
  }
}

/** Active pickups the racer's kart is touching. */
export function pickupsTouching(
  pickups: readonly Pickup[],
  racer: Racer,
  radius: number,
  height: number,
): Pickup[] {
  const { x, y, z } = racer.kart.position
  return pickups.filter(
    (pickup) =>
      pickup.active &&
      Math.abs(pickup.position.y - y) <= height &&
      Math.hypot(pickup.position.x - x, pickup.position.z - z) <= radius,
  )
}

/** Takes a pickup out until it respawns. */
export function takePickup(pickup: Pickup, respawnTime: number): void {
  pickup.active = false
  pickup.respawnTime = respawnTime
}
