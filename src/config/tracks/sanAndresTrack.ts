import type { TrackData, TrackPointData } from '../../sim/trackData'
import { buildCenterline } from '../../sim/trackSpline'
import type { TrackTheme } from './theme'

const SAMPLES_PER_SEGMENT = 14

/** Key landmarks of the island road, clockwise from the north beach. */
const POINTS: TrackPointData[] = [
  { x: -30, z: -100, y: 0.2 }, // 0: Start / finish line on the Spratt Bight promenade
  { x: 30, z: -100, y: 0.2, surface: 'sand' }, // 1: Spratt Bight beach (turbo strip)
  { x: 90, z: -95, y: 0.3, surface: 'sand' }, // 2: Beach bar, sandy road
  { x: 140, z: -65, y: 0.6 }, // 3: Coconut grove
  { x: 165, z: -15, y: 1.3 }, // 4: Punta Sur lookout
  { x: 158, z: 38, y: 1.7 }, // 5: The blowhole (Hoyo Soplador)
  { x: 122, z: 78, y: 0.9 }, // 6: Down to the south shore
  { x: 70, z: 98, y: 0.4 }, // 7: Lagoon mouth, east bank (the sandbank starts here)
  { x: 49, z: 92, y: 0.3 }, // 8: Lagoon shore, east side
  { x: 34, z: 76, y: 0.3 }, // 9: Lagoon south-east bend
  { x: 30, z: 54, y: 0.3 }, // 10: Lagoon east shore
  { x: 22, z: 34, y: 0.3 }, // 11: Lagoon north-east bend
  { x: 4, z: 20, y: 0.3 }, // 12: Back of the lagoon
  { x: -18, z: 18, y: 0.3 }, // 13: Mangrove point
  { x: -39, z: 23, y: 0.3 }, // 14: Lagoon north-west bend
  { x: -55, z: 39, y: 0.3 }, // 15: Lagoon west shore
  { x: -60, z: 60, y: 0.3 }, // 16: Fishing pier
  { x: -72, z: 85, y: 0.3 }, // 17: Lagoon south-west bend
  { x: -100, z: 98, y: 0.4 }, // 18: Lagoon mouth, west bank (the sandbank ends here)
  { x: -135, z: 85, y: 0.3, surface: 'sand' }, // 19: West View beach
  { x: -160, z: 45, y: 0.6, surface: 'sand' }, // 20: Sand dunes
  { x: -166, z: -10, y: 1.0 }, // 21: La Loma hill
  { x: -142, z: -62, y: 0.8 }, // 22: Down to the north coast
  { x: -90, z: -100, y: 0.3 }, // 23: Back onto the promenade
]

const TOTAL_SAMPLES = POINTS.length * SAMPLES_PER_SEGMENT
const loop = buildCenterline(POINTS, SAMPLES_PER_SEGMENT).points

/** Centerline sample at control point `index`, so the shortcut ends sit exactly on the road. */
function landmark(index: number): { x: number; z: number } {
  const point = loop[index * SAMPLES_PER_SEGMENT]
  if (!point) throw new Error(`Missing San Andres landmark ${index}`)
  return { x: point.x, z: point.z }
}

/** Fraction of the loop that lands on sample `index`. */
function at(index: number): number {
  return (index + 0.5) / TOTAL_SAMPLES
}

export const sanAndresData: TrackData = {
  version: 1,
  name: 'San Andrés',
  halfWidth: 9,
  samplesPerSegment: SAMPLES_PER_SEGMENT,
  points: POINTS,
  branches: [
    {
      // Sandbank across the mouth of the lagoon: slow water at high tide, fast sand at low tide
      name: 'Banco de arena',
      points: [
        landmark(7),
        { x: 40, z: 98 },
        { x: 5, z: 98 },
        { x: -30, z: 98 },
        { x: -65, z: 98 },
        landmark(18),
      ],
      halfWidth: 7,
      surface: 'water',
      tide: { lowLaps: [2], lowSurface: 'sand', highSurface: 'water' },
    },
  ],
  checkpoints: { count: 11, optional: [4, 5, 6, 7, 8] },
  itemBoxRows: [
    { at: at(22), count: 4 },
    { at: at(78), count: 3 },
    { at: at(182), count: 3 },
    { at: at(300), count: 4 },
  ],
  uchuvaLines: [
    { at: at(6), count: 5, offset: -4 },
    { at: at(48), count: 5, offset: 4 },
    { at: at(100), count: 5, offset: 0 },
    { at: at(205), count: 5, offset: -3 },
    { at: at(280), count: 5, offset: 3 },
    { at: at(325), count: 5, offset: 0 },
  ],
  boostPads: [{ at: at(2 * SAMPLES_PER_SEGMENT + 3), offset: 0, length: 8, width: 5 }],
}

/** Seven-color sea around a bright island: turquoise water, white sand and palms. */
export const sanAndresTheme: TrackTheme = {
  sky: '#3fb8ee',
  horizon: '#c4ecff',
  fog: '#aee4f6',
  fogNear: 120,
  fogFar: 360,
  ambientSky: '#ffffff',
  ambientGround: '#e8dca8',
  ambientIntensity: 1.25,
  sun: '#fff7e0',
  sunIntensity: 1.7,
  ground: '#7cc45c',
  road: '#5d6269',
  wall: '#f2efe4',
  curb: ['#ff6f61', '#ffffff'],
  decorations: [
    { kind: 'palm', count: 150 },
    { kind: 'rock', count: 30 },
  ],
  water: { level: -0.6, color: '#25d0c8' },
}
