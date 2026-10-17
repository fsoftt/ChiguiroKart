import type { TrackData, TrackPointData } from '../../sim/trackData'
import { buildCenterline } from '../../sim/trackSpline'
import type { TrackTheme } from './theme'

/**
 * Key landmarks of the Desierto de la Tatacoa circuit: a canyon finger in the north-east
 * (jump shortcut) and a gully pocket in the south-west (maze with two exits).
 */
const POINTS: TrackPointData[] = [
  { x: -100, z: -125, y: 1.0 }, // 0: Start / finish line on the red mesa
  { x: -35, z: -130, y: 1.6 }, // 1: Mesa straight, boost pads before the crest
  { x: 30, z: -128, y: 3.8 }, // 2: Canyon rim crest (the jump shortcut leaves here)
  { x: 88, z: -130, y: 3.0 }, // 3: Rim road above the canyon
  { x: 128, z: -118, y: 2.4 }, // 4: Rim turn
  { x: 150, z: -80, y: 2.0 }, // 5: Far end of the canyon
  { x: 130, z: -44, y: 1.6 }, // 6: Cactus slope
  { x: 90, z: -33, y: 1.3 }, // 7: Canyon floor
  { x: 45, z: -34, y: 1.2, surface: 'dirt' }, // 8: Landing of the jump (the shortcut rejoins here)
  { x: 0, z: -20, y: 1.2, surface: 'dirt' }, // 9: Grey badlands
  { x: -20, z: 30, y: 1.3, surface: 'dirt' }, // 10: Dry riverbed
  { x: -30, z: 85, y: 1.3 }, // 11: Gully mouth (both maze passages leave here)
  { x: -42, z: 138, y: 1.1 }, // 12: Gully pocket, east wall
  { x: -94, z: 177, y: 0.9 }, // 13: Gully pocket, bottom
  { x: -142, z: 160, y: 1.0 }, // 14: Gully pocket, west wall
  { x: -150, z: 118, y: 1.2 }, // 15: Gully exit (the long passage rejoins here)
  { x: -172, z: 72, y: 1.5, surface: 'sand' }, // 16: Sand dunes
  { x: -186, z: 14, y: 1.8, surface: 'sand' }, // 17: Dune ridge
  { x: -180, z: -55, y: 1.8 }, // 18: Cardón cactus field
  { x: -155, z: -110, y: 1.4 }, // 19: Run-in to the start straight
]

const SAMPLES_PER_SEGMENT = 14

const centerline = buildCenterline(POINTS, SAMPLES_PER_SEGMENT).points

function roadPoint(sample: number): { x: number; z: number } {
  const point = centerline[sample]
  if (!point) throw new Error(`Missing Tatacoa centerline sample ${sample}`)
  return { x: point.x, z: point.z }
}

export const tatacoaData: TrackData = {
  version: 1,
  name: 'Desierto de la Tatacoa',
  halfWidth: 9,
  samplesPerSegment: SAMPLES_PER_SEGMENT,
  points: POINTS,
  branches: [
    {
      // Straight across the canyon: down the far side of the crest instead of around the rim
      name: 'Salto del cañón',
      points: [
        roadPoint(2 * SAMPLES_PER_SEGMENT),
        { x: 60, z: -112 },
        { x: 76, z: -92 },
        { x: 76, z: -54 },
        roadPoint(8 * SAMPLES_PER_SEGMENT + 8),
      ],
      halfWidth: 6,
      surface: 'dirt',
    },
    {
      // Short gully through the middle of the pocket, back onto the west wall
      name: 'Cárcava corta',
      points: [
        roadPoint(11 * SAMPLES_PER_SEGMENT),
        { x: -58, z: 104 },
        { x: -88, z: 114 },
        { x: -116, z: 124 },
        roadPoint(14 * SAMPLES_PER_SEGMENT + 12),
      ],
      halfWidth: 4.5,
      surface: 'dirt',
    },
    {
      // Long gully along the top of the pocket, past both walls
      name: 'Cárcava larga',
      points: [
        roadPoint(10 * SAMPLES_PER_SEGMENT + 4),
        { x: -34, z: 50 },
        { x: -60, z: 62 },
        { x: -95, z: 60 },
        { x: -135, z: 48 },
        roadPoint(17 * SAMPLES_PER_SEGMENT - 2),
      ],
      halfWidth: 5,
      surface: 'dirt',
    },
  ],
  // Gates 2-5 lie along the canyon rim and 7-10 inside the gully pocket
  checkpoints: { count: 12, optional: [2, 3, 4, 5, 7, 8, 9, 10] },
  itemBoxRows: [
    { at: 0.12, count: 4 },
    { at: 0.45, count: 3 },
    { at: 0.68, count: 4 },
    { at: 0.9, count: 3 },
  ],
  uchuvaLines: [
    { at: 0.02, count: 5, offset: 4 },
    { at: 0.25, count: 5, offset: 0 },
    { at: 0.36, count: 5, offset: -4 },
    { at: 0.55, count: 5, offset: 4 },
    { at: 0.8, count: 5, offset: -3 },
    { at: 0.95, count: 4, offset: 0 },
  ],
  boostPads: [
    { at: 0.05, offset: -2.5, length: 8 },
    { at: 0.05, offset: 2.5, length: 8 },
    { at: 0.78, offset: 0 },
    // Turbo before the lip of the canyon jump
    { at: 0.15, offset: 0, length: 8, width: 5, branch: 'Salto del cañón' },
  ],
  // The canyon jump: the shortcut leaves the rim with a lip over a twelve metre chasm
  jumps: [{ at: 0.43, branch: 'Salto del cañón', launchSpeed: 13, gap: 12 }],
  hazards: [],
}

export const tatacoaTheme: TrackTheme = {
  sky: '#1a1040',
  horizon: '#8a4070',
  fog: '#5a2d62',
  fogNear: 90,
  fogFar: 320,
  ambientSky: '#a58ad0',
  ambientGround: '#7a3a2a',
  ambientIntensity: 0.95,
  sun: '#ffcf8a',
  sunIntensity: 1.0,
  sunDirection: [0.7, 0.35, 0.4],
  exposure: 1.2,
  mountains: { color: '#7a3a4a', height: 40, jagged: 0.9 },
  clouds: 0.2,
  ground: '#a2472b',
  road: '#7a6c68',
  wall: '#6f6a78',
  curb: ['#c8553a', '#d9d2ca'],
  decorations: [
    { kind: 'cactus', count: 110 },
    { kind: 'rock', count: 130 },
  ],
}
