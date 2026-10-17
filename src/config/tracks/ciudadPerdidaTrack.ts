import type { TrackData, TrackPointData } from '../../sim/trackData'
import { buildCenterline } from '../../sim/trackSpline'
import type { TrackEnvironment } from './environment'
import type { TrackTheme } from './theme'

const SAMPLES_PER_SEGMENT = 14

/**
 * Key landmarks of the Sierra Nevada climb, from the Buritaca river (y 0) to the top terrace of
 * the Lost City (y 30) and a fast descent back. Two hairpins (radius ~25) and a wide corner
 * climb the mountain; the terrace is flat around a pool; the way down has two crest ramps and a
 * ravine. No stretch of road passes near another one, so the format never has to stack roads.
 */
const POINTS: TrackPointData[] = [
  { x: -10, z: 105, y: 0.0 }, // 0: Start / finish line on the jungle trail
  { x: 35, z: 105, y: 0.2 }, // 1
  { x: 52, z: 102, y: 0.3 }, // 2: Stone bridge over the Buritaca river
  { x: 74, z: 101, y: 0.9 }, // 3
  { x: 86, z: 101, y: 1.2 }, // 4: Foot of the Sierra: first hairpin begins (left, R~27)
  { x: 94, z: 100, y: 1.7 }, // 5
  { x: 102, z: 96, y: 2.2 }, // 6
  { x: 108, z: 90, y: 2.6 }, // 7
  { x: 112, z: 82, y: 3.1 }, // 8
  { x: 113, z: 74, y: 3.6 }, // 9
  { x: 112, z: 66, y: 4.1 }, // 10
  { x: 108, z: 58, y: 4.6 }, // 11
  { x: 102, z: 52, y: 5.0 }, // 12
  { x: 94, z: 48, y: 5.5 }, // 13
  { x: 86, z: 47, y: 6.0 }, // 14: First hairpin done, climbing west (the stairs shortcut rejoins here)
  { x: 74, z: 47, y: 7.3 }, // 15
  { x: 54, z: 47, y: 9.6 }, // 16
  { x: 42, z: 47, y: 10.9 }, // 17
  { x: 32, z: 47, y: 12.0 }, // 18: Second hairpin begins (right, R~27)
  { x: 24, z: 46, y: 12.3 }, // 19
  { x: 16, z: 42, y: 12.6 }, // 20
  { x: 10, z: 36, y: 12.8 }, // 21
  { x: 6, z: 28, y: 13.1 }, // 22
  { x: 5, z: 20, y: 13.4 }, // 23
  { x: 6, z: 12, y: 13.7 }, // 24
  { x: 10, z: 4, y: 14.0 }, // 25
  { x: 16, z: -2, y: 14.2 }, // 26
  { x: 24, z: -6, y: 14.5 }, // 27
  { x: 32, z: -7, y: 14.8 }, // 28: Second hairpin done, long climb east
  { x: 42, z: -7, y: 15.5 }, // 29
  { x: 62, z: -7, y: 16.8 }, // 30
  { x: 86, z: -7, y: 18.4 }, // 31
  { x: 110, z: -7, y: 20.0 }, // 32
  { x: 132, z: -7, y: 21.5 }, // 33: Wide corner into the cliff (the ledge shortcut cuts across it)
  { x: 144, z: -7, y: 22.1 }, // 34
  { x: 153, z: -8, y: 22.6 }, // 35
  { x: 160, z: -12, y: 23.0 }, // 36
  { x: 167, z: -19, y: 23.5 }, // 37
  { x: 171, z: -26, y: 23.9 }, // 38
  { x: 172, z: -35, y: 24.3 }, // 39
  { x: 172, z: -48, y: 25.0 }, // 40
  { x: 172, z: -62, y: 26.4 }, // 41
  { x: 172, z: -70, y: 27.2 }, // 42: Top of the cliff road
  { x: 170, z: -80, y: 27.5 }, // 43
  { x: 166, z: -89, y: 27.9 }, // 44
  { x: 159, z: -96, y: 28.2 }, // 45
  { x: 150, z: -100, y: 28.5 }, // 46
  { x: 140, z: -102, y: 28.8 }, // 47
  { x: 128, z: -102, y: 29.2 }, // 48
  { x: 108, z: -105, y: 29.9 }, // 49
  { x: 90, z: -108, y: 30.5 }, // 50: Terraza de los Tairona: the top terrace, waterfall upstream
  { x: 70, z: -98, y: 30.2 }, // 51: Pool detour begins (the waterfall shortcut cuts across it)
  { x: 48, z: -76, y: 28.7 }, // 52
  { x: 22, z: -68, y: 27.4 }, // 53: Stepping stones in the pool, lowest point of the terrace
  { x: -4, z: -76, y: 28.6 }, // 54
  { x: -22, z: -94, y: 29.8 }, // 55
  { x: -42, z: -106, y: 30.8 }, // 56: Back on the terrace, leaving the pool
  { x: -64, z: -110, y: 30.0 }, // 57
  { x: -78, z: -110, y: 29.2 }, // 58: Terrace lip: the first crest ramp (launch only)
  { x: -108, z: -105, y: 26.3 }, // 59
  { x: -124, z: -91, y: 24.3 }, // 60
  { x: -132, z: -70, y: 22.2 }, // 61: Fast descent: second crest ramp
  { x: -133, z: -50, y: 20.2 }, // 62
  { x: -132, z: -30, y: 18.2 }, // 63: Ravine rim: the road swings out, the shortcut jumps straight across
  { x: -138, z: -12, y: 16.7 }, // 64
  { x: -154, z: 6, y: 14.8 }, // 65
  { x: -166, z: 30, y: 12.6 }, // 66: Far side of the ravine bend
  { x: -168, z: 54, y: 10.8 }, // 67
  { x: -156, z: 74, y: 9.0 }, // 68
  { x: -136, z: 88, y: 7.2 }, // 69
  { x: -114, z: 96, y: 5.4 }, // 70: Ravine bypass rejoins the road
  { x: -84, z: 103, y: 2.4 }, // 71
  { x: -62, z: 106, y: 1.5 }, // 72
  { x: -28, z: 106, y: 0.2 }, // 73: Last straight, flat for the grid
]

