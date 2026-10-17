import type { TrackData } from '../../sim/trackData'
import type { TrackTheme } from './theme'

/**
 * Catedral de Sal de Zipaquirá: a counter-clockwise loop inside the salt mine.
 * Shortcut 1: a narrow dirt passage between salt columns along the east wall, with boulders to
 * weave around. Shortcut 2: a drop from the upper gallery to the lower level (about 10 m), which
 * cuts the cascade chamber the main road goes around.
 */
export const zipaquiraData: TrackData = {
  version: 1,
  name: 'Catedral de Sal de Zipaquirá',
  halfWidth: 9,
  samplesPerSegment: 6,
  points: [
    { x: 0, z: 100, y: 0 }, // Start / finish line in the main nave
    { x: 15.8, z: 100, y: 0.3 }, // Main nave straight
    { x: 31.6, z: 100, y: 0.7 }, // Main nave straight
    { x: 47.4, z: 100, y: 1 }, // Main nave straight
    { x: 63.2, z: 100, y: 1.4 }, // Main nave straight
    { x: 79, z: 100, y: 1.7 }, // Narthex bend (1/4)
    { x: 97, z: 95.2, y: 2.1 }, // Narthex bend (2/4)
    { x: 110.2, z: 82, y: 2.5 }, // Narthex bend (3/4)
    { x: 115, z: 64, y: 3 }, // Narthex bend (4/4)
    { x: 110.7, z: 48, y: 3.5 }, // Columns passage base (south) (2/4)
    { x: 99, z: 36.3, y: 4 }, // Columns passage base (south) (3/4)
    { x: 80, z: 32, y: 4.9 }, // Columns passage base (south) (4/4)
    { x: 61, z: 27.7, y: 5.8 }, // Chapel of the Miners, south wall (2/4)
    { x: 49.3, z: 16, y: 6.5 }, // Chapel of the Miners, south wall (3/4)
    { x: 45, z: 0, y: 7 }, // Chapel of the Miners, south wall (4/4)
    { x: 49.3, z: -16, y: 7.5 }, // Chapel of the Miners, north wall (2/4)
    { x: 61, z: -27.7, y: 8 }, // Chapel of the Miners, north wall (3/4)
    { x: 80, z: -32, y: 8.5 }, // Chapel of the Miners, north wall (4/4)
    { x: 99, z: -36.3, y: 9.1 }, // Columns passage base (north) (2/4)
    { x: 110.7, z: -48, y: 9.5 }, // Columns passage base (north) (3/4)
    { x: 115, z: -64, y: 10.4 }, // Columns passage base (north) (4/4)
    { x: 110.2, z: -82, y: 11.5 }, // Upper gallery bend (2/4)
    { x: 97, z: -95.2, y: 12.5 }, // Upper gallery bend (3/4)
    { x: 79, z: -100, y: 12.2 }, // Upper gallery bend (4/4)
    { x: 63.3, z: -100, y: 12.1 }, // After Upper gallery bend
    { x: 47.7, z: -100, y: 11.8 }, // After Upper gallery bend
    { x: 32, z: -100, y: 11.6 }, // Drop to the lower level (rim) (1/4)
    { x: 16, z: -95.7, y: 11.4 }, // Drop to the lower level (rim) (2/4)
    { x: 4.3, z: -84, y: 11.2 }, // Drop to the lower level (rim) (3/4)
    { x: 0, z: -65, y: 10.4 }, // Drop to the lower level (rim) (4/4)
    { x: -4.3, z: -46, y: 9.5 }, // Cascade chamber, east wall (2/4)
    { x: -16, z: -34.3, y: 8.8 }, // Cascade chamber, east wall (3/4)
    { x: -32, z: -30, y: 8.4 }, // Cascade chamber, east wall (4/4)
    { x: -48, z: -34.3, y: 8 }, // Cascade chamber, west wall (2/4)
    { x: -59.7, z: -46, y: 7.6 }, // Cascade chamber, west wall (3/4)
    { x: -64, z: -65, y: 6.7 }, // Cascade chamber, west wall (4/4)
    { x: -68.3, z: -84, y: 5.8 }, // Lower level (landing) (2/4)
    { x: -80, z: -95.7, y: 5 }, // Lower level (landing) (3/4)
    { x: -96.2, z: -100, y: 4.2 }, // Lower level (landing) (4/4)
    { x: -113.4, z: -95.1, y: 3.4 }, // Dome bend (2/4)
    { x: -125.2, z: -82, y: 2.6 }, // Dome bend (3/4)
    { x: -128.2, z: -64.6, y: 2.3 }, // Dome bend (4/4)
    { x: -126.8, z: -51.4, y: 2 }, // Crypt corridor
    { x: -125.4, z: -38.2, y: 1.8 }, // Crypt corridor
    { x: -124, z: -25, y: 1.5 }, // Crypt chicane, north
    { x: -127.8, z: -8.8, y: 1.4 }, // Crypt chicane
    { x: -131.5, z: 7.5, y: 1.2 }, // Crypt chicane
    { x: -135.2, z: 23.8, y: 1.1 }, // Crypt chicane
    { x: -139, z: 40, y: 1 }, // Crypt chicane, south
    { x: -137.4, z: 54.1, y: 0.9 }, // Crypt corridor, south
    { x: -135.7, z: 68.2, y: 0.8 }, // Nave bend (1/4)
    { x: -129.6, z: 84.4, y: 0.6 }, // Nave bend (2/4)
    { x: -116.7, z: 95.9, y: 0.5 }, // Nave bend (3/4)
    { x: -100, z: 100, y: 0.4 }, // Nave bend (4/4)
    { x: -83.3, z: 100, y: 0.4 }, // After Nave bend
    { x: -66.6, z: 100, y: 0.3 }, // After Nave bend
    { x: -50, z: 100, y: 0.2 }, // After Nave bend
    { x: -33.3, z: 100, y: 0.1 }, // After Nave bend
    { x: -16.7, z: 100, y: 0.1 }, // After Nave bend
  ],
  branches: [
    {
      name: 'Pasaje entre columnas',
      points: [
        { x: 115, z: 64 },
        { x: 115.3, z: 55.7 },
        { x: 115.9, z: 46.4 },
        { x: 116.4, z: 37.4 },
        { x: 116.5, z: 30 },
        { x: 114.9, z: 21.3 },
        { x: 113.5, z: 15 },
        { x: 115, z: 7.5 },
        { x: 116.5, z: 0 },
        { x: 115, z: -7.5 },
        { x: 113.5, z: -15 },
        { x: 114.9, z: -21.3 },
        { x: 116.5, z: -30 },
        { x: 116.4, z: -37.4 },
        { x: 116, z: -46.4 },
        { x: 115.5, z: -55.7 },
        { x: 115, z: -64 },
      ],
      halfWidth: 4.5,
      surface: 'dirt',
    },
    {
      name: 'Caída al nivel inferior',
      points: [
        { x: 32, z: -100 },
        { x: 21.7, z: -99.8 },
        { x: 9.2, z: -99.7 },
        { x: -4.5, z: -99.8 },
        { x: -18.6, z: -99.9 },
        { x: -32, z: -100 },
        { x: -45.5, z: -100 },
        { x: -59.5, z: -100.1 },
        { x: -73.3, z: -100.1 },
        { x: -85.9, z: -100.1 },
        { x: -96.2, z: -100 },
      ],
      halfWidth: 7,
      surface: 'asphalt',
    },
  ],
  checkpoints: { count: 10, optional: [2, 3, 5, 6] },
  itemBoxRows: [
    { at: 0.04, count: 4 },
    { at: 0.22, count: 3 },
    { at: 0.56, count: 4 },
    { at: 0.82, count: 3 },
  ],
  uchuvaLines: [
    { at: 0.07, count: 5, offset: 4 },
    { at: 0.27, count: 5, offset: 0 },
    { at: 0.41, count: 5, offset: -4 },
    { at: 0.63, count: 5, offset: 4 },
    { at: 0.74, count: 5, offset: -3 },
    { at: 0.93, count: 5, offset: 3 },
  ],
  boostPads: [
    { at: 0.1, offset: 0 },
    { at: 0.77, offset: 0 },
  ],
  hazards: [
    { kind: 'rock', path: [{ x: 113.5, z: 30 }], motion: 'loop', speed: 0, count: 1, radius: 1.2 },
    { kind: 'rock', path: [{ x: 116.5, z: 15 }], motion: 'loop', speed: 0, count: 1, radius: 1.2 },
    { kind: 'rock', path: [{ x: 113.5, z: 0 }], motion: 'loop', speed: 0, count: 1, radius: 1.2 },
    { kind: 'rock', path: [{ x: 116.5, z: -15 }], motion: 'loop', speed: 0, count: 1, radius: 1.2 },
    { kind: 'rock', path: [{ x: 113.5, z: -30 }], motion: 'loop', speed: 0, count: 1, radius: 1.2 },
  ],
}

export const zipaquiraTheme: TrackTheme = {
  sky: '#0a0612',
  horizon: '#1c1030',
  fog: '#1a0f2b',
  fogNear: 30,
  fogFar: 140,
  ambientSky: '#c4a4ff',
  ambientGround: '#3b2352',
  ambientIntensity: 0.95,
  sun: '#ff7ad9',
  sunIntensity: 0.45,
  ground: '#2b1d3a',
  road: '#cdb8c2',
  wall: '#f0dcf5',
  curb: ['#ff4fd8', '#35f0ff'],
  decorations: [
    { kind: 'saltColumn', count: 90 },
    { kind: 'rock', count: 40 },
  ],
  underground: true,
}
