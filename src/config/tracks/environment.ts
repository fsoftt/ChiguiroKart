/**
 * Rich environment of a track: sculpted terrain, textured road, themed fence, instanced
 * vegetation and decoration. Visual only: the simulation never reads it. A theme without an
 * `environment` keeps the flat ground and plain road (see `TrackView`).
 */

/** Colors of the sculpted terrain (hex strings). */
export interface TerrainPalette {
  grassLight: string
  grassDark: string
  /** Sun-dried patches of grass. */
  grassDry: string
  dirt: string
  rock: string
}

export interface TerrainSettings {
  palette: TerrainPalette
  /** Flat strip beyond the fence, level with the road, before the land starts to rise (m). */
  shoulder: number
  /** Height of the rolling hills at mid distance (m). */
  hillHeight: number
  /** How fast the land climbs far from the road (m of height per m of distance). */
  valleySlope: number
}

export type FenceStyle = 'wood' | 'stone'

/**
 * Texture of the asphalt surface: road paving, colonial cobbles, or packed earth (trails,
 * dirt roads). Other surfaces (wood, mud, ice, sand, water, grass) keep their own textures.
 */
export type RoadStyle = 'asphalt' | 'cobble' | 'dirt'

export interface VegetationSettings {
  /** Counts at full quality; the quality table scales them. */
  grass: number
  flowers: number
  bushes: number
  ferns: number
  palms: number
  trees: number
  cypress: number
  /** Far silhouettes on the hills. */
  distant: number
  /** Petal colors of the flowers. */
  flowerColors: readonly string[]
}

/** A prop placed beside the road, off the drivable area. */
export type PropKind = 'finca' | 'yipao' | 'cart' | 'sacks'

export interface PropPlacement {
  kind: PropKind
  /** Position along the loop, 0..1. */
  at: number
  /** +1 right of the driving direction, -1 left. */
  side: 1 | -1
  /** Distance from the road edge (m). */
  edge: number
  /** Extra turn around y (rad), on top of facing the road. */
  turn?: number
}

export interface DecorSettings {
  /** Fictional sponsor names drawn on the fence banners. */
  sponsors: readonly string[]
  /** Fence banners per 100 m of fence. */
  bannerDensity: number
  /** Cross-road pennant strings placed on straights. */
  pennantStrings: number
  props: readonly PropPlacement[]
}

export interface TrackEnvironment {
  /** Seed of every noise and scatter of the environment. */
  seed: number
  terrain: TerrainSettings
  fence: FenceStyle
  /** Texture of the asphalt surface. Default 'asphalt'. */
  road?: RoadStyle
  vegetation: VegetationSettings
  decor: DecorSettings
}
