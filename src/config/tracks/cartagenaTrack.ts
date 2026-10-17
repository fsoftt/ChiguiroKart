import type { TrackData, TrackPointData } from '../../sim/trackData'
import { buildCenterline } from '../../sim/trackSpline'
import type { TrackEnvironment } from './environment'
import type { TrackTheme } from './theme'

const SAMPLES_PER_SEGMENT = 14

/** Key landmarks of the walled city, clockwise from the start line on the Muelle straight. */
const POINTS: TrackPointData[] = [
  { x: -20, z: -105, y: 0.0 }, // 0: Start / finish line on the Muelle de los Pegasos
  { x: 40, z: -105, y: 0.0 }, // 1: Muelle straight
  { x: 100, z: -100, y: 0.0 }, // 2: Torre del Reloj gate
  { x: 150, z: -72, y: 3.0 }, // 3: Baluarte de Santo Domingo (the wall walk starts here)
  { x: 208, z: -30, y: 0.4 }, // 4: Outer moat road under the wall
  { x: 214, z: 28, y: 0.4 }, // 5: Calle de los Coches
  { x: 160, z: 72, y: 3.0 }, // 6: Baluarte de San Lucas (the wall walk ends here)
  { x: 105, z: 100, y: 1.4 }, // 7: Plaza de la Merced
  { x: 50, z: 108, y: 0.8 }, // 8: Cannon ramp approach (turbo strip)
  { x: 0, z: 108, y: 3.8 }, // 9: Cannon ramp crest, the kart is fired off
  { x: -45, z: 100, y: 0.6 }, // 10: Landing at Plaza de Santo Domingo
  { x: -95, z: 80, y: 0.2 }, // 11: Calle de los Santos de Piedra
  { x: -128, z: 45, y: 0.0 }, // 12: Balconies of the Calle del Candilejo
  { x: -152, z: -5, y: 0.0 }, // 13: Baluarte de San Francisco Javier
  { x: -118, z: -62, y: 0.0 }, // 14: Puerta del Reloj corner
  { x: -75, z: -105, y: 0.0 }, // 15: Back onto the Muelle
]

const TOTAL_SAMPLES = POINTS.length * SAMPLES_PER_SEGMENT
const loop = buildCenterline(POINTS, SAMPLES_PER_SEGMENT).points

/** Centerline sample `index`, so the shortcut ends sit exactly on the road. */
function loopPoint(index: number): { x: number; z: number } {
  const point = loop[index]
  if (!point) throw new Error(`Missing Cartagena centerline point ${index}`)
  return { x: point.x, z: point.z }
}

/** Fraction of the loop that lands on sample `index`. */
function at(index: number): number {
  return (index + 0.5) / TOTAL_SAMPLES
}

export const cartagenaData: TrackData = {
  version: 1,
  name: 'Murallas de Cartagena',
  halfWidth: 9,
  samplesPerSegment: SAMPLES_PER_SEGMENT,
  points: POINTS,
  branches: [
    {
      // Racing along the top of the wall: straighter and higher, but narrow
      name: 'Paseo de la muralla',
      points: [
        loopPoint(3 * SAMPLES_PER_SEGMENT),
        { x: 152, z: -45 },
        { x: 150, z: -12 },
        { x: 151, z: 22 },
        { x: 156, z: 50 },
        loopPoint(6 * SAMPLES_PER_SEGMENT),
      ],
      halfWidth: 5.5,
      surface: 'asphalt',
    },
  ],
  checkpoints: { count: 12, optional: [3, 4] },
  itemBoxRows: [
    { at: at(22), count: 4 },
    { at: at(71), count: 3 },
    { at: at(160), count: 4 },
    { at: at(180), count: 3 },
  ],
  uchuvaLines: [
    { at: at(8), count: 5, offset: -4 },
    { at: at(46), count: 5, offset: 4 },
    { at: at(88), count: 5, offset: 0 },
    { at: at(168), count: 5, offset: -3 },
    { at: at(190), count: 5, offset: 3 },
    { at: at(205), count: 5, offset: 0 },
  ],
  boostPads: [
    { at: at(8 * SAMPLES_PER_SEGMENT + 6), offset: 0, length: 8, width: 5 },
    // Turbo on the wall walk shortcut
    { at: 0.3, offset: 0, length: 8, width: 4, branch: 'Paseo de la muralla' },
  ],
  // The cannon ramp fires the kart off the crest: launch only, no gap
  jumps: [{ at: at(9 * SAMPLES_PER_SEGMENT), launchSpeed: 12 }],
}

