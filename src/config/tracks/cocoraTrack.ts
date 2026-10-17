import type { Vec2 } from '../../sim/math'
import type { Checkpoint } from '../../sim/race/checkpoint'
import type { SurfaceType } from '../../sim/race/surface'
import { lineAlong, rowAcross } from './pickupLayout'
import { Track, type TrackBranch, type TrackDefinition } from '../../sim/track'
import { buildCenterline, createGroundHeight, type ControlPoint } from '../../sim/trackSpline'

/** Key landmarks of the Valle de Cocora circuit. */
export const CONTROL_POINTS: ControlPoint[] = [
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

export const SAMPLES_PER_SEGMENT = 14

const { points: centerlinePoints, heights: centerlineHeights } = buildCenterline(
  CONTROL_POINTS,
  SAMPLES_PER_SEGMENT,
)

const ROAD_HALF_WIDTH = 9
const BRANCH_START_INDEX = 96
const BRANCH_END_INDEX = 134

function centerlinePoint(index: number): Vec2 {
  const point = centerlinePoints[index]
  if (!point) throw new Error(`Missing Cocora centerline point ${index}`)
  return point
}

/** Mud trail that cuts across the inside of the hairpin, leaving and rejoining the road. */
export const mudShortcut: TrackBranch = {
  name: 'Trocha de barro',
  points: [
    centerlinePoint(BRANCH_START_INDEX),
    { x: 16, z: 112 },
    { x: 0, z: 107.5 },
    { x: -22, z: 100 },
    { x: -42, z: 94 },
    { x: -58, z: 87 },
    { x: -65, z: 80 },
    centerlinePoint(BRANCH_END_INDEX),
  ],
  halfWidth: 6,
  surface: 'mud',
}

/** Geometry-only track used by the surface and height lookups below. */
const shape = new Track({
  name: 'Valle de Cocora',
  centerline: centerlinePoints,
  halfWidth: ROAD_HALF_WIDTH,
  branches: [mudShortcut],
})

const cocoraGroundHeight = createGroundHeight(shape, centerlinePoints, centerlineHeights)

function isInsideWoodenBridge(x: number, z: number): boolean {
  return x >= 55 && x <= 110 && z >= 60 && z <= 95
}

function cocoraSurfaceAt(x: number, z: number): SurfaceType {
  if (isInsideWoodenBridge(x, z)) {
    return 'wood'
  }
  // Mud comes from the shortcut corridor; the rest is asphalt road or grass
  return shape.surfaceAt(x, z)
}

const HAIRPIN_APEX_INDEX = 110

function buildCocoraCheckpoints(): Checkpoint[] {
  // 7 checkpoints at key sections of the loop; the hairpin apex (110) is optional
  // because the mud shortcut legally skips it
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
      mandatory: ptIndex !== HAIRPIN_APEX_INDEX,
    })
  })

  return checkpoints
}

/** Rows of power boxes across the road: valley, bridge approach, hairpin and home straight. */
const BOX_ROW_INDICES = [20, 65, 120, 190]
const BOX_OFFSETS = [-6, -2, 2, 6]

function buildItemBoxes(): Vec2[] {
  return BOX_ROW_INDICES.flatMap((index) => rowAcross(centerlinePoints, index, BOX_OFFSETS))
}

/** Uchuva lines (start index, count, lateral offset); none on the jump ramp (indices 140-170). */
const UCHUVA_LINES: readonly (readonly [number, number, number])[] = [
  [5, 5, -4],
  [40, 5, 4],
  [80, 5, 0],
  [125, 4, 5],
  [175, 5, -3],
  [196, 4, 3],
]

function buildUchuvas(): Vec2[] {
  return UCHUVA_LINES.flatMap(([start, count, offset]) =>
    lineAlong(centerlinePoints, start, count, offset),
  )
}

export const cocoraTrack: TrackDefinition = {
  name: 'Valle de Cocora',
  centerline: centerlinePoints,
  halfWidth: ROAD_HALF_WIDTH,
  branches: [mudShortcut],
  groundHeight: cocoraGroundHeight,
  surfaceAt: cocoraSurfaceAt,
  checkpoints: buildCocoraCheckpoints(),
  itemBoxes: buildItemBoxes(),
  uchuvas: buildUchuvas(),
}
