import type { TrackData, TrackPointData } from '../../sim/trackData'
import { buildCenterline } from '../../sim/trackSpline'
import type { TrackTheme } from './theme'

const SAMPLES_PER_SEGMENT = 14

/** Key landmarks of the Tairona terraces, clockwise from the jungle trail up to the top terrace. */
const POINTS: TrackPointData[] = [
  { x: -40, z: 105, y: 0.0 }, // 0: Start / finish line on the jungle trail
  { x: 20, z: 108, y: 0.0 }, // 1: Trail straight
  { x: 80, z: 100, y: 0.3 }, // 2: Stone bridge over the Buritaca river
  { x: 130, z: 72, y: 1.2 }, // 3: Cobbled path into the first terraces
  { x: 152, z: 30, y: 1.8 }, // 4: Foot of the ancient stairs (the stairs shortcut starts here)
  { x: 198, z: -10, y: 3.2 }, // 5: Long way round the retaining wall
  { x: 194, z: -62, y: 4.4 }, // 6: Terraza de los Tairona
  { x: 140, z: -95, y: 5.4 }, // 7: Top of the terrace wall
  { x: 105, z: -106, y: 5.6 }, // 8: Top of the stairs, main terrace straight (the stairs shortcut ends here, turbo strip)
  { x: 70, z: -106, y: 5.4 }, // 9: Waterfall, upper bank (the waterfall shortcut starts here)
  { x: 45, z: -97, y: 4.4 }, // 10: Steps down to the pool
  { x: 35, z: -66, y: 3.4 }, // 11: East bank of the pool
  { x: 28, z: -30, y: 3.0 }, // 12: Pool corner
  { x: -3, z: -14, y: 2.9 }, // 13: Stepping stones across the pool
  { x: -36, z: -30, y: 3.0 }, // 14: Pool corner
  { x: -43, z: -66, y: 3.4 }, // 15: West bank of the pool
  { x: -52, z: -97, y: 4.4 }, // 16: Climb back to the terrace
  { x: -78, z: -106, y: 5.0 }, // 17: Upper bank again (the waterfall shortcut ends here)
  { x: -125, z: -95, y: 4.8 }, // 18: Terraza del Cacique
  { x: -155, z: -50, y: 3.8 }, // 19: Mossy switchback
  { x: -155, z: 10, y: 2.6 }, // 20: Descent through the ceiba grove
  { x: -130, z: 62, y: 1.4 }, // 21: Fern gully
  { x: -92, z: 98, y: 0.4 }, // 22: Last bend back to the trail
]

const TOTAL_SAMPLES = POINTS.length * SAMPLES_PER_SEGMENT
const loop = buildCenterline(POINTS, SAMPLES_PER_SEGMENT).points

/** Centerline sample at control point `index`, so the shortcut ends sit exactly on the road. */
function landmark(index: number): { x: number; z: number } {
  const point = loop[index * SAMPLES_PER_SEGMENT]
  if (!point) throw new Error(`Missing Ciudad Perdida landmark ${index}`)
  return { x: point.x, z: point.z }
}

/** Fraction of the loop that lands on sample `index`. */
function at(index: number): number {
  return (index + 0.5) / TOTAL_SAMPLES
}

export const ciudadPerdidaData: TrackData = {
  version: 1,
  name: 'Ciudad Perdida',
  halfWidth: 8.5,
  samplesPerSegment: SAMPLES_PER_SEGMENT,
  points: POINTS,
  branches: [
    {
      // Steep, narrow stone stairs straight up the terrace wall
      name: 'Escalinata de piedra',
      points: [
        landmark(4),
        { x: 150, z: 5 },
        { x: 147, z: -30 },
        { x: 143, z: -62 },
        { x: 136, z: -84 },
        { x: 122, z: -99 },
        landmark(8),
      ],
      halfWidth: 4.5,
      surface: 'dirt',
      // The climb is concentrated in the middle of the wall, cut into nine stone treads
      heights: [1.8, 1.9, 2.1, 5.2, 5.5, 5.6, 5.6],
      steps: 9,
    },
    {
      // Wading behind the waterfall instead of going down to the pool and back up
      name: 'Tras la cascada',
      points: [
        landmark(9),
        { x: 40, z: -106 },
        { x: 5, z: -106 },
        { x: -30, z: -106 },
        { x: -58, z: -107 },
        landmark(17),
      ],
      halfWidth: 6,
      surface: 'water',
    },
  ],
  checkpoints: { count: 14, optional: [3, 4, 6, 7, 8, 9, 10] },
  itemBoxRows: [
    { at: at(20), count: 4 },
    { at: at(115), count: 3 },
    { at: at(170), count: 4 },
    { at: at(205), count: 3 },
  ],
  uchuvaLines: [
    { at: at(6), count: 5, offset: -4 },
    { at: at(44), count: 5, offset: 4 },
    { at: at(112), count: 5, offset: 0 },
    { at: at(150), count: 5, offset: -3 },
    { at: at(185), count: 5, offset: 3 },
    { at: at(218), count: 5, offset: 0 },
  ],
  boostPads: [{ at: at(8 * SAMPLES_PER_SEGMENT + 5), offset: 0, length: 8, width: 5 }],
}

/** Misty Sierra Nevada jungle: deep greens, grey stone terraces and dense fog. */
export const ciudadPerdidaTheme: TrackTheme = {
  sky: '#7fbfa4',
  horizon: '#c6e5d3',
  fog: '#b3d8c4',
  fogNear: 55,
  fogFar: 230,
  ambientSky: '#dcf3e4',
  ambientGround: '#2f5d3a',
  ambientIntensity: 1.1,
  sun: '#fff0c4',
  sunIntensity: 1.2,
  ground: '#2e6b3d',
  road: '#8b8676',
  wall: '#6f6b5e',
  curb: ['#4f7a45', '#d6c9a1'],
  decorations: [
    { kind: 'jungleTree', count: 170 },
    { kind: 'stoneTerrace', count: 14 },
    { kind: 'rock', count: 50 },
  ],
}
