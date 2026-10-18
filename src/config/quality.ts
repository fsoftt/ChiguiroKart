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
  /** Share of the tire mark ring buffer and lifetime used, 0..1; 0 turns the marks off. */
  skidMarkScale: number
  /** Side of the sun's shadow map in texels; 0 turns real-time shadows off. */
  shadowMapSize: number
  /** Cheap dark circle under each kart (used where the shadow map is off). */
  blobShadows: boolean
  /** Scale of the theme's fog distances, which also sets the camera far plane (draw distance). */
  fogScale: number
  /** Share of the track's plants (grass, flowers, bushes, palms, trees) that are planted, 0..1. */
  vegetationDensity: number
  /**
   * Scale of how far from the player each plant layer is drawn (see `LAYER_DRAW_DISTANCE`);
   * Infinity draws all of them.
   */
  vegetationDrawScale: number
  /** How far from the player (m) power boxes and uchuvas are drawn; Infinity: always. */
  pickupDrawDistance: number
  /** Ink outline on the bots (the player's kart always has it). */
  botOutlines: boolean
}

export const qualityProfiles: Record<Quality, QualityProfile> = {
  low: {
    maxPixelRatio: 1,
    bloom: false,
    particleScale: 0.5,
    speedLines: false,
    skidMarkScale: 0.3,
    shadowMapSize: 0,
    blobShadows: true,
    fogScale: 0.65,
    vegetationDensity: 0.3,
    vegetationDrawScale: 0.7,
    pickupDrawDistance: 110,
    botOutlines: false,
  },
  medium: {
    maxPixelRatio: 1.5,
    bloom: true,
    particleScale: 0.75,
    speedLines: true,
    skidMarkScale: 0.7,
    shadowMapSize: 1024,
    blobShadows: false,
    fogScale: 0.85,
    vegetationDensity: 0.6,
    vegetationDrawScale: 1,
    pickupDrawDistance: 170,
    botOutlines: true,
  },
  high: {
    maxPixelRatio: 2,
    bloom: true,
    particleScale: 1,
    speedLines: true,
    skidMarkScale: 1,
    shadowMapSize: 2048,
    blobShadows: false,
    fogScale: 1,
    vegetationDensity: 1,
    vegetationDrawScale: Infinity,
    pickupDrawDistance: Infinity,
    botOutlines: true,
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
  skidMarkScale: number
  shadowMapSize: number
  blobShadows: boolean
  fogScale: number
  vegetationDensity: number
  vegetationDrawScale: number
  pickupDrawDistance: number
  botOutlines: boolean
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
    skidMarkScale: profile.skidMarkScale,
    shadowMapSize: profile.shadowMapSize,
    blobShadows: profile.blobShadows,
    fogScale: profile.fogScale,
    vegetationDensity: profile.vegetationDensity,
    vegetationDrawScale: profile.vegetationDrawScale,
    pickupDrawDistance: profile.pickupDrawDistance,
    botOutlines: profile.botOutlines,
  }
}
