import type { TrackTheme } from '../config/tracks/theme'
import type { SurfaceType } from '../sim/race/surface'

const WOOD_COLOR = '#8d5524'
const MUD_COLOR = '#5c3a21'
const DIRT_COLOR = '#a67c52'
const GRASS_ROAD_COLOR = '#6aa84f'
const ICE_COLOR = '#a9e3ef'
const SAND_COLOR = '#e6cf8f'
const WATER_COLOR = '#3b9ed8'

/** Road color of a surface; asphalt takes the theme's road color. */
export function surfaceColor(surface: SurfaceType, theme: TrackTheme): string {
  switch (surface) {
    case 'asphalt':
      return theme.road
    case 'wood':
      return WOOD_COLOR
    case 'mud':
      return MUD_COLOR
    case 'dirt':
      return DIRT_COLOR
    case 'grass':
      return GRASS_ROAD_COLOR
    case 'ice':
      return ICE_COLOR
    case 'sand':
      return SAND_COLOR
    case 'water':
      return WATER_COLOR
  }
}
