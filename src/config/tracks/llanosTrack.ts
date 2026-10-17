import type { TrackData, TrackPointData } from '../../sim/trackData'
import { buildCenterline } from '../../sim/trackSpline'
import type { TrackTheme } from './theme'

/** Key landmarks of the Llanos Orientales circuit: wide plains with one huge eastern sweeper. */
const POINTS: TrackPointData[] = [
  { x: -50, z: -98, y: 0.0 }, // 0: Start / finish line at the ranch gate
  { x: 30, z: -120, y: 0.3 }, // 1: Cattle crossing straight
  { x: 105, z: -110, y: 0.8 }, // 2: End of the straight (the mud cut leaves here)
  { x: 170, z: -104, y: 1.0 }, // 3: Entrance of the huge eastern turn
  { x: 222, z: -80, y: 1.4 }, // 4: Eastern sweeper, first half
  { x: 244, z: -30, y: 1.5 }, // 5: Moriche palm grove at the apex
  { x: 222, z: 20, y: 1.3 }, // 6: Eastern sweeper, second half
  { x: 170, z: 42, y: 1.0 }, // 7: Curve exit
  { x: 105, z: 50, y: 0.6 }, // 8: Return straight (the mud cut rejoins here)
  { x: 30, z: 70, y: 0.3, surface: 'dirt' }, // 9: Dirt stretch along the dry river bed
  { x: -45, z: 52, y: 0.2, surface: 'dirt' }, // 10: Windmill corner
  { x: -108, z: 40, y: 0.5 }, // 11: Western sweeper
  { x: -150, z: -20, y: 0.9 }, // 12: Lagoon at sunset
  { x: -125, z: -72, y: 0.5 }, // 13: Run-in to the start straight
]

const SAMPLES_PER_SEGMENT = 14

const centerline = buildCenterline(POINTS, SAMPLES_PER_SEGMENT).points

function roadPoint(sample: number): { x: number; z: number } {
  const point = centerline[sample]
  if (!point) throw new Error(`Missing Llanos centerline sample ${sample}`)
  return { x: point.x, z: point.z }
}

export const llanosData: TrackData = {
  version: 1,
  name: 'Llanos Orientales',
  halfWidth: 9,
  samplesPerSegment: SAMPLES_PER_SEGMENT,
  points: POINTS,
  branches: [
    {
      // Open field that cuts the whole eastern sweeper
      name: 'Campo abierto',
      points: [
        roadPoint(2 * SAMPLES_PER_SEGMENT),
        { x: 128, z: -93 },
        { x: 143, z: -65 },
        { x: 146, z: -25 },
        { x: 140, z: 15 },
        { x: 122, z: 40 },
        roadPoint(8 * SAMPLES_PER_SEGMENT + 6),
      ],
      halfWidth: 8,
      surface: 'mud',
    },
  ],
  // Gates 2-6 lie along the eastern sweeper, which the field skips
  checkpoints: { count: 11, optional: [2, 3, 4, 5, 6] },
  itemBoxRows: [
    { at: 0.1, count: 4 },
    { at: 0.5, count: 3 },
    { at: 0.72, count: 4 },
    { at: 0.9, count: 3 },
  ],
  uchuvaLines: [
    { at: 0.04, count: 5, offset: -4 },
    { at: 0.2, count: 5, offset: 3 },
    { at: 0.4, count: 5, offset: 0 },
    { at: 0.55, count: 5, offset: -3 },
    { at: 0.8, count: 5, offset: 4 },
    { at: 0.95, count: 4, offset: 0 },
  ],
  boostPads: [
    { at: 0.46, offset: 0 },
    { at: 0.66, offset: 0 },
  ],
  hazards: [
    // Cow stampede: the herd runs back and forth across the straight after the start
    {
      kind: 'herd',
      path: [
        { x: 62, z: -165 },
        { x: 62, z: -78 },
      ],
      motion: 'pingPong',
      speed: 6,
      count: 5,
      radius: 1.6,
      pause: 3,
    },
  ],
}

export const llanosTheme: TrackTheme = {
  sky: '#ff8a3d',
  horizon: '#ffc27a',
  fog: '#f5b46d',
  fogNear: 100,
  fogFar: 340,
  ambientSky: '#ffd9a8',
  ambientGround: '#8a6a3a',
  ambientIntensity: 1.1,
  sun: '#ff9d4a',
  sunIntensity: 1.35,
  ground: '#b3a24c',
  road: '#6d6358',
  wall: '#8a5a3c',
  curb: ['#e8742c', '#fff3d6'],
  decorations: [
    { kind: 'moriche', count: 90 },
    { kind: 'cow', count: 50 },
    { kind: 'tree', count: 80 },
  ],
}
