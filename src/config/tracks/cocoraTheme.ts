import type { TrackEnvironment } from './environment'
import { DEFAULT_THEME, type TrackTheme } from './theme'

/**
 * Valle de Cocora, the pilot of the rich environment: lush rolling hills, wax palm groves, a
 * wooden fence with sponsor banners and rustic fincas. Other tracks adopt it by setting their
 * own `environment` on the theme.
 */
export const cocoraEnvironment: TrackEnvironment = {
  seed: 2024,
  terrain: {
    palette: {
      grassLight: '#7fcb34',
      grassDark: '#3f9a2c',
      grassDry: '#b7c93e',
      dirt: '#a8794a',
      rock: '#8a8478',
    },
    shoulder: 4,
    hillHeight: 9,
    valleySlope: 0.34,
  },
  fence: 'wood',
  vegetation: {
    grass: 4200,
    flowers: 1500,
    bushes: 260,
    ferns: 320,
    palms: 340,
    trees: 380,
    cypress: 130,
    distant: 700,
    flowerColors: ['#ffffff', '#ffe14d', '#ff6fa8', '#b36bff', '#ff8a3d'],
  },
  decor: {
    sponsors: [
      'Café Chigüiro',
      'Arepas Turbo',
      'Panela Rayo',
      'Lulo Racing',
      'Yipao Express',
      'Quesito Veloz',
      'Hotel Palma de Cera',
      'Bocadillo Max',
    ],
    bannerDensity: 7,
    pennantStrings: 5,
    props: [
      { kind: 'finca', at: 0.04, side: 1, edge: 26, turn: 0.2 },
      { kind: 'yipao', at: 0.07, side: 1, edge: 14 },
      { kind: 'sacks', at: 0.05, side: 1, edge: 15 },
      { kind: 'cart', at: 0.12, side: -1, edge: 14 },
      { kind: 'finca', at: 0.34, side: -1, edge: 28, turn: -0.3 },
      { kind: 'yipao', at: 0.62, side: 1, edge: 14 },
      { kind: 'cart', at: 0.78, side: -1, edge: 15 },
      { kind: 'finca', at: 0.9, side: 1, edge: 28 },
      { kind: 'sacks', at: 0.9, side: 1, edge: 14 },
    ],
  },
}

export const cocoraTheme: TrackTheme = {
  ...DEFAULT_THEME,
  road: '#77726d',
  decorations: [],
  environment: cocoraEnvironment,
}
