import type { TrackData } from '../../sim/trackData'
import { CONTROL_POINTS, SAMPLES_PER_SEGMENT, mudShortcut } from './cocoraTrack'

const COCORA_SAMPLES = CONTROL_POINTS.length * SAMPLES_PER_SEGMENT
const TEST_POINT_COUNT = 16
const TEST_BASE_RADIUS = 70

/**
 * Approximation of the Valle de Cocora as editable data. The code track also has a hand-made
 * wooden bridge box and exact checkpoint indices that data cannot express, so this is close
 * but not identical.
 */
export function cocoraPreset(): TrackData {
  return {
    version: 1,
    name: 'Valle de Cocora (editable)',
    halfWidth: 9,
    samplesPerSegment: SAMPLES_PER_SEGMENT,
    points: CONTROL_POINTS.map((p) => {
      const point: TrackData['points'][number] = { x: p.x, z: p.z, y: p.y }
      if (p.surface) point.surface = p.surface
      return point
    }),
    branches: [
      {
        name: mudShortcut.name,
        points: mudShortcut.points.map((p) => ({ x: p.x, z: p.z })),
        halfWidth: mudShortcut.halfWidth,
        surface: mudShortcut.surface,
      },
    ],
    checkpoints: { count: 7, optional: [3] },
    itemBoxRows: [20, 65, 120, 190].map((index) => ({ at: index / COCORA_SAMPLES, count: 4 })),
    uchuvaLines: [
      [5, 5, -4],
      [40, 5, 4],
      [80, 5, 0],
      [125, 4, 5],
      [175, 5, -3],
      [196, 4, 3],
    ].map(([start = 0, count = 1, offset = 0]) => ({ at: start / COCORA_SAMPLES, count, offset })),
  }
}

/** Flat wobbly loop, like the code test track. */
export function testPreset(): TrackData {
  return {
    version: 1,
    name: 'Pista de prueba (editable)',
    halfWidth: 9,
    samplesPerSegment: 10,
    points: Array.from({ length: TEST_POINT_COUNT }, (_, i) => {
      const angle = (i / TEST_POINT_COUNT) * Math.PI * 2
      const radius = TEST_BASE_RADIUS + 18 * Math.sin(2 * angle) + 9 * Math.cos(3 * angle)
      return {
        x: Math.round(Math.cos(angle) * radius * 10) / 10,
        z: Math.round(Math.sin(angle) * radius * 10) / 10,
        y: 0,
      }
    }),
    branches: [],
    checkpoints: { count: 8, optional: [] },
    itemBoxRows: [{ at: 0.125, count: 4 }],
    uchuvaLines: [{ at: 0.25, count: 5, offset: 0 }],
  }
}
