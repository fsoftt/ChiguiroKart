import type { TrackData, TrackPointData } from '../../sim/trackData'
import { buildCenterline } from '../../sim/trackSpline'
import type { TrackTheme } from './theme'

/**
 * Key landmarks of the Amazonas circuit: a raised jungle road above the river, with a river
 * loop on the north side (log ramp across its neck) and a bay on the south side (ceiba tunnel).
 * The road never drops below the river plane (level 0.3 in the theme).
 */
const POINTS: TrackPointData[] = [
  { x: 188, z: -36, y: 2.4 }, // 0: Start / finish line on the eastern bank
  { x: 186, z: 14, y: 2.2 }, // 1: Ceiba grove straight
  { x: 150, z: 55, y: 2.0 }, // 2: South-east corner
  { x: 112, z: 78, y: 1.8 }, // 3: Tunnel entrance (the ceiba shortcut leaves here)
  { x: 92, z: 125, y: 1.6 }, // 4: Bay shore
  { x: 50, z: 152, y: 1.6 }, // 5: Giant roots
  { x: 8, z: 132, y: 1.6 }, // 6: Bay bend
  { x: -6, z: 95, y: 1.7 }, // 7: Tunnel exit (the ceiba shortcut rejoins here)
  { x: -42, z: 72, y: 1.8 }, // 8: Hanging vines
  { x: -90, z: 45, y: 1.9 }, // 9: South-west corner
  { x: -112, z: 0, y: 2.0 }, // 10: Riverside camp
  { x: -110, z: -45, y: 2.1 }, // 11: Orchid slope
  { x: -92, z: -82, y: 2.3 }, // 12: Climb to the log
  { x: -60, z: -103, y: 4.4 }, // 13: Crest above the river (the log ramp leaves here)
  { x: -20, z: -130, y: 3.8 }, // 14: Downhill into the river loop
  { x: -8, z: -165, y: 3.2 }, // 15: River loop, west bank
  { x: 12, z: -198, y: 2.8 }, // 16: River loop, far bank
  { x: 48, z: -220, y: 2.5 }, // 17: River loop, top
  { x: 88, z: -198, y: 2.4 }, // 18: River loop, east bank
  { x: 104, z: -165, y: 2.4 }, // 19: River loop, coming back
  { x: 111, z: -136, y: 2.4 }, // 20: Fallen trees
  { x: 141, z: -106, y: 2.4 }, // 21: Log landing (the log ramp rejoins here)
  { x: 166, z: -95, y: 2.4 }, // 22: Last sweeper, entry
  { x: 188, z: -70, y: 2.4 }, // 23: Last sweeper, exit
]

const SAMPLES_PER_SEGMENT = 14

const centerline = buildCenterline(POINTS, SAMPLES_PER_SEGMENT).points

function roadPoint(sample: number): { x: number; z: number } {
  const point = centerline[sample]
  if (!point) throw new Error(`Missing Amazonas centerline sample ${sample}`)
  return { x: point.x, z: point.z }
}

export const amazonasData: TrackData = {
  version: 1,
  name: 'Amazonas',
  halfWidth: 9,
  samplesPerSegment: SAMPLES_PER_SEGMENT,
  points: POINTS,
  branches: [
    {
      // Narrow wooden passage through the hollow of a giant ceiba, across the bay
      name: 'Túnel de la ceiba',
      points: [
        roadPoint(3 * SAMPLES_PER_SEGMENT),
        { x: 92, z: 98 },
        { x: 60, z: 104 },
        { x: 28, z: 102 },
        roadPoint(7 * SAMPLES_PER_SEGMENT),
      ],
      halfWidth: 4.5,
      surface: 'wood',
    },
    {
      // Log ramp: leaves the crest and runs down a fallen trunk across the river loop
      name: 'Rampa del tronco',
      points: [
        roadPoint(13 * SAMPLES_PER_SEGMENT),
        { x: -20, z: -100 },
        { x: 30, z: -99 },
        { x: 90, z: -100 },
        roadPoint(21 * SAMPLES_PER_SEGMENT),
      ],
      halfWidth: 5,
      surface: 'wood',
    },
  ],
  // Gates 2-4 lie in the bay (tunnel) and 8-12 along the river loop (log ramp)
  checkpoints: { count: 14, optional: [2, 3, 4, 8, 9, 10, 11, 12] },
  itemBoxRows: [
    { at: 0.05, count: 4 },
    { at: 0.3, count: 3 },
    { at: 0.62, count: 4 },
    { at: 0.9, count: 3 },
  ],
  uchuvaLines: [
    { at: 0.1, count: 5, offset: 4 },
    { at: 0.2, count: 5, offset: -4 },
    { at: 0.4, count: 5, offset: 0 },
    { at: 0.5, count: 5, offset: 3 },
    { at: 0.72, count: 5, offset: -3 },
    { at: 0.82, count: 5, offset: 4 },
  ],
  boostPads: [
    { at: 0.56, offset: 0, length: 8 },
    { at: 0.35, offset: 0 },
  ],
  // The broken log: a lip over ten metres of river on the log ramp
  jumps: [{ at: 0.3474, branch: 'Rampa del tronco', launchSpeed: 12, gap: 10 }],
  hazards: [],
}

export const amazonasTheme: TrackTheme = {
  sky: '#8fd3c4',
  horizon: '#bfe3cf',
  fog: '#9fc9b0',
  fogNear: 60,
  fogFar: 240,
  ambientSky: '#d8f0d0',
  ambientGround: '#2f5d2a',
  ambientIntensity: 1.0,
  sun: '#fff6d0',
  sunIntensity: 1.2,
  ground: '#2f6b2f',
  road: '#6b5a45',
  wall: '#4a3a28',
  curb: ['#b5651d', '#2f6b2f'],
  decorations: [
    { kind: 'jungleTree', count: 220 },
    { kind: 'ceiba', count: 28 },
    { kind: 'rock', count: 40 },
  ],
  // River plane just under the road, which stays above 1.6 m everywhere
  water: { level: 0.3, color: '#5a8a6a' },
}