const TOTAL_SAMPLES = POINTS.length * SAMPLES_PER_SEGMENT
const loop = buildCenterline(POINTS, SAMPLES_PER_SEGMENT).points

/** Centerline sample `index`, so the shortcut ends sit exactly on the road. */
function road(index: number): { x: number; z: number } {
  const point = loop[index]
  if (!point) throw new Error(`Missing Ciudad Perdida road sample ${index}`)
  return { x: point.x, z: point.z }
}

/** Fraction of the loop that lands on sample `index`. */
function at(index: number): number {
  return (index + 0.5) / TOTAL_SAMPLES
}

export const ciudadPerdidaData: TrackData = {
  version: 1,
  name: 'Ciudad Perdida',
  halfWidth: 6.5,
  samplesPerSegment: SAMPLES_PER_SEGMENT,
  points: POINTS,
  branches: [
    {
      // Steep, narrow stone stairs straight up between the legs of the first hairpin
      name: 'Escalinata de piedra',
      points: [
        road(34),
        { x: 74, z: 97 },
        { x: 79, z: 86 },
        { x: 79, z: 64 },
        { x: 74, z: 52 },
        road(218),
      ],
      halfWidth: 4.5,
      surface: 'dirt',
      // The climb is concentrated in the middle of the wall, cut into nine stone treads
      heights: [0.5, 0.8, 3, 6.2, 8.4, 8.6],
      steps: 9,
    },
    {
      // A narrow ledge cut into the cliff, straight across the wide corner
      name: 'Cornisa del acantilado',
      points: [
        road(434),
        { x: 100, z: -16 },
        { x: 122, z: -30 },
        { x: 146, z: -46 },
        { x: 164, z: -58 },
        road(572),
      ],
      halfWidth: 3,
      surface: 'dirt',
    },
    {
      // Wading behind the waterfall instead of going down to the pool and back up
      name: 'Tras la cascada',
      points: [
        road(700),
        { x: 62, z: -108 },
        { x: 32, z: -109 },
        { x: 4, z: -109 },
        { x: -22, z: -108 },
        road(784),
      ],
      halfWidth: 6,
      surface: 'water',
    },
    {
      // Straight across the ravine: a ramp and a twelve metre gap instead of the long bend
      name: 'Salto del barranco',
      points: [road(882), { x: -131, z: 0 }, { x: -129, z: 30 }, { x: -127, z: 60 }, road(974)],
      halfWidth: 5,
      surface: 'dirt',
    },
  ],
  // Gates 1-2 lie inside the first hairpin, 6-7 around the cliff corner, 10 on the pool detour
  // and 12-13 along the ravine bend
  checkpoints: { count: 14, optional: [1, 2, 6, 7, 10, 12, 13] },
  itemBoxRows: [
    { at: at(145), count: 4 },
    { at: at(405), count: 3 },
    { at: at(740), count: 4 },
    { at: at(907), count: 3 },
  ],
  uchuvaLines: [
    { at: at(14), count: 5, offset: -3 },
    { at: at(284), count: 5, offset: 3 },
    { at: at(487), count: 5, offset: 0 },
    { at: at(680), count: 5, offset: -3 },
    { at: at(764), count: 5, offset: 3 },
    { at: at(932), count: 5, offset: 0 },
    { at: at(1008), count: 5, offset: -2 },
  ],
  boostPads: [
    // Start straight, and the exit of the stairs
    { at: at(10), offset: 0, length: 8, width: 5 },
    { at: at(228), offset: 0, length: 8, width: 5 },
    // Turbo on the ledge, and before the lip of the ravine jump
    { at: 0.5, offset: 0, branch: 'Cornisa del acantilado', length: 6, width: 3 },
    { at: 0.2, offset: 0, branch: 'Salto del barranco', length: 8, width: 5 },
  ],
  jumps: [
    // Crest ramps (launch only) on the straights of the descent
    { at: at(806), launchSpeed: 8 },
    { at: at(848), launchSpeed: 8 },
    // The ravine jump: the ramp is 45 m into the shortcut, then twelve metres of nothing
    { at: 0.365, branch: 'Salto del barranco', launchSpeed: 13, gap: 12 },
  ],
}

