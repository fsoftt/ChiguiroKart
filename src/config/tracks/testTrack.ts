import type { Vec2 } from '../../sim/math'
import type { TrackDefinition } from '../../sim/track'

const POINT_COUNT = 160
const BASE_RADIUS = 70

/**
 * Closed test loop with a mix of fast sweepers and tighter bends.
 * The radius wobbles around a circle so the curvature changes along the lap.
 */
function buildCenterline(): Vec2[] {
  return Array.from({ length: POINT_COUNT }, (_, i) => {
    const angle = (i / POINT_COUNT) * Math.PI * 2
    const radius = BASE_RADIUS + 18 * Math.sin(2 * angle) + 9 * Math.cos(3 * angle)
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius }
  })
}

export const testTrack: TrackDefinition = {
  name: 'Pista de prueba',
  centerline: buildCenterline(),
  halfWidth: 9,
}
