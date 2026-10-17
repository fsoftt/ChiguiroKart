import type { TrackData } from '../../sim/trackData'
import type { TrackEnvironment } from './environment'
import type { TrackTheme } from './theme'

/**
 * Nevado del Ruiz: a clockwise loop on the glacier, two pockets cut into its east and south
 * sides. Shortcut 1: the frozen lake, a straight ice road across the south pocket (very little
 * grip). Shortcut 2: an ice tunnel straight through the volcano flank, closed by an ice wall
 * that only a level 3 nitro breaks.
 */
export const nevadoData: TrackData = {
  version: 1,
  name: 'Nevado del Ruiz',
  halfWidth: 9,
  samplesPerSegment: 6,
  points: [
    { x: 0, z: -100, y: 0 }, // Start / finish line on the glacier plateau
    { x: 14.8, z: -100, y: 0.4 }, // Glacier plateau straight
    { x: 29.6, z: -100, y: 0.8 }, // Glacier plateau straight
    { x: 44.4, z: -100, y: 1.2 }, // Glacier plateau straight
    { x: 59.2, z: -100, y: 1.6 }, // Glacier plateau straight
    { x: 74, z: -100, y: 2 }, // Base camp bend (1/4)
    { x: 92, z: -95.2, y: 2.5 }, // Base camp bend (2/4)
    { x: 105.2, z: -82, y: 3 }, // Base camp bend (3/4)
    { x: 110, z: -64, y: 3.5 }, // Base camp bend (4/4)
    { x: 105.7, z: -48, y: 4 }, // Ice tunnel base (north) (2/4)
    { x: 94, z: -36.3, y: 4.5 }, // Ice tunnel base (north) (3/4)
    { x: 75, z: -32, y: 5.9 }, // Ice tunnel base (north) (4/4)
    { x: 56, z: -27.7, y: 7.3 }, // Volcano flank, north wall (2/4)
    { x: 44.3, z: -16, y: 8.5 }, // Volcano flank, north wall (3/4)
    { x: 40, z: 0, y: 8.8 }, // Volcano flank, north wall (4/4)
    { x: 44.3, z: 16, y: 9.2 }, // Volcano flank, south wall (2/4)
    { x: 56, z: 27.7, y: 9.5 }, // Volcano flank, south wall (3/4)
    { x: 75, z: 32, y: 9 }, // Volcano flank, south wall (4/4)
    { x: 94, z: 36.3, y: 8.4 }, // Ice tunnel base (south) (2/4)
    { x: 105.7, z: 48, y: 8 }, // Ice tunnel base (south) (3/4)
    { x: 110, z: 64, y: 7.7 }, // Ice tunnel base (south) (4/4)
    { x: 105.2, z: 82, y: 7.3 }, // Snowfield descent bend (2/4)
    { x: 92, z: 95.2, y: 7 }, // Snowfield descent bend (3/4)
    { x: 74, z: 100, y: 6.9 }, // Snowfield descent bend (4/4)
    { x: 60, z: 100, y: 6.8 }, // After Snowfield descent bend
    { x: 46, z: 100, y: 6.8 }, // After Snowfield descent bend
    { x: 32, z: 100, y: 6.7 }, // Frozen lake base (east) (1/4)
    { x: 16, z: 95.7, y: 6.6 }, // Frozen lake base (east) (2/4)
    { x: 4.3, z: 84, y: 6.5 }, // Frozen lake base (east) (3/4)
    { x: 0, z: 65, y: 6.5 }, // Frozen lake base (east) (4/4)
    { x: -4.3, z: 46, y: 6.5 }, // Frozen lake north shore (east) (2/4)
    { x: -16, z: 34.3, y: 6.5 }, // Frozen lake north shore (east) (3/4)
    { x: -32, z: 30, y: 6.5 }, // Frozen lake north shore (east) (4/4)
    { x: -48, z: 34.3, y: 6.5 }, // Frozen lake north shore (west) (2/4)
    { x: -59.7, z: 46, y: 6.5 }, // Frozen lake north shore (west) (3/4)
    { x: -64, z: 65, y: 6.5 }, // Frozen lake north shore (west) (4/4)
    { x: -68.3, z: 84, y: 6.5 }, // Frozen lake base (west) (2/4)
    { x: -80, z: 95.7, y: 6.5 }, // Frozen lake base (west) (3/4)
    { x: -96, z: 100, y: 6.1 }, // Frozen lake base (west) (4/4)
    { x: -112.3, z: 100, y: 5.7 }, // Moraine bend (1/4)
    { x: -126.6, z: 96.4, y: 5.3 }, // Moraine bend (2/4)
    { x: -137.5, z: 86.4, y: 5 }, // Moraine bend (3/4)
    { x: -142.2, z: 72.4, y: 4.7 }, // Moraine bend (4/4)
    { x: -143.4, z: 57.9, y: 4.3 }, // Moraine slope
    { x: -144.5, z: 43.4, y: 4 }, // Moraine slope
    { x: -145.7, z: 29, y: 3.7 }, // Moraine slope
    { x: -146.8, z: 14.5, y: 3.3 }, // Moraine slope
    { x: -148, z: 0, y: 3 }, // Glacier valley
    { x: -146.7, z: -15.8, y: 2.7 }, // Penitent field slope
    { x: -145.5, z: -31.6, y: 2.4 }, // Penitent field slope
    { x: -144.2, z: -47.4, y: 2.1 }, // Penitent field slope
    { x: -142.9, z: -63.2, y: 1.8 }, // Penitent field bend (1/4)
    { x: -136.6, z: -81.8, y: 1.4 }, // Penitent field bend (2/4)
    { x: -122.1, z: -95.2, y: 1 }, // Penitent field bend (3/4)
    { x: -103.1, z: -100, y: 0.8 }, // Penitent field bend (4/4)
    { x: -88.3, z: -100, y: 0.7 }, // Return to the plateau
    { x: -73.6, z: -100, y: 0.6 }, // Return to the plateau
    { x: -58.9, z: -100, y: 0.5 }, // Return to the plateau
    { x: -44.2, z: -100, y: 0.4 }, // Return to the plateau
    { x: -29.4, z: -100, y: 0.2 }, // Return to the plateau
    { x: -14.7, z: -100, y: 0.1 }, // Return to the plateau
  ],
  branches: [
    {
      name: 'Lago congelado',
      points: [
        { x: 32, z: 100 },
        { x: 21.7, z: 99.8 },
        { x: 9.2, z: 99.7 },
        { x: -4.5, z: 99.8 },
        { x: -18.6, z: 99.9 },
        { x: -32, z: 100 },
        { x: -45.4, z: 100 },
        { x: -59.5, z: 99.9 },
        { x: -73.2, z: 99.8 },
        { x: -85.7, z: 99.8 },
        { x: -96, z: 100 },
      ],
      halfWidth: 7,
      surface: 'ice',
    },
    {
      name: 'Túnel de hielo',
      points: [
        { x: 110, z: -64 },
        { x: 109.9, z: -53.7 },
        { x: 109.9, z: -41.2 },
        { x: 110, z: -27.5 },
        { x: 110, z: -13.4 },
        { x: 110, z: 0 },
        { x: 110, z: 13.4 },
        { x: 110.1, z: 27.5 },
        { x: 110.1, z: 41.2 },
        { x: 110.1, z: 53.7 },
        { x: 110, z: 64 },
      ],
      halfWidth: 5,
      surface: 'asphalt',
    },
  ],
  checkpoints: { count: 10, optional: [2, 3, 5, 6] },
  itemBoxRows: [
    { at: 0.05, count: 4 },
    { at: 0.25, count: 3 },
    { at: 0.58, count: 4 },
    { at: 0.85, count: 3 },
  ],
  uchuvaLines: [
    { at: 0.075, count: 5, offset: 4 },
    { at: 0.3, count: 5, offset: 0 },
    { at: 0.43, count: 5, offset: -4 },
    { at: 0.62, count: 5, offset: 4 },
    { at: 0.8, count: 5, offset: -3 },
    { at: 0.96, count: 5, offset: 3 },
  ],
  boostPads: [
    { at: 0.035, offset: 0 },
    { at: 0.83, offset: 0 },
  ],
  hazards: [
    {
      kind: 'iceWall',
      path: [{ x: 110, z: -13.4 }],
      motion: 'loop',
      speed: 0,
      count: 1,
      radius: 6,
    },
  ],
}

