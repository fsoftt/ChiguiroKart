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
}

export const qualityProfiles: Record<Quality, QualityProfile> = {
  low: { maxPixelRatio: 1, bloom: false, particleScale: 0.5, speedLines: false },
  medium: { maxPixelRatio: 1.5, bloom: true, particleScale: 0.75, speedLines: true },
  high: { maxPixelRatio: 2, bloom: true, particleScale: 1, speedLines: true },
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
  }
}
