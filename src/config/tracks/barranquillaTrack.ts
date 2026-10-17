import type { Vec2 } from '../../sim/math'
import type { TrackData, TrackPointData } from '../../sim/trackData'
import { buildCenterline } from '../../sim/trackSpline'
import { spotAt } from './pickupLayout'
import type { TrackTheme } from './theme'

const SAMPLES_PER_SEGMENT = 14

/** Key landmarks of the Batalla de Flores parade route, clockwise from the Vía 40 straight. */
const POINTS: TrackPointData[] = [
  { x: -40, z: -117, y: 0.0 }, // 0: Start / finish line on the Vía 40
  { x: 25, z: -119, y: 0.0 }, // 1: Grandstands of the Vía 40 (turbo strip)
  { x: 92, z: -113, y: 0.0 }, // 2: Marimonda corner
  { x: 133, z: -93, y: 0.0 }, // 3: Plaza de la Paz approach
  { x: 141, z: -62, y: 0.0 }, // 4: Calle del Cuartel (the confetti alley starts here)
  { x: 146, z: -40, y: 0.0 }, // 5: Parade loop around the block
  { x: 163, z: -28, y: 0.0 }, // 6: Cumbia stage
  { x: 184, z: -25, y: 0.0 }, // 7: Float parking lot
  { x: 201, z: -13, y: 0.0 }, // 8: Costume workshops
  { x: 208, z: 7, y: 0.0 }, // 9: Far end of the parade loop
  { x: 207, z: 28, y: 0.0 }, // 10: Carnival market
  { x: 198, z: 46, y: 0.0 }, // 11: Back along the block
  { x: 179, z: 56, y: 0.0 }, // 12: Congo dancers corner
  { x: 160, z: 60, y: 0.0 }, // 13: Last stands of the loop
  { x: 146, z: 76, y: 0.0 }, // 14: Rejoining the avenue
  { x: 141, z: 92, y: 0.0 }, // 15: Calle del Cuartel south (the confetti alley ends here)
  { x: 126, z: 120, y: 0.0 }, // 16: Parque Cultural del Caribe
  { x: 92, z: 140, y: 0.4 }, // 17: Rising toward the bridge
  { x: 42, z: 146, y: 1.6 }, // 18: Puente Pumarejo
  { x: -12, z: 144, y: 2.2 }, // 19: Crest of the bridge
  { x: -62, z: 130, y: 1.4 }, // 20: Carnival chicane
  { x: -105, z: 143, y: 0.5 }, // 21: Hairpin of the garabato dancers
  { x: -140, z: 116, y: 0.0 }, // 22: Plaza del Carnaval
  { x: -152, z: 65, y: 0.0 }, // 23: Long avenue north
  { x: -148, z: 10, y: 0.0 }, // 24: Colonial houses
  { x: -130, z: -50, y: 0.0 }, // 25: Calle 72 corner
  { x: -100, z: -100, y: 0.0 }, // 26: Last turn
  { x: -68, z: -117, y: 0.0 }, // 27: Back onto the Vía 40
]

const TOTAL_SAMPLES = POINTS.length * SAMPLES_PER_SEGMENT
const loop = buildCenterline(POINTS, SAMPLES_PER_SEGMENT).points

/** Centerline sample at control point `index`, so the shortcut ends sit exactly on the road. */
function landmark(index: number): Vec2 {
  const point = loop[index * SAMPLES_PER_SEGMENT]
  if (!point) throw new Error(`Missing Barranquilla landmark ${index}`)
  return { x: point.x, z: point.z }
}

/** Fraction of the loop that lands on sample `index`. */
function at(index: number): number {
  return (index + 0.5) / TOTAL_SAMPLES
}

/** Floats ride the left lane, so the right side of the road (more than 13 m) stays free. */
const FLOAT_LANE = -6.8
const FLOAT_PATH_STEP = 6

const floatPath: Vec2[] = loop
  .filter((_, index) => index % FLOAT_PATH_STEP === 0)
  .map((_, n) => spotAt(loop, n * FLOAT_PATH_STEP, FLOAT_LANE))

export const barranquillaData: TrackData = {
  version: 1,
  name: 'Carnaval de Barranquilla',
  halfWidth: 10.5,
  samplesPerSegment: SAMPLES_PER_SEGMENT,
  points: POINTS,
  branches: [
    {
      // A cut through the confetti cloud: narrow and slow underfoot, but a turbo waits at the exit
      name: 'Callejón de papelillo',
      points: [
        landmark(4),
        { x: 141, z: -30 },
        { x: 141, z: 0 },
        { x: 141, z: 30 },
        { x: 141, z: 60 },
        landmark(15),
      ],
      halfWidth: 6,
      surface: 'dirt',
    },
  ],
  checkpoints: { count: 12, optional: [2, 3, 4, 5, 6] },
  itemBoxRows: [
    { at: at(30), count: 4 },
    { at: at(112), count: 3 },
    { at: at(300), count: 4 },
    { at: at(340), count: 3 },
  ],
  uchuvaLines: [
    { at: at(8), count: 5, offset: 4 },
    { at: at(48), count: 5, offset: 4 },
    { at: at(236), count: 5, offset: -3 },
    { at: at(268), count: 5, offset: 3 },
    { at: at(320), count: 5, offset: 0 },
    { at: at(372), count: 5, offset: -3 },
  ],
  boostPads: [
    { at: at(1 * SAMPLES_PER_SEGMENT + 12), offset: 3, length: 8, width: 5 },
    // Where the confetti alley rejoins the avenue
    { at: at(15 * SAMPLES_PER_SEGMENT + 7), offset: 0, length: 8, width: 5 },
  ],
  hazards: [
    {
      // Two parade floats rolling along the whole route, hugging the left lane
      kind: 'float',
      path: floatPath,
      motion: 'loop',
      speed: 8,
      count: 2,
      radius: 3.5,
    },
  ],
}

/** Carnival parade: confetti-pink sky, saturated streamers and festive curbs. */
export const barranquillaTheme: TrackTheme = {
  sky: '#6f9bff',
  horizon: '#ffd9ee',
  fog: '#f6cfe8',
  fogNear: 100,
  fogFar: 320,
  ambientSky: '#fff0fa',
  ambientGround: '#e89ac4',
  ambientIntensity: 1.2,
  sun: '#fff1c9',
  sunIntensity: 1.5,
  ground: '#e3bf58',
  road: '#4d4a5c',
  wall: '#ff5fa2',
  curb: ['#ffd23f', '#2ec4b6'],
  decorations: [
    { kind: 'confetti', count: 160 },
    { kind: 'colonialHouse', count: 50 },
    { kind: 'palm', count: 40 },
  ],
}
