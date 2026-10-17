import type { TrackTheme } from './theme'

export type Vec3 = readonly [number, number, number]

/** Warm afternoon sun, used by themes that do not set a direction. */
export const DEFAULT_SUN_DIRECTION: Vec3 = [0.4, 0.85, 0.35]
export const DEFAULT_EXPOSURE = 1.2
export const DEFAULT_CLOUDS = 0.5
export const DEFAULT_MOUNTAIN_HEIGHT = 40
export const DEFAULT_MOUNTAIN_JAGGED = 0.5

export interface ResolvedMountains {
  color: string
  height: number
  jagged: number
}

/** The theme's light, sky and horizon values with every optional field filled in. */
export interface ResolvedLighting {
  /** Unit vector pointing toward the sun. */
  sunDirection: Vec3
  exposure: number
  /** Null when the track has no horizon silhouette. */
  mountains: ResolvedMountains | null
  clouds: number
}

export function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2])
  if (length < 1e-6) return normalize(DEFAULT_SUN_DIRECTION)
  return [v[0] / length, v[1] / length, v[2] / length]
}

/** Fills the optional lighting fields of a theme with defaults; underground themes get no sky. */
export function resolveLighting(theme: TrackTheme): ResolvedLighting {
  const mountains = theme.mountains
  const height = mountains?.height ?? DEFAULT_MOUNTAIN_HEIGHT
  return {
    sunDirection: normalize(theme.sunDirection ?? DEFAULT_SUN_DIRECTION),
    exposure: theme.exposure ?? DEFAULT_EXPOSURE,
    mountains:
      theme.underground || height <= 0
        ? null
        : {
            color: mountains?.color ?? theme.ambientGround,
            height,
            jagged: mountains?.jagged ?? DEFAULT_MOUNTAIN_JAGGED,
          },
    clouds: theme.underground ? 0 : Math.min(1, Math.max(0, theme.clouds ?? DEFAULT_CLOUDS)),
  }
}
