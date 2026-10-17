/** Graphics quality levels the player can pick in the options. */
export const QUALITY_LEVELS = ['low', 'medium', 'high'] as const
export type Quality = (typeof QUALITY_LEVELS)[number]

export interface QualityProfile {
  /** Cap of the device pixel ratio. */
  maxPixelRatio: number
  /** Bloom post-processing on. */
  bloom: boolean
  /** Multiplier of the particle pool sizes (smoke and flames), 0..1. */
  particleScale: number
  /** Speed lines on. */
  speedLines: boolean
  /** Side of the sun's shadow map in texels; 0 turns real-time shadows off. */
  shadowMapSize: number
  /** Cheap dark circle under each kart (used where the shadow map is off). */
  blobShadows: boolean
  /** Scale of the theme's fog distances, which also sets the camera far plane (draw distance). */
  fogScale: number
  /** Share of the track's plants (grass, flowers, bushes, palms, trees) that are planted, 0..1. */
  vegetationDensity: number
}

export const qualityProfiles: Record<Quality, QualityProfile> = {
  low: {
    maxPixelRatio: 1,
    bloom: false,
    particleScale: 0.5,
    speedLines: false,
    shadowMapSize: 0,
    blobShadows: true,
    fogScale: 0.65,
    vegetationDensity: 0.3,
  },
  medium: {
    maxPixelRatio: 1.5,
    bloom: true,
    particleScale: 0.75,
    speedLines: true,
    shadowMapSize: 1024,
    blobShadows: false,
    fogScale: 0.85,
    vegetationDensity: 0.6,
  },
  high: {
    maxPixelRatio: 2,
    bloom: true,
    particleScale: 1,
    speedLines: true,
    shadowMapSize: 2048,
    blobShadows: false,
    fogScale: 1,
    vegetationDensity: 1,
  },
}

export const QUALITY_LABELS: Record<Quality, string> = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
}

/** What the renderer should use now for a quality level on this device. */
export interface ResolvedQuality {
  pixelRatio: number
  bloom: boolean
  particleScale: number
  speedLines: boolean
  shadowMapSize: number
  blobShadows: boolean
  fogScale: number
  vegetationDensity: number
}

/**
 * Applies the quality table to the device. `bloomForcedOff` is the `?bloom=0` URL switch,
 * which wins over every level.
 */
export function resolveQuality(
  quality: Quality,
  devicePixelRatio: number,
  bloomForcedOff = false,
): ResolvedQuality {
  const profile = qualityProfiles[quality]
  return {
    pixelRatio: Math.max(1, Math.min(devicePixelRatio, profile.maxPixelRatio)),
    bloom: profile.bloom && !bloomForcedOff,
    particleScale: profile.particleScale,
    speedLines: profile.speedLines,
    shadowMapSize: profile.shadowMapSize,
    blobShadows: profile.blobShadows,
    fogScale: profile.fogScale,
    vegetationDensity: profile.vegetationDensity,
  }
}
