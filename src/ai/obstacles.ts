import type { HazardObstacle } from '../sim/hazards/hazardTypes'
import type { Vec2 } from '../sim/math'
import type { TrackBranch } from '../sim/track'

function distanceToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x
  const abz = b.z - a.z
  const lengthSquared = abx * abx + abz * abz
  const t =
    lengthSquared === 0
      ? 0
      : Math.min(Math.max(((p.x - a.x) * abx + (p.z - a.z) * abz) / lengthSquared, 0), 1)
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t))
}

/** True if an active ice wall stands inside the branch corridor or at either of its ends. */
export function branchBlocked(branch: TrackBranch, obstacles: readonly HazardObstacle[]): boolean {
  const points = branch.points
  return obstacles.some((obstacle) => {
    if (!obstacle.active || obstacle.kind !== 'iceWall') return false
    const reach = branch.halfWidth + obstacle.radius
    const at = { x: obstacle.position.x, z: obstacle.position.z }
    for (let i = 0; i + 1 < points.length; i++) {
      const a = points[i]
      const b = points[i + 1]
      if (a && b && distanceToSegment(at, a, b) <= reach) return true
    }
    return false
  })
}
