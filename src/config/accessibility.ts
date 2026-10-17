import type { DriftConfig } from './drift'

/** Nitro tier colors and smoke palette for color vision deficiency (Okabe-Ito based). */
export const colorblindNitroPalette = {
  levelColors: ['#f0e442', '#d55e00', '#56b4e9'],
  smokeColors: ['#bbbbbb', '#f0e442', '#d55e00', '#cc79a7'],
} as const

const cache = new WeakMap<DriftConfig, DriftConfig>()

/** `source` with some own properties replaced; everything else is still read live from it. */
function overlay<T extends object>(source: T, overrides: Partial<T>): T {
  const descriptors: PropertyDescriptorMap = {}
  for (const [key, value] of Object.entries(overrides)) descriptors[key] = { value }
  return Object.create(source, descriptors) as T
}

/**
 * The drift config whose tier colors are the active palette: the original one, or a view of it
 * with the color-blind safe colors. Never mutates `drift`. The view inherits from `drift`, so
 * later edits to its other fields (the debug panel) still show through; it is cached per config.
 */
export function activeDriftPalette(drift: DriftConfig, colorblind: boolean): DriftConfig {
  if (!colorblind) return drift
  const cached = cache.get(drift)
  if (cached) return cached
  const { levelColors, smokeColors } = colorblindNitroPalette
  const [l1, l2, l3] = drift.levels
  const safe = overlay(drift, {
    levels: [
      overlay(l1, { color: levelColors[0] }),
      overlay(l2, { color: levelColors[1] }),
      overlay(l3, { color: levelColors[2] }),
    ],
    smokeColors: [...smokeColors],
  })
  cache.set(drift, safe)
  return safe
}

/** Camera feedback multipliers; "reduce shake" turns the shake off and softens the FOV kick. */
export interface FeedbackScales {
  shake: number
  fovKick: number
}

export const REDUCED_FOV_KICK = 0.35

export function feedbackScales(reduceShake: boolean): FeedbackScales {
  return reduceShake ? { shake: 0, fovKick: REDUCED_FOV_KICK } : { shake: 1, fovKick: 1 }
}
