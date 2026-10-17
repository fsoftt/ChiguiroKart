import type { TrackData, TrackPointData } from '../../sim/trackData'
import { buildCenterline } from '../../sim/trackSpline'
import type { TrackTheme } from './theme'

/** Key landmarks of the Caño Cristales circuit: a river bay in the south, a ford across it. */
const POINTS: TrackPointData[] = [
  { x: 0, z: -110, y: 0.0 }, // 0: Start / finish line on the red sandstone plateau
  { x: 60, z: -115, y: 0.5 }, // 1: Plateau straight
  { x: 118, z: -92, y: 1.5 }, // 2: First sweeper above the river
  { x: 150, z: -45, y: 2.5 }, // 3: Red moss ridge
  { x: 148, z: 12, y: 3.0 }, // 4: Rock garden bend
  { x: 112, z: 55, y: 2.5 }, // 5: Turn towards the bay
  { x: 40, z: 72, y: 1.8 }, // 6: Ford entrance (the shortcut leaves here)
  { x: 15, z: 125, y: 1.2 }, // 7: Bay shore
  { x: -20, z: 168, y: 0.8 }, // 8: Pool of the five colors
  { x: -62, z: 160, y: 0.8 }, // 9: Waterfall bend
  { x: -88, z: 115, y: 1.2 }, // 10: Green algae shore
  { x: -80, z: 62, y: 1.8 }, // 11: Ford exit (the shortcut rejoins here)
  { x: -115, z: 15, y: 2.2 }, // 12: Yellow sand terrace
  { x: -132, z: -40, y: 2.0 }, // 13: Cliff overlook
  { x: -100, z: -85, y: 1.0 }, // 14: Descent through the jungle
  { x: -50, z: -108, y: 0.4 }, // 15: Last curve before the plateau
]

const SAMPLES_PER_SEGMENT = 14
const FORD_START = 6
const FORD_END_SAMPLE = 11 * SAMPLES_PER_SEGMENT + 5

const centerline = buildCenterline(POINTS, SAMPLES_PER_SEGMENT).points

function roadPoint(sample: number): { x: number; z: number } {
  const point = centerline[sample]
  if (!point) throw new Error(`Missing Caño Cristales centerline sample ${sample}`)
  return { x: point.x, z: point.z }
}

export const canoCristalesData: TrackData = {
  version: 1,
  name: 'Caño Cristales',
  halfWidth: 9,
  samplesPerSegment: SAMPLES_PER_SEGMENT,
  points: POINTS,
  branches: [
    {
      // River crossing over the stones, straight across the bay
      name: 'Vado sobre las piedras',
      points: [
        roadPoint(FORD_START * SAMPLES_PER_SEGMENT),
        { x: 15, z: 76 },
        { x: -20, z: 74 },
        { x: -52, z: 66 },
        { x: -74, z: 56 },
        roadPoint(FORD_END_SAMPLE),
      ],
      halfWidth: 7,
      surface: 'water',
    },
  ],
  // Gates 4-6 lie along the bay, which the ford skips
  checkpoints: { count: 9, optional: [4, 5, 6] },
  itemBoxRows: [
    { at: 0.1, count: 4 },
    { at: 0.3, count: 3 },
    { at: 0.5, count: 4 },
    { at: 0.8, count: 3 },
  ],
  uchuvaLines: [
    { at: 0.03, count: 5, offset: -4 },
    { at: 0.2, count: 5, offset: 4 },
    { at: 0.4, count: 5, offset: 0 },
    { at: 0.58, count: 4, offset: -3 },
    { at: 0.7, count: 5, offset: 4 },
    { at: 0.9, count: 5, offset: -2 },
  ],
  boostPads: [
    { at: 0.06, offset: 0 },
    { at: 0.76, offset: 0 },
  ],
  // Two boulders in the ford, on opposite sides: the middle line stays free but narrow
  hazards: [
    { kind: 'rock', path: [{ x: -2.3, z: 71.8 }], motion: 'loop', speed: 0, count: 1, radius: 1.6 },
    {
      kind: 'rock',
      path: [{ x: -33.6, z: 73.9 }],
      motion: 'loop',
      speed: 0,
      count: 1,
      radius: 1.6,
    },
  ],
}

export const canoCristalesTheme: TrackTheme = {
  sky: '#4fb3d9',
  horizon: '#f6d58e',
  fog: '#f2c98a',
  fogNear: 90,
  fogFar: 300,
  ambientSky: '#fff1d0',
  ambientGround: '#7a3b2e',
  ambientIntensity: 1.15,
  sun: '#fff0c4',
  sunIntensity: 1.5,
  ground: '#5f8f3a',
  road: '#9c6b5a',
  wall: '#c0392b',
  curb: ['#d62f2f', '#f4d03f'],
  decorations: [
    { kind: 'redPlant', count: 120 },
    { kind: 'rock', count: 70 },
    { kind: 'jungleTree', count: 90 },
  ],
}