/** Sunset over the colonial walls: orange and pink sky, warm stone, cannons and balconies. */
/** Colonial walls by the sea: cobbles, bougainvillea, coconut palms and cannons. */
export const cartagenaEnvironment: TrackEnvironment = {
  seed: 3404,
  terrain: {
    palette: {
      grassLight: '#b9c06a',
      grassDark: '#7f9a4a',
      grassDry: '#e0cf98',
      dirt: '#c8a874',
      rock: '#b8a48a',
    },
    shoulder: 4,
    hillHeight: 4,
    valleySlope: 0.12,
  },
  fence: 'stone',
  road: 'cobble',
  vegetation: {
    grass: 2600,
    flowers: 1100,
    bushes: 240,
    ferns: 140,
    palms: 280,
    trees: 120,
    cypress: 0,
    distant: 500,
    flowerColors: ['#ff3d9a', '#ff7ac2', '#ffffff', '#ffb13d', '#c13dff'],
    models: { ferns: 'agave', palms: 'coconutPalm', distant: 'distantPalm' },
  },
  decor: {
    sponsors: [
      'Cocada Turbo',
      'Murallas Racing',
      'Arepa de Huevo Max',
      'Champeta Express',
      'Corsario Cola',
      'Bocagrande Motors',
      'Palenquera Veloz',
      'Castillo Tours',
    ],
    bannerDensity: 7,
    pennantStrings: 6,
    props: [
      { kind: 'grandstand', at: 0.03, side: 1, edge: 14 },
      { kind: 'cannon', at: 0.08, side: -1, edge: 6 },
      { kind: 'colonialHouse', at: 0.14, side: 1, edge: 12 },
      { kind: 'cannon', at: 0.22, side: -1, edge: 6 },
      { kind: 'colonialHouse', at: 0.3, side: 1, edge: 12, turn: 0.2 },
      { kind: 'chiva', at: 0.4, side: -1, edge: 12 },
      { kind: 'cannon', at: 0.5, side: 1, edge: 6 },
      { kind: 'colonialHouse', at: 0.6, side: -1, edge: 12 },
      { kind: 'boat', at: 0.7, side: 1, edge: 10, turn: 1.2 },
      { kind: 'cannon', at: 0.78, side: -1, edge: 6 },
      { kind: 'colonialHouse', at: 0.88, side: 1, edge: 12 },
    ],
  },
}

export const cartagenaTheme: TrackTheme = {
  sky: '#5f9ad8',
  horizon: '#ffd6b8',
  fog: '#f0cdb8',
  fogNear: 90,
  fogFar: 300,
  ambientSky: '#fff0e0',
  ambientGround: '#9a7a62',
  ambientIntensity: 1.15,
  sun: '#fff1d6',
  sunIntensity: 1.35,
  sunDirection: [0.7, 0.5, 0.35],
  exposure: 1.2,
  mountains: { color: '#c98878', height: 14, jagged: 0.3 },
  clouds: 0.45,
  ground: '#c8a874',
  road: '#6d6560',
  wall: '#dcbd8c',
  curb: ['#e0556b', '#f6e3c8'],
  decorations: [{ kind: 'colonialHouse', count: 30 }],
  environment: cartagenaEnvironment,
}