/** Sierra Nevada cloud jungle: stone terraces, conical huts and dense forest. */
export const ciudadPerdidaEnvironment: TrackEnvironment = {
  seed: 3505,
  terrain: {
    palette: {
      grassLight: '#5aa83a',
      grassDark: '#2c6a2a',
      grassDry: '#8aa84a',
      dirt: '#7a5a3a',
      rock: '#6f6b5e',
    },
    shoulder: 3,
    hillHeight: 14,
    valleySlope: 0.6,
  },
  fence: 'wood',
  road: 'dirt',
  vegetation: {
    grass: 3600,
    flowers: 1000,
    bushes: 380,
    ferns: 640,
    palms: 50,
    trees: 460,
    cypress: 0,
    distant: 800,
    flowerColors: ['#ff3b30', '#ff9f1c', '#ffd23f', '#ff5fa2'],
    models: { palms: 'ceiba', trees: 'jungle' },
  },
  decor: {
    sponsors: [
      'Teyuna Turbo',
      'Mochila Racing',
      'Cacao Max',
      'Sierra Express',
      'Guatapurí Cola',
      'Tumbaga Motors',
      'Jaguar Tours',
      'Bocachico Veloz',
    ],
    bannerDensity: 5,
    pennantStrings: 3,
    props: [
      { kind: 'stoneTerrace', at: 0.06, side: -1, edge: 14 },
      { kind: 'maloca', at: 0.14, side: 1, edge: 16 },
      { kind: 'stoneTerrace', at: 0.27, side: 1, edge: 14 },
      { kind: 'maloca', at: 0.4, side: -1, edge: 16 },
      { kind: 'stoneTerrace', at: 0.55, side: -1, edge: 14 },
      { kind: 'stoneTerrace', at: 0.7, side: 1, edge: 15 },
      { kind: 'maloca', at: 0.84, side: 1, edge: 16 },
    ],
  },
}

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
  sunDirection: [0.3, 0.85, 0.2],
  exposure: 1.2,
  mountains: { color: '#3f7a55', height: 85, jagged: 0.8 },
  clouds: 0.7,
  ground: '#2e6b3d',
  road: '#8b8676',
  wall: '#6f6b5e',
  curb: ['#4f7a45', '#d6c9a1'],
  decorations: [
    { kind: 'stoneTerrace', count: 10 },
    { kind: 'rock', count: 40 },
  ],
  environment: ciudadPerdidaEnvironment,
}
