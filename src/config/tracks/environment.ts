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
  /**
   * How fast the land climbs far from the road (m of height per m of distance). Negative makes
   * it fall away instead (a coast or a river plain), down to `floor`.
   */
  valleySlope: number
  /**
   * Lowest height the land reaches (m), e.g. a seabed or riverbed under the theme's water.
   * Without it the land has no lower bound. Never applies within the road and shoulder.
   */
  floor?: number
  /**
   * How strongly the land follows the smooth regional ground level instead of the road height
   * beside it: 0 keeps the land level with the road, 1 (default) drops it away as a steep
   * embankment beside an elevated road and raises it as a wall beside a sunken one.
   */
  drop?: number
  /** Depth (m) of the ravine carved under every jump gap, below the road. Default 14. */
  gapDepth?: number
}

export type FenceStyle = 'wood' | 'stone'

/**
 * Texture of the asphalt surface: road paving, colonial cobbles, or packed earth (trails,
 * dirt roads). Other surfaces (wood, mud, ice, sand, water, grass) keep their own textures.
 */
export type RoadStyle = 'asphalt' | 'cobble' | 'dirt'

/** Plant models; each vegetation layer draws one of them (see `VegetationSettings.models`). */
export type PlantModel =
  // grass layer
  | 'grass'
  | 'dryGrass'
  | 'snowGrass'
  // flowers layer
  | 'flowers'
  // bushes layer
  | 'bush'
  | 'dryBush'
  | 'frailejon'
  // ferns layer
  | 'fern'
  | 'macarenia'
  | 'agave'
  // palms layer (tall landmark plants)
  | 'waxPalm'
  | 'coconutPalm'
  | 'moriche'
  | 'cardon'
  | 'ceiba'
  // trees layer
  | 'broadleaf'
  | 'jungle'
  | 'saman'
  | 'dryTree'
  | 'eucalyptus'
  // cypress layer (slopes)
  | 'cypress'
  | 'snowPine'
  | 'saltCrystal'
  | 'rockSpire'
  // distant layer
  | 'distantTree'
  | 'distantPalm'
  | 'distantRock'

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
  /**
   * Model each layer draws; a missing layer keeps Cocora's (grass, flowers, bush, fern,
   * waxPalm, broadleaf, cypress, distantTree). Any model works in any layer, but each is sized
   * for the layer listed next to it in `PlantModel`.
   */
  models?: Partial<Record<VegetationLayerName, PlantModel>>
}

/** The vegetation layers, from the road outward. */
export type VegetationLayerName =
  'grass' | 'flowers' | 'bushes' | 'ferns' | 'palms' | 'trees' | 'cypress' | 'distant'

/** A prop placed beside the road, off the drivable area. */
export type PropKind =
  // Cocora
  | 'finca'
  | 'yipao'
  | 'cart'
  | 'sacks'
  // shared
  | 'grandstand'
  | 'colonialHouse'
  | 'chiva'
  | 'boat'
  // Andes
  | 'mountainHut'
  | 'saltCross'
  // Caribbean
  | 'cannon'
  | 'beachHut'
  | 'stoneTerrace'
  | 'carnivalStage'
  // jungle and plains
  | 'maloca'
  | 'corral'
  | 'observatory'

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
