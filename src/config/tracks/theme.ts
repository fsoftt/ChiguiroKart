/**
 * Look of a track: sky, fog, light, ground, road trim and scenery. Read by the renderer only;
 * the simulation never sees it.
 */

/** Low-poly scenery pieces the renderer knows how to build and scatter around a track. */
export type DecorationKind =
  | 'tree'
  | 'waxPalm'
  | 'pine'
  | 'snowPine'
  | 'fumarole'
  | 'saltColumn'
  | 'colonialHouse'
  | 'palm'
  | 'cannon'
  | 'stoneTerrace'
  | 'jungleTree'
  | 'ceiba'
  | 'moriche'
  | 'cow'
  | 'redPlant'
  | 'cactus'
  | 'rock'
  | 'confetti'

export interface DecorationSet {
  kind: DecorationKind
  /** How many to scatter off the road. */
  count: number
}

export interface TrackTheme {
  /** Sky color at the top of the background. */
  sky: string
  /** Sky color at the horizon; also the default fog color. */
  horizon: string
  fog: string
  fogNear: number
  fogFar: number
  /** Hemisphere light: sky and ground tints. */
  ambientSky: string
  ambientGround: string
  ambientIntensity: number
  sun: string
  sunIntensity: number
  /** Ground plane outside the road. */
  ground: string
  /** Road color for asphalt; other surfaces keep their own colors. */
  road: string
  wall: string
  /** Two alternating curb colors. */
  curb: readonly [string, string]
  decorations: readonly DecorationSet[]
  /** Optional sea, lake or river plane at height `level` covering the whole map. */
  water?: { level: number; color: string }
  /** Underground track (Zipaquirá): dark sky and colored lights instead of a sun. */
  underground?: boolean
}

/** The look every track had before themes: Cocora's daytime valley. */
export const DEFAULT_THEME: TrackTheme = {
  sky: '#5fb4e6',
  horizon: '#87ceeb',
  fog: '#87ceeb',
  fogNear: 80,
  fogFar: 260,
  ambientSky: '#ffffff',
  ambientGround: '#5a8f3c',
  ambientIntensity: 1.2,
  sun: '#ffffff',
  sunIntensity: 1.5,
  ground: '#4a9934',
  road: '#5b5f66',
  wall: '#e5b842',
  curb: ['#e8413c', '#ffffff'],
  decorations: [
    { kind: 'tree', count: 160 },
    { kind: 'waxPalm', count: 60 },
  ],
}