/** Snowfields and páramo: frailejones, snowy pines, a mountain refuge. */
export const nevadoEnvironment: TrackEnvironment = {
  seed: 3101,
  terrain: {
    palette: {
      grassLight: '#f4f8fc',
      grassDark: '#d3e0ed',
      grassDry: '#a9b98a',
      dirt: '#8a8f99',
      rock: '#6c7280',
    },
    shoulder: 4,
    hillHeight: 14,
    valleySlope: 0.5,
  },
  fence: 'wood',
  vegetation: {
    grass: 2600,
    flowers: 300,
    bushes: 420,
    ferns: 160,
    palms: 0,
    trees: 120,
    cypress: 260,
    distant: 500,
    flowerColors: ['#ffe14d', '#ffffff', '#b36bff'],
    models: {
      grass: 'snowGrass',
      bushes: 'frailejon',
      ferns: 'agave',
      trees: 'snowPine',
      cypress: 'snowPine',
      distant: 'distantRock',
    },
  },
  decor: {
    sponsors: [
      'Refugio Turbo',
      'Chocolate Nevado',
      'Ruana Racing',
      'Aguapanela Max',
      'Frailejón Motors',
      'Termales Express',
      'Glaciar Cola',
      'Cóndor Tours',
    ],
    bannerDensity: 6,
    pennantStrings: 4,
    props: [
      { kind: 'grandstand', at: 0.03, side: 1, edge: 14 },
      { kind: 'mountainHut', at: 0.18, side: -1, edge: 20, turn: 0.3 },
      { kind: 'mountainHut', at: 0.47, side: 1, edge: 22, turn: -0.2 },
      { kind: 'chiva', at: 0.6, side: -1, edge: 14 },
      { kind: 'mountainHut', at: 0.82, side: -1, edge: 24 },
    ],
  },
}

export const nevadoTheme: TrackTheme = {
  sky: '#6fa8e0',
  horizon: '#dcebf8',
  fog: '#d6e6f5',
  fogNear: 70,
  fogFar: 240,
  ambientSky: '#eaf4ff',
  ambientGround: '#9db6d3',
  ambientIntensity: 1.25,
  sun: '#fff6e6',
  sunIntensity: 1.35,
  sunDirection: [0.35, 0.9, 0.25],
  exposure: 1.2,
  mountains: { color: '#e3edf8', height: 120, jagged: 1 },
  clouds: 0.4,
  ground: '#eef4fb',
  road: '#6d7d96',
  wall: '#8fd3f0',
  curb: ['#2c6fd6', '#f4f8ff'],
  decorations: [
    { kind: 'rock', count: 55 },
    { kind: 'fumarole', count: 14 },
  ],
  environment: nevadoEnvironment,
}
