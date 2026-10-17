import type { TrackData } from '../../sim/trackData'
import type { TrackEnvironment } from './environment'
import type { TrackTheme } from './theme'

/**
 * Bogotá: La Candelaria y Monserrate: a clockwise loop from the old town up a zigzag road to
 * Monserrate and back down. The cable car crest is a real jump over a gap on the descent (boost
 * pad before it).
 * Shortcut: a narrow wooden alley through the colonial house the street goes around.
 */
export const bogotaData: TrackData = {
  version: 1,
  name: 'Bogotá: La Candelaria y Monserrate',
  halfWidth: 9,
  samplesPerSegment: 6,
  points: [
    { x: 10, z: -95, y: 0 }, // Start / finish line on Carrera Séptima
    { x: 25, z: -95, y: 0.1 }, // Carrera Séptima straight
    { x: 40, z: -95, y: 0.2 }, // Carrera Séptima straight
    { x: 55, z: -95, y: 0.3 }, // Carrera Séptima straight
    { x: 70, z: -95, y: 0.4 }, // Carrera Séptima straight
    { x: 85, z: -95, y: 0.5 }, // Carrera Séptima straight
    { x: 100, z: -95, y: 0.6 }, // Carrera Séptima straight
    { x: 115, z: -95, y: 0.7 }, // Plaza de Bolívar bend (1/4)
    { x: 132.5, z: -90.3, y: 0.9 }, // Plaza de Bolívar bend (2/4)
    { x: 145.3, z: -77.5, y: 1 }, // Plaza de Bolívar bend (3/4)
    { x: 150, z: -60, y: 1.8 }, // Plaza de Bolívar bend (4/4)
    { x: 150, z: -50, y: 2.2 }, // Monserrate road, first hairpin entry (1/4)
    { x: 146, z: -35, y: 2.8 }, // Monserrate road, first hairpin entry (2/4)
    { x: 135, z: -24, y: 3.5 }, // Monserrate road, first hairpin entry (3/4)
    { x: 120, z: -20, y: 4.3 }, // Monserrate road, first hairpin entry (4/4)
    { x: 110, z: -20, y: 4.8 }, // Monserrate road, first leg
    { x: 100, z: -20, y: 5.4 }, // Monserrate switchback 1 (west) (1/4)
    { x: 85, z: -16, y: 6.2 }, // Monserrate switchback 1 (west) (2/4)
    { x: 74, z: -5, y: 7 }, // Monserrate switchback 1 (west) (3/4)
    { x: 70, z: 10, y: 8.2 }, // Monserrate switchback 1 (west) (4/4)
    { x: 74, z: 25, y: 9.3 }, // Monserrate switchback 1 (exit) (2/4)
    { x: 85, z: 36, y: 10.5 }, // Monserrate switchback 1 (exit) (3/4)
    { x: 100, z: 40, y: 11.3 }, // Monserrate switchback 1 (exit) (4/4)
    { x: 110, z: 40, y: 11.8 }, // Monserrate road, second leg
    { x: 120, z: 40, y: 12.4 }, // Monserrate switchback 2 (east) (1/4)
    { x: 135, z: 44, y: 13.2 }, // Monserrate switchback 2 (east) (2/4)
    { x: 146, z: 55, y: 14 }, // Monserrate switchback 2 (east) (3/4)
    { x: 150, z: 70, y: 15.2 }, // Monserrate switchback 2 (east) (4/4)
    { x: 146, z: 85, y: 16.3 }, // Monserrate switchback 2 (exit) (2/4)
    { x: 135, z: 96, y: 17.5 }, // Monserrate switchback 2 (exit) (3/4)
    { x: 120, z: 100, y: 16.2 }, // Monserrate switchback 2 (exit) (4/4)
    { x: 106.7, z: 100, y: 15 }, // Summit descent
    { x: 93.3, z: 100, y: 13.8 }, // Summit descent
    { x: 80, z: 100, y: 12.7 }, // Cable car approach
    { x: 68.3, z: 100, y: 13.1 }, // Cable car approach
    { x: 56.7, z: 100, y: 13.5 }, // Cable car approach
    { x: 45, z: 100, y: 13.9 }, // Cable car crest (jump)
    { x: 30, z: 100, y: 12.1 }, // Cable car descent
    { x: 15, z: 100, y: 10.2 }, // Cable car landing
    { x: 1.7, z: 100, y: 9.5 }, // Calle 10 straight
    { x: -11.7, z: 100, y: 8.7 }, // Calle 10 straight
    { x: -25, z: 100, y: 8 }, // Calle 10 bend (1/4)
    { x: -42.5, z: 95.3, y: 7 }, // Calle 10 bend (2/4)
    { x: -55.3, z: 82.5, y: 6 }, // Calle 10 bend (3/4)
    { x: -60, z: 65, y: 5.7 }, // Calle 10 bend (4/4)
    { x: -64, z: 50, y: 5.5 }, // Alley block, south base (2/4)
    { x: -75, z: 39, y: 5.2 }, // Alley block, south base (3/4)
    { x: -90, z: 35, y: 5 }, // Alley block, south base (4/4)
    { x: -100, z: 35, y: 4.9 }, // After Alley block, south base
    { x: -110, z: 35, y: 4.8 }, // Alley block, south-west corner (1/4)
    { x: -125, z: 31, y: 4.7 }, // Alley block, south-west corner (2/4)
    { x: -136, z: 20, y: 4.5 }, // Alley block, south-west corner (3/4)
    { x: -140, z: 5, y: 4.3 }, // Alley block, south-west corner (4/4)
    { x: -136, z: -10, y: 4 }, // Alley block, north-west corner (2/4)
    { x: -125, z: -21, y: 3.8 }, // Alley block, north-west corner (3/4)
    { x: -110, z: -25, y: 3.6 }, // Alley block, north-west corner (4/4)
    { x: -100, z: -25, y: 3.5 }, // After Alley block, north-west corner
    { x: -90, z: -25, y: 3.4 }, // Alley block, north base (1/4)
    { x: -75, z: -29, y: 3.2 }, // Alley block, north base (2/4)
    { x: -64, z: -40, y: 3 }, // Alley block, north base (3/4)
    { x: -60, z: -57.5, y: 2.4 }, // Alley block, north base (4/4)
    { x: -55.3, z: -77.5, y: 1.6 }, // La Candelaria bend (2/4)
    { x: -42.5, z: -90.3, y: 1 }, // La Candelaria bend (3/4)
    { x: -25, z: -95, y: 0.7 }, // La Candelaria bend (4/4)
    { x: -13.3, z: -95, y: 0.4 }, // Calle 12 straight
    { x: -1.7, z: -95, y: 0.2 }, // Calle 12 straight
  ],
  branches: [
    {
      name: 'Callejón de la casa colonial',
      points: [
        { x: -60, z: 65 },
        { x: -60.3, z: 59.2 },
        { x: -60.4, z: 52.5 },
        { x: -60.4, z: 45.1 },
        { x: -60.3, z: 37.2 },
        { x: -60.2, z: 29 },
        { x: -60.1, z: 20.8 },
        { x: -60, z: 12.7 },
        { x: -60, z: 5 },
        { x: -60.1, z: -3.8 },
        { x: -60.3, z: -13 },
        { x: -60.5, z: -22.3 },
        { x: -60.7, z: -31.4 },
        { x: -60.8, z: -40 },
        { x: -60.8, z: -47.7 },
        { x: -60.6, z: -54.4 },
      ],
      halfWidth: 4.5,
      surface: 'wood',
    },
  ],
  checkpoints: { count: 8, optional: [6, 7] },
  itemBoxRows: [
    { at: 0.0417, count: 4 },
    { at: 0.3497, count: 3 },
    { at: 0.4508, count: 4 },
    { at: 0.7891, count: 3 },
  ],
  uchuvaLines: [
    { at: 0.0871, count: 5, offset: 4 },
    { at: 0.1604, count: 5, offset: -3 },
    { at: 0.2285, count: 5, offset: 0 },
    { at: 0.6275, count: 5, offset: -4 },
    { at: 0.8295, count: 5, offset: 3 },
    { at: 0.9508, count: 5, offset: 4 },
  ],
  boostPads: [
    { at: 0.4811, offset: 0 },
    { at: 0.9811, offset: 0 },
    // Turbo on the wooden alley shortcut
    { at: 0.25, offset: 0, length: 8, width: 3.5, branch: 'Callejón de la casa colonial' },
  ],
  jumps: [
    // The gondola gap: the cable car crest ends in a lip over a missing stretch of road
    { at: 0.5455, launchSpeed: 11, gap: 8 },
  ],
}

