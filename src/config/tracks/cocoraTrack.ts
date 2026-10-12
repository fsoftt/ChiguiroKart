import type { Vec2 } from '../../sim/math'
import type { Checkpoint } from '../../sim/race/checkpoint'
import type { SurfaceType } from '../../sim/race/surface'
import type { TrackDefinition } from '../../sim/track'

interface ControlPoint {
  x: number
  z: number
  y: number
  surface?: SurfaceType
}

/** Key landmarks of the Valle de Cocora circuit. */
const CONTROL_POINTS: ControlPoint[] = [
  { x: 0, z: -100, y: 0.0 }, // 0: Start / finish line in the valley
  { x: 45, z: -110, y: 0.5 }, // 1: Valley straightaway
  { x: 95, z: -90, y: 1.8 }, // 2: Turn 1 entering Andean foothills
  { x: 125, z: -45, y: 3.5 }, // 3: Hill climb
  { x: 130, z: 15, y: 4.8 }, // 4: Mountain ridge approach
  { x: 105, z: 65, y: 5.0, surface: 'wood' }, // 5: Hanging wooden bridge entry
  { x: 60, z: 90, y: 4.5, surface: 'wood' }, // 6: Hanging wooden bridge exit
  { x: 20, z: 115, y: 3.5 }, // 7: Hairpin approach (before mud shortcut)
  { x: -35, z: 135, y: 2.8 }, // 8: Hairpin outer loop
  { x: -75, z: 95, y: 2.0 }, // 9: Hairpin exit (rejoins mud shortcut)
  { x: -65, z: 45, y: 2.6 }, // 10: Misty valley S-turn
  { x: -95, z: 10, y: 4.5 }, // 11: Wax palm crest jump ramp
  { x: -115, z: -40, y: 1.5 }, // 12: Jump landing downhill
  { x: -90, z: -80, y: 0.8 }, // 13: Valley sweeping curve
  { x: -50, z: -100, y: 0.2 }, // 14: Final turn to home straight
]

const SAMPLES_PER_SEGMENT = 14

/** Evaluates standard Catmull-Rom spline at parameter t in [0, 1]. */
function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  )
}

function buildCocoraCenterline(): { points: Vec2[]; heights: number[] } {
  const n = CONTROL_POINTS.length
  const points: Vec2[] = []
  const heights: number[] = []

  for (let i = 0; i < n; i++) {
    const cp0 = CONTROL_POINTS[(i - 1 + n) % n] ?? CONTROL_POINTS[0]
    const cp1 = CONTROL_POINTS[i] ?? CONTROL_POINTS[0]
    const cp2 = CONTROL_POINTS[(i + 1) % n] ?? CONTROL_POINTS[0]
    const cp3 = CONTROL_POINTS[(i + 2) % n] ?? CONTROL_POINTS[0]
    if (!cp0 || !cp1 || !cp2 || !cp3) continue

    for (let s = 0; s < SAMPLES_PER_SEGMENT; s++) {
      const t = s / SAMPLES_PER_SEGMENT
      points.push({
        x: catmullRom(cp0.x, cp1.x, cp2.x, cp3.x, t),
        z: catmullRom(cp0.z, cp1.z, cp2.z, cp3.z, t),
      })
      heights.push(catmullRom(cp0.y, cp1.y, cp2.y, cp3.y, t))
    }
  }

  return { points, heights }
}

const { points: centerlinePoints, heights: centerlineHeights } = buildCocoraCenterline()

/** Look up elevation at arbitrary x, z based on nearest centerline segment. */
function cocoraGroundHeight(x: number, z: number): number {
  let closestDistSq = Infinity
  let closestIndex = 0

  for (let i = 0; i < centerlinePoints.length; i++) {
    const pt = centerlinePoints[i]
    if (!pt) continue
    const dx = x - pt.x
    const dz = z - pt.z
    const dSq = dx * dx + dz * dz
    if (dSq < closestDistSq) {
      closestDistSq = dSq
      closestIndex = i
    }
  }

  return centerlineHeights[closestIndex] ?? 0
}

/** Mud shortcut polygon bounds around hairpin (from x: 20, z: 115 to x: -75, z: 95). */
function isInsideMudShortcut(x: number, z: number): boolean {
  // Bounding box of the mud trail that cuts across the hairpin
  return x >= -50 && x <= 10 && z >= 80 && z <= 125
}

function isInsideWoodenBridge(x: number, z: number): boolean {
  return x >= 55 && x <= 110 && z >= 60 && z <= 95
}

function cocoraSurfaceAt(x: number, z: number): SurfaceType {
  if (isInsideWoodenBridge(x, z)) {
    return 'wood'
  }
  if (isInsideMudShortcut(x, z)) {
    return 'mud'
  }
  // Offroad area
  let minDistSq = Infinity
  for (let i = 0; i < centerlinePoints.length; i += 4) {
    const pt = centerlinePoints[i]
    if (!pt) continue
    const dx = x - pt.x
    const dz = z - pt.z
    const dSq = dx * dx + dz * dz
    if (dSq < minDistSq) minDistSq = dSq
  }
  // Road half-width is 9m
  return minDistSq <= 9 * 9 ? 'asphalt' : 'grass'
}

function buildCocoraCheckpoints(): Checkpoint[] {
  // 7 mandatory checkpoints distributed at key sections of the loop
  const keyIndices = [0, 35, 75, 110, 140, 165, 190]
  const checkpoints: Checkpoint[] = []

  keyIndices.forEach((ptIndex, id) => {
    const p = centerlinePoints[ptIndex]
    const next = centerlinePoints[(ptIndex + 1) % centerlinePoints.length]
    if (!p || !next) return

    const dx = next.x - p.x
    const dz = next.z - p.z
    const len = Math.hypot(dx, dz) || 1

    checkpoints.push({
      index: id,
      position: { x: p.x, z: p.z },
      forward: { x: dx / len, z: dz / len },
      width: 24, // wide enough to catch drifts and shortcut entries
      mandatory: true,
    })
  })

  return checkpoints
}

export const cocoraTrack: TrackDefinition = {
  name: 'Valle de Cocora',
  centerline: centerlinePoints,
  halfWidth: 9,
  groundHeight: cocoraGroundHeight,
  surfaceAt: cocoraSurfaceAt,
  checkpoints: buildCocoraCheckpoints(),
}
