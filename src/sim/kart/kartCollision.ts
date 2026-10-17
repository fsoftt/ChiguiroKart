import type { KartPhysicsConfig } from '../../config/kartPhysics'
import type { KartState } from './kartState'

/**
 * Kart-vs-kart collisions. Karts are circles in the XZ plane with a mass each (default 1).
 * For every overlapping pair it:
 * - pushes both apart along the contact normal, the lighter one moving more,
 * - if they are approaching, applies an impulse along the normal to the velocities
 *   (restitution `kartRestitution`), the same way `resolveTrackCollision` bounces off walls.
 * Pairs whose vertical gap exceeds `kartHeight` are skipped (one kart jumping over another).
 * Returns true if any pair touched.
 */
export function resolveKartCollisions(
  karts: KartState[],
  physics: KartPhysicsConfig,
  masses: readonly number[] = [],
): boolean {
  const minDistance = physics.kartRadius * 2
  let touched = false

  for (let i = 0; i < karts.length; i++) {
    const a = karts[i]
    if (!a) continue
    for (let j = i + 1; j < karts.length; j++) {
      const b = karts[j]
      if (!b) continue
      if (Math.abs(a.position.y - b.position.y) > physics.kartHeight) continue

      const massA = masses[i] ?? 1
      const massB = masses[j] ?? 1
      const dx = b.position.x - a.position.x
      const dz = b.position.z - a.position.z
      const distSq = dx * dx + dz * dz
      if (distSq >= minDistance * minDistance) continue

      touched = true
      const distance = Math.sqrt(distSq)
      // Exactly coincident karts: pick an arbitrary but deterministic axis
      const nx = distance > 1e-6 ? dx / distance : 1
      const nz = distance > 1e-6 ? dz / distance : 0

      // Normal points from a to b; the overlap is shared in inverse proportion to mass
      const overlap = minDistance - distance
      const pushA = (overlap * massB) / (massA + massB)
      const pushB = overlap - pushA
      a.position.x -= nx * pushA
      a.position.z -= nz * pushA
      b.position.x += nx * pushB
      b.position.z += nz * pushB

      const approach = (a.velocity.x - b.velocity.x) * nx + (a.velocity.z - b.velocity.z) * nz
      if (approach > 0) {
        // Impulse j = (1 + e) * approach / (1/ma + 1/mb); equal masses give half each
        const impulse = ((1 + physics.kartRestitution) * approach) / (1 / massA + 1 / massB)
        a.velocity.x -= (nx * impulse) / massA
        a.velocity.z -= (nz * impulse) / massA
        b.velocity.x += (nx * impulse) / massB
        b.velocity.z += (nz * impulse) / massB
      }
    }
  }
  return touched
}