/** Cobbled streets of La Candelaria and the eucalyptus slopes of Monserrate. */
export const bogotaEnvironment: TrackEnvironment = {
  seed: 3303,
  terrain: {
    palette: {
      grassLight: '#8fb85a',
      grassDark: '#557f38',
      grassDry: '#b5b06a',
      dirt: '#8a6a4a',
      rock: '#7d7a74',
    },
    shoulder: 4,
    hillHeight: 12,
    valleySlope: 0.45,
  },
  fence: 'stone',
  road: 'cobble',
  vegetation: {
    grass: 3400,
    flowers: 1000,
    bushes: 260,
    ferns: 220,
    palms: 200,
    trees: 220,
    cypress: 170,
    distant: 600,
    flowerColors: ['#ff4d6d', '#ffd23f', '#ffffff', '#ff8a3d', '#c77dff'],
    models: { palms: 'eucalyptus', ferns: 'agave' },
  },
  decor: {
    sponsors: [
      'Ajiaco Turbo',
      'Tinto Racing',
      'Almojábana Max',
      'Teleférico Express',
      'Changua Veloz',
      'Ruana Motors',
      'Chocolate Santafé',
      'Lluvia Cola',
    ],
    bannerDensity: 7,
    pennantStrings: 6,
    props: [
      { kind: 'grandstand', at: 0.03, side: 1, edge: 14 },
      { kind: 'colonialHouse', at: 0.1, side: -1, edge: 12 },
      { kind: 'chiva', at: 0.16, side: 1, edge: 12 },
      { kind: 'colonialHouse', at: 0.24, side: 1, edge: 12, turn: 0.2 },
      { kind: 'colonialHouse', at: 0.42, side: -1, edge: 13 },
      { kind: 'chiva', at: 0.58, side: -1, edge: 12 },
      { kind: 'colonialHouse', at: 0.72, side: 1, edge: 12, turn: -0.2 },
      { kind: 'colonialHouse', at: 0.9, side: -1, edge: 12 },
    ],
  },
}

export const bogotaTheme: TrackTheme = {
  sky: '#8aa2bb',
  horizon: '#d3d8dc',
  fog: '#c8cfd5',
  fogNear: 70,
  fogFar: 250,
  ambientSky: '#f4efe6',
  ambientGround: '#8a6f5c',
  ambientIntensity: 1.1,
  sun: '#ffe9c4',
  sunIntensity: 1.25,
  sunDirection: [0.4, 0.7, 0.5],
  exposure: 1.2,
  mountains: { color: '#8d9aa0', height: 80, jagged: 0.7 },
  clouds: 0.75,
  ground: '#7c8b5d',
  road: '#7a6f66',
  wall: '#b9795c',
  curb: ['#c8402b', '#f4e6bd'],
  decorations: [{ kind: 'rock', count: 24 }],
  environment: bogotaEnvironment,
}
