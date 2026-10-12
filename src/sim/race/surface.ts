export type SurfaceType = 'asphalt' | 'dirt' | 'grass' | 'mud' | 'wood'

export interface SurfaceProperties {
  readonly speedMultiplier: number
  readonly gripMultiplier: number
  readonly accelerationMultiplier: number
}

export const SURFACE_PROPERTIES: Record<SurfaceType, SurfaceProperties> = {
  asphalt: {
    speedMultiplier: 1.0,
    gripMultiplier: 1.0,
    accelerationMultiplier: 1.0,
  },
  wood: {
    speedMultiplier: 1.0,
    gripMultiplier: 0.95,
    accelerationMultiplier: 1.0,
  },
  dirt: {
    speedMultiplier: 0.85,
    gripMultiplier: 0.8,
    accelerationMultiplier: 0.85,
  },
  mud: {
    speedMultiplier: 0.65,
    gripMultiplier: 0.6,
    accelerationMultiplier: 0.6,
  },
  grass: {
    speedMultiplier: 0.5,
    gripMultiplier: 0.45,
    accelerationMultiplier: 0.5,
  },
}

export function getSurfaceProperties(type: SurfaceType): SurfaceProperties {
  return SURFACE_PROPERTIES[type] ?? SURFACE_PROPERTIES.asphalt
}
