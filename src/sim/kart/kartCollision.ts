import type { KartPhysicsConfig } from '../../config/kartPhysics'
import type { KartState } from './kartState'

/**
 * Kart-vs-kart collisions. Karts are equal-mass circles in the XZ plane.
 * For every overlapping pair it:
 * - pushes both apart equally along the contact normal,
 * - if they are approaching, applies an equal-mass impulse along the normal to the velocities
 *   (restitution `kartRestitution`), the same way `resolveTrackCollision` bounces off walls.
 * Pairs whose vertical gap exceeds `kartHeight` are skipped (one kart jumping over another).
 * Returns true if any pair touched.
 */
export function resolveKartCollisions(karts: KartState[], physics: KartPhysicsConfig): boolean {
  const minDistance = physics.kartRadius * 2
  let touched = false

  for (let i = 0; i < karts.length; i++) {
    const a = karts[i]
    if (!a) continue
    for (let j = i + 1; j < karts.length; j++) {
      const b = karts[j]
      if (!b) continue
      if (Math.abs(a.position.y - b.position.y) > physics.kartHeight) continue

      const dx = b.position.x - a.position.x
      const dz = b.position.z - a.position.z
      const distSq = dx * dx + dz * dz
      if (distSq >= minDistance * minDistance) continue

      touched = true
      const distance = Math.sqrt(distSq)
      // Exactly coincident karts: pick an arbitrary but deterministic axis
      const nx = distance > 1e-6 ? dx / distance : 1
      const nz = distance > 1e-6 ? dz / distance : 0

      // Normal points from a to b; each kart moves half the overlap
      const push = (minDistance - distance) / 2
      a.position.x -= nx * push
      a.position.z -= nz * push
      b.position.x += nx * push
      b.position.z += nz * push

      const approach = (a.velocity.x - b.velocity.x) * nx + (a.velocity.z - b.velocity.z) * nz
      if (approach > 0) {
        // Equal masses: each kart receives half of (1 + e) times the approach speed
        const impulse = ((1 + physics.kartRestitution) * approach) / 2
        a.velocity.x -= nx * impulse
        a.velocity.z -= nz * impulse
        b.velocity.x += nx * impulse
        b.velocity.z += nz * impulse
      }
    }
  }
  return touched
}
